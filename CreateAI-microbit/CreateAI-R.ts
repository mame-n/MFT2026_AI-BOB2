// 右手用CreateAI micro:bit。
// radio group 96で、右手モデルの一致度だけをCtrlMbitへ送信する。
// D0R: バイバイ
// D1R: 左右フリフリ
// D2R: 変なおじさん
// D3R: 上でバーン

radio.setGroup(96)
basic.showArrow(ArrowNames.West)

basic.forever(function () {
    radio.sendValue("d0-R", ml.getCertainty(ml.event.D0R))
    basic.pause(50)
    radio.sendValue("d1-R", ml.getCertainty(ml.event.D1R))
    basic.pause(50)
    radio.sendValue("d2-R", ml.getCertainty(ml.event.D2R))
    basic.pause(50)
    radio.sendValue("d3-R", ml.getCertainty(ml.event.D3R))
    basic.pause(50)
    radio.sendValue("idle-R", ml.getCertainty(ml.event.Idle))
    basic.pause(50)
})
