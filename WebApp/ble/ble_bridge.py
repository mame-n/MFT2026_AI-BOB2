#!/usr/bin/env python3
import argparse
import asyncio
import sys
import threading
from bleak import BleakClient

NUS_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
# micro:bit UART names these from the micro:bit's point of view:
# TX sends notifications to the Mac, while RX accepts writes from the Mac.
TX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"
RX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"


def stdin_reader(loop, queue):
    for line in sys.stdin:
        loop.call_soon_threadsafe(queue.put_nowait, line.rstrip("\r\n"))
    loop.call_soon_threadsafe(queue.put_nowait, None)


async def main(address):
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()
    threading.Thread(target=stdin_reader, args=(loop, queue), daemon=True).start()
    disconnected = asyncio.Event()

    def on_disconnect(_):
        loop.call_soon_threadsafe(disconnected.set)

    async with BleakClient(address, timeout=20, disconnected_callback=on_disconnect) as client:
        if not client.is_connected:
            raise RuntimeError("BLE接続に失敗しました")
        services = client.services
        service = services.get_service(NUS_UUID)
        if service is None:
            raise RuntimeError("選択した機器にNordic UARTサービスがありません")
        characteristics = list(service.characteristics)
        characteristic = next(
            (candidate for candidate in characteristics if candidate.uuid.lower() == RX_UUID),
            None,
        )
        for candidate in characteristics:
            if characteristic is not None:
                break
            if {"write", "write-without-response"} & set(candidate.properties):
                characteristic = candidate
                break
        if characteristic is None:
            details = ", ".join(
                candidate.uuid + "=" + "/".join(candidate.properties)
                for candidate in service.characteristics
            )
            raise RuntimeError("選択した機器に書き込み可能なUART RXがありません: " + details)
        rx_uuid = characteristic.uuid
        tx_characteristic = next(
            (candidate for candidate in characteristics if candidate.uuid.lower() == TX_UUID),
            None,
        )
        for candidate in characteristics:
            if tx_characteristic is not None:
                break
            if {"notify", "indicate"} & set(candidate.properties):
                tx_characteristic = candidate
                break
        if tx_characteristic is None:
            details = ", ".join(
                candidate.uuid + "=" + "/".join(candidate.properties)
                for candidate in characteristics
            )
            raise RuntimeError("選択した機器にUART TXがありません: " + details)

        receive_buffer = ""

        def on_notify(_, data):
            nonlocal receive_buffer
            receive_buffer += bytes(data).decode("utf-8", "replace")
            lines = receive_buffer.replace("\r", "").split("\n")
            receive_buffer = lines.pop()
            for line in lines:
                if line:
                    print("EVENT " + line, flush=True)

        await client.start_notify(tx_characteristic.uuid, on_notify)
        print("READY", flush=True)
        await client.write_gatt_char(rx_uuid, b"ID?\n", response=False)
        while True:
            command_task = asyncio.create_task(queue.get())
            disconnect_task = asyncio.create_task(disconnected.wait())
            done, pending = await asyncio.wait(
                {command_task, disconnect_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            if disconnect_task in done:
                raise RuntimeError("BLE接続が切断されました")
            command = command_task.result()
            if command is None:
                return
            data = (command + "\n").encode("utf-8")
            for offset in range(0, len(data), 20):
                await client.write_gatt_char(rx_uuid, data[offset:offset + 20], response=False)
            print("SENT " + command, flush=True)


parser = argparse.ArgumentParser()
parser.add_argument("--address", required=True)
args = parser.parse_args()
try:
    asyncio.run(main(args.address))
except KeyboardInterrupt:
    # npm/server停止時の通常終了。4台分のTracebackを表示しない。
    pass
except Exception as error:
    print("ERROR " + str(error), file=sys.stderr, flush=True)
    raise SystemExit(1)
