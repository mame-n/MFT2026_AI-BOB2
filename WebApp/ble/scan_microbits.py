#!/usr/bin/env python3
import asyncio
import argparse
import json
from bleak import BleakScanner

NUS_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"


async def main(list_all=False):
    found = {}

    def detected(device, advertisement):
        address = device.address
        name = advertisement.local_name or device.name or ""
        uuids = [value.lower() for value in (advertisement.service_uuids or [])]
        identified = NUS_UUID in uuids or "micro:bit" in name.lower()
        found[address] = {
            "address": address,
            "name": name or "名前なし",
            "rssi": advertisement.rssi,
            "serviceUuids": uuids,
            "manufacturerIds": list(advertisement.manufacturer_data.keys()),
            "identified": identified,
        }

    scanner = BleakScanner(detected)
    await scanner.start()
    await asyncio.sleep(8)
    await scanner.stop()
    identified = [item for item in found.values() if item["identified"]]
    # MakeCode BLEが名前/UUIDを広告しない場合だけ、会社IDを持たない名前なし機器を
    # 候補にする。Appleの会社ID (76) など周囲の無関係な機器は表示しない。
    fallback = [
        item for item in found.values()
        if item["name"] == "名前なし" and not item["manufacturerIds"]
    ]
    devices = found.values() if list_all else (identified or fallback)
    devices = sorted(devices, key=lambda item: item["rssi"] or -999, reverse=True)
    print(json.dumps(devices, ensure_ascii=False))


parser = argparse.ArgumentParser()
parser.add_argument("--all", action="store_true")
args = parser.parse_args()
asyncio.run(main(args.all))
