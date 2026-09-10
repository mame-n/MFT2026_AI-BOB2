// 左手用CreateAI micro:bit。
// radio group 96で、左手モデルの一致度だけをCtrlMbitへ送信する。
// D0L: バイバイ
// D1L: 左右フリフリ
// D2L: 変なおじさん
// D3L: 上でバーン

radio.setGroup(96)
basic.showArrow(ArrowNames.East)

basic.forever(function () {
    radio.sendValue("d0-L", ml.getCertainty(ml.event.D0L))
    basic.pause(50)
    radio.sendValue("d1-L", ml.getCertainty(ml.event.D1L))
    basic.pause(50)
    radio.sendValue("d2-L", ml.getCertainty(ml.event.D2L))
    basic.pause(50)
    radio.sendValue("d3-L", ml.getCertainty(ml.event.D3L))
    basic.pause(50)
    radio.sendValue("idle-L", ml.getCertainty(ml.event.Idle))
    basic.pause(50)
})
