// CreateAI micro:bit 2台から受信した左右別の一致度を、
// USB SerialでMBPへそのまま中継するCtrl micro:bit共通ファームウェア。

radio.setGroup(96)
serial.redirectToUSB()

function danceIndex(name: string): number {
    // radio.sendValueのKey上限は8文字。CreateAIの正規Keyはd0-R～d3-Lとする。
    if (name == "d0-R" || name == "d0-L") return 0
    if (name == "d1-R" || name == "d1-L") return 1
    if (name == "d2-R" || name == "d2-L") return 2
    if (name == "d3-R" || name == "d3-L") return 3
    return -1
}

function sourceSide(name: string): string {
    if (name.charAt(name.length - 1) == "R") return "R"
    if (name.charAt(name.length - 1) == "L") return "L"
    return ""
}

radio.onReceivedValue(function (name: string, value: number) {
    const side = sourceSide(name)
    if (side == "") return

    if (name == "idle-R" || name == "idle-L") {
        serial.writeLine("idle-" + side + ":" + value)
        return
    }

    const index = danceIndex(name)
    if (index < 0) return

    // USB Serialには読みやすい正規名へ展開する。
    // 例: danceNo0-R:83 / danceNo3-L:69
    serial.writeLine("danceNo" + index + "-" + side + ":" + value)
})

basic.showIcon(IconNames.Yes)
