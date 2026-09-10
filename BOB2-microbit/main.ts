// MFT 2026「踊らにゃ損損」BOB2共通ファームウェア
// 4台すべてに同じHEXを書き込み、A+BでID 0～3を設定します。
// A=両腕を上げて保持、B=IDを2秒表示、ロゴ=両腕を下げて左右に旋回です。

const ID_KEY = "bob-id"
const UNSET_ID = 99
const LEFT_HOME_ANGLE = 30
const RIGHT_HOME_ANGLE = 30

let bobId = settings.exists(ID_KEY) ? settings.readNumber(ID_KEY) : UNSET_ID
if (bobId < 0 || (bobId > 3 && bobId != UNSET_ID)) {
    bobId = UNSET_ID
}

let connected = false
let gameActive = false
let randomDisplay = false
let displayRevision = 0
let currentDisplay = -1
let currentValue = 0

function stopMovement() {
    pins.digitalWritePin(DigitalPin.P13, 0)
    pins.digitalWritePin(DigitalPin.P14, 0)
    pins.digitalWritePin(DigitalPin.P15, 0)
    pins.digitalWritePin(DigitalPin.P16, 0)
}

function waitWhileActive(durationMs: number, revision: number): boolean {
    let elapsed = 0
    while (elapsed < durationMs) {
        if (!gameActive || revision != displayRevision) {
            stopMovement()
            return false
        }
        basic.pause(Math.min(20, durationMs - elapsed))
        elapsed += 20
    }
    return true
}

function moveForward(durationMs: number, revision: number): boolean {
    pins.digitalWritePin(DigitalPin.P13, 1)
    pins.digitalWritePin(DigitalPin.P14, 0)
    pins.digitalWritePin(DigitalPin.P15, 0)
    pins.digitalWritePin(DigitalPin.P16, 1)
    const completed = waitWhileActive(durationMs, revision)
    stopMovement()
    return completed
}

function moveBackward(durationMs: number, revision: number): boolean {
    pins.digitalWritePin(DigitalPin.P13, 0)
    pins.digitalWritePin(DigitalPin.P14, 1)
    pins.digitalWritePin(DigitalPin.P15, 1)
    pins.digitalWritePin(DigitalPin.P16, 0)
    const completed = waitWhileActive(durationMs, revision)
    stopMovement()
    return completed
}

function turnLeft(durationMs: number, revision: number): boolean {
    pins.digitalWritePin(DigitalPin.P13, 0)
    pins.digitalWritePin(DigitalPin.P14, 1)
    pins.digitalWritePin(DigitalPin.P15, 0)
    pins.digitalWritePin(DigitalPin.P16, 1)
    const completed = waitWhileActive(durationMs, revision)
    stopMovement()
    return completed
}

function turnRight(durationMs: number, revision: number): boolean {
    pins.digitalWritePin(DigitalPin.P13, 1)
    pins.digitalWritePin(DigitalPin.P14, 0)
    pins.digitalWritePin(DigitalPin.P15, 1)
    pins.digitalWritePin(DigitalPin.P16, 0)
    const completed = waitWhileActive(durationMs, revision)
    stopMovement()
    return completed
}

function startTurnLeft() {
    pins.digitalWritePin(DigitalPin.P13, 0)
    pins.digitalWritePin(DigitalPin.P14, 1)
    pins.digitalWritePin(DigitalPin.P15, 0)
    pins.digitalWritePin(DigitalPin.P16, 1)
}

function setArms(leftAngle: number, rightAngle: number) {
    servos.P2.setAngle(leftAngle)
    servos.P1.setAngle(rightAngle)
}

function moveHome() {
    stopMovement()
    setArms(LEFT_HOME_ANGLE, RIGHT_HOME_ANGLE)
}

function pauseMotion(durationMs: number, revision: number): boolean {
    return waitWhileActive(durationMs, revision)
}

function raiseBothArms() {
    // 万歳: 左腕P2=120度、右腕P1=60度。次の指示まで保持する。
    setArms(120, 60)
}

function showIdTest() {
    randomDisplay = false
    currentDisplay = -1
    showIdTemporarily(2000, true)
}

function lowerArmsAndTurnBothWays() {
    const resumeRandomDisplay = randomDisplay
    // 0度と180度で左右の下方向が逆になる。次の指示まで保持する。
    setArms(0, 180)
    displayRevision += 1
    const revision = displayRevision
    gameActive = true
    randomDisplay = false
    // LED表示には触れず、右0.2秒→左0.4秒→右0.2秒でその場に戻る。
    if (!turnRight(200, revision)) return
    if (!turnLeft(400, revision)) return
    if (!turnRight(200, revision)) return
    stopMovement()
    if (revision != displayRevision) return
    gameActive = false
    randomDisplay = resumeRandomDisplay
}

function runTest(testNumber: number) {
    if (testNumber == 0) raiseBothArms()
    else if (testNumber == 1) showIdTest()
    else if (testNumber == 2) lowerArmsAndTurnBothWays()
}

function danceWait(durationMs: number, level: number, revision: number): boolean {
    const adjusted = level == 1 ? Math.round(durationMs * 0.6) : durationMs
    return pauseMotion(adjusted, revision)
}

function danceCountdown(level: number, revision: number): boolean {
    basic.showIcon(IconNames.Yes)
    if (!waitWhileActive(1000, revision)) return false
    for (let number = 3; number >= 1; number--) {
        basic.showNumber(number)
        if (!waitWhileActive(500, revision)) return false
    }
    basic.showString("GO", 75)
    if (!gameActive || revision != displayRevision) return false
    basic.showIcon(IconNames.Happy)
    return true
}

function finishDance(revision: number) {
    if (revision != displayRevision || !gameActive) return
    stopMovement()
    gameActive = false
    currentDisplay = -1
    randomDisplay = false
    basic.clearScreen()
}

function showLeftFace() {
    basic.showLeds(`
        . . . . .
        . . # . #
        . . . . .
        # . . . #
        . # # # .
    `)
}

function showRightFace() {
    basic.showLeds(`
        . . . . .
        # . # . .
        . . . . .
        # . . . #
        . # # # .
    `)
}

// danceNo0: BOB ID 0「バイバイ」
function danceNo0(level: number) {
    const revision = displayRevision
    setArms(120, 60)
    if (!danceCountdown(level, revision)) return
    for (let index = 0; index < 5; index++) {
        servos.P1.setAngle(0)
        servos.P2.setAngle(70)
        if (!danceWait(500, level, revision)) return
        servos.P1.setAngle(110)
        servos.P2.setAngle(180)
        if (!danceWait(500, level, revision)) return
    }
    setArms(120, 60)
    finishDance(revision)
}

// danceNo1: BOB ID 1「左右フリフリ」
function danceNo1(level: number) {
    const revision = displayRevision
    servos.P1.setAngle(90)
    servos.P2.setAngle(90)
    if (!danceCountdown(level, revision)) return
    if (!turnLeft(100, revision)) return
    showRightFace()
    if (!danceWait(200, level, revision)) return
    for (let index = 0; index < 5; index++) {
        servos.P1.setAngle(150)
        servos.P2.setAngle(30)
        const turnDuration = level == 1 ? 120 : 200
        if (!turnRight(turnDuration, revision)) return
        showLeftFace()
        if (!danceWait(500, level, revision)) return
        servos.P1.setAngle(90)
        servos.P2.setAngle(90)
        if (!turnLeft(turnDuration, revision)) return
        showRightFace()
        if (!danceWait(500, level, revision)) return
    }
    setArms(120, 60)
    finishDance(revision)
}

// danceNo2: BOB ID 2「変なおじさん」
function danceNo2(level: number) {
    const revision = displayRevision
    servos.P1.setAngle(180)
    servos.P2.setAngle(0)
    if (!danceCountdown(level, revision)) return
    for (let index = 0; index < 5; index++) {
        servos.P1.setAngle(150)
        servos.P2.setAngle(30)
        if (!danceWait(100, level, revision)) return
        const wheelDuration = level == 1 ? 48 : 80
        if (!moveForward(wheelDuration, revision)) return
        if (!danceWait(800, level, revision)) return
        servos.P1.setAngle(180)
        servos.P2.setAngle(0)
        if (!danceWait(100, level, revision)) return
        if (!moveBackward(wheelDuration, revision)) return
        if (!danceWait(800, level, revision)) return
    }
    setArms(120, 60)
    finishDance(revision)
}

// danceNo3: BOB ID 3「上でバーン」
function danceNo3(level: number) {
    const revision = displayRevision
    servos.P1.setAngle(10)
    servos.P2.setAngle(170)
    if (!danceCountdown(level, revision)) return
    for (let counter = 0; counter <= 4; counter++) {
        if (counter == 3) startTurnLeft()
        servos.P1.setAngle(10)
        servos.P2.setAngle(170)
        if (!danceWait(1000, level, revision)) return
        servos.P1.setAngle(180)
        servos.P2.setAngle(0)
        if (!danceWait(400, level, revision)) return
    }
    if (!danceWait(2000, level, revision)) return
    setArms(120, 60)
    finishDance(revision)
}

// 最低限仕様の演技パターン0。各BOBは自身のIDに対応する演技を行う。
function playPattern0(level: number) {
    if (bobId == 0) danceNo0(level)
    else if (bobId == 1) danceNo1(level)
    else if (bobId == 2) danceNo2(level)
    else if (bobId == 3) danceNo3(level)
}

function showCryingFace() {
    basic.showLeds(`
        . # . # .
        # # . # #
        # . . . #
        . # # # .
        # . . . #
    `)
}

function showTriangle() {
    basic.showLeds(`
        . . # . .
        . # . # .
        . # . # .
        # . . . #
        # # # # #
    `)
}

function showCircle() {
    basic.showLeds(`
        . # # # .
        # . . . #
        # . . . #
        # . . . #
        . # # # .
    `)
}

function showDoubleCircle() {
    basic.showLeds(`
        . # # # .
        # . . . #
        # . # . #
        # . . . #
        . # # # .
    `)
}

function showExpandingRing(frame: number) {
    if (frame == 0) {
        basic.showLeds(`
            . . . . .
            . . . . .
            . . # . .
            . . . . .
            . . . . .
        `)
    } else if (frame == 1) {
        basic.showLeds(`
            . . . . .
            . . # . .
            . # . # .
            . . # . .
            . . . . .
        `)
    } else if (frame == 2) {
        basic.showLeds(`
            . . # . .
            . # . # .
            # . . . #
            . # . # .
            . . # . .
        `)
    } else {
        basic.showLeds(`
            # # # # #
            # . . . #
            # . . . #
            # . . . #
            # # # # #
        `)
    }
}

function showFinalPoints(points: number) {
    displayRevision += 1
    const revision = displayRevision
    gameActive = true
    randomDisplay = false
    currentDisplay = -1
    stopMovement()
    for (let frame = 0; frame < 4; frame++) {
        showExpandingRing(frame)
        if (!waitWhileActive(500, revision)) return
    }
    basic.clearScreen()
    if (points > 0 && bobId < points) {
        if (!waitWhileActive(bobId * 700, revision)) return
        showDoubleCircle()
    }
    gameActive = false
}

function celebrationWave() {
    displayRevision += 1
    const revision = displayRevision
    gameActive = true
    randomDisplay = false
    for (let index = 0; index < 3; index++) {
        servos.P1.setAngle(0)
        servos.P2.setAngle(90)
        if (!waitWhileActive(500, revision)) return
        servos.P1.setAngle(120)
        servos.P2.setAngle(180)
        if (!waitWhileActive(500, revision)) return
    }
    setArms(120, 60)
    gameActive = false
    currentDisplay = -1
    randomDisplay = connected && bobId != UNSET_ID
    if (randomDisplay) showRandomPattern()
    else if (!connected) basic.showIcon(IconNames.No)
}

function showScore(code: number) {
    if (code == 0) showCryingFace()
    else if (code == 1) showTriangle()
    else if (code == 2) showCircle()
    else showDoubleCircle()
}

function gradeLetter(code: number, id: number): string {
    const words = ["UNN.", "SOSO", "GOOD", "PERF"]
    if (code < 0 || code >= words.length || id < 0 || id > 3) return "?"
    return words[code].charAt(id)
}

function showDot() {
    basic.showLeds(`
        . . . . .
        . . . . .
        . . . . .
        . . # . .
        . . # . .
    `)
}

function showUnsetId() {
    basic.showLeds(`
        . # # # .
        # . . . #
        . # # # #
        . . . . #
        . # # # .
    `)
}

function renderPersistentDisplay() {
    if (currentDisplay == 2) showScore(currentValue)
    else if (currentDisplay == 3) {
        const letter = gradeLetter(currentValue, bobId)
        if (letter == ".") showDot()
        else basic.showString(letter)
    } else if (bobId == UNSET_ID) showUnsetId()
    else basic.clearScreen()
}

function sendId() {
    if (connected) bluetooth.uartWriteLine("ID," + bobId)
}

function showIdTemporarily(durationMs: number, returnToRandom: boolean) {
    displayRevision += 1
    const revision = displayRevision
    if (bobId == UNSET_ID) showUnsetId()
    else basic.showNumber(bobId)
    let elapsed = 0
    while (elapsed < durationMs && revision == displayRevision) {
        basic.pause(50)
        elapsed += 50
    }
    if (revision != displayRevision) return
    if (returnToRandom && bobId != UNSET_ID) {
        currentDisplay = -1
        randomDisplay = connected
        if (randomDisplay) showRandomPattern()
        else basic.showIcon(IconNames.No)
    } else {
        renderPersistentDisplay()
    }
}

function showRandomPattern() {
    const pattern = Math.randomRange(0, 3)
    if (pattern == 0) basic.showIcon(IconNames.Diamond)
    else if (pattern == 1) basic.showIcon(IconNames.Square)
    else if (pattern == 2) basic.showIcon(IconNames.SmallDiamond)
    else basic.showIcon(IconNames.Chessboard)
}

function complete() {
    displayRevision += 1
    gameActive = false
    randomDisplay = false
    currentDisplay = -1
    stopMovement()
    basic.clearScreen()
}

function executeCommand(fields: string[]) {
    const command = parseInt(fields[0])

    // ID未設定でも、安全停止と初期位置だけは受け付けます。
    if (bobId == UNSET_ID && command != 4 && command != 5 && command != 6) {
        showUnsetId()
        return
    }

    if (command == 0 && fields.length >= 3) {
        displayRevision += 1
        gameActive = true
        randomDisplay = false
        currentDisplay = 0
        const motion = parseInt(fields[1])
        const level = parseInt(fields[2])
        if (motion == 0) playPattern0(level)
    } else if (command == 1 && fields.length >= 2) {
        const targetId = parseInt(fields[1])
        if (targetId == bobId) {
            gameActive = true
            randomDisplay = false
            currentDisplay = 1
            showIdTemporarily(5000, false)
            if (currentDisplay == 1) basic.clearScreen()
        }
    } else if (command == 2 && fields.length >= 2) {
        displayRevision += 1
        gameActive = true
        randomDisplay = false
        currentDisplay = 2
        currentValue = parseInt(fields[1])
        showScore(currentValue)
    } else if (command == 3 && fields.length >= 2) {
        let points = parseInt(fields[1])
        if (points < 0) points = 0
        if (points > 4) points = 4
        showFinalPoints(points)
    } else if (command == 4) {
        complete()
    } else if (command == 5) {
        displayRevision += 1
        gameActive = false
        currentDisplay = -1
        moveHome()
        randomDisplay = bobId != UNSET_ID
        if (bobId == UNSET_ID) showUnsetId()
    } else if (command == 6 && fields.length >= 2 && !gameActive) {
        runTest(parseInt(fields[1]))
    } else if (command == 7) {
        celebrationWave()
    }
}

input.onButtonPressed(Button.A, function () {
    if (!gameActive) runTest(0)
})

input.onButtonPressed(Button.B, function () {
    if (!gameActive) runTest(1)
})

input.onButtonPressed(Button.AB, function () {
    if (gameActive) return
    if (bobId == UNSET_ID) bobId = 0
    else bobId = (bobId + 1) % 4
    settings.writeNumber(ID_KEY, bobId)
    sendId()
    randomDisplay = false
    showIdTemporarily(2000, true)
})

input.onLogoEvent(TouchButtonEvent.Pressed, function () {
    if (!gameActive) runTest(2)
})

bluetooth.onBluetoothConnected(function () {
    connected = true
    gameActive = false
    currentDisplay = -1
    randomDisplay = bobId != UNSET_ID
    sendId()
    if (bobId == UNSET_ID) showUnsetId()
    else if (randomDisplay) showRandomPattern()
})

bluetooth.onBluetoothDisconnected(function () {
    connected = false
    displayRevision += 1
    gameActive = false
    randomDisplay = false
    stopMovement()
    basic.showIcon(IconNames.No)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let line = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
    if (line.length > 0 && line.charAt(line.length - 1) == "\r") {
        line = line.substr(0, line.length - 1)
    }
    if (line == "ID?") {
        sendId()
        return
    }
    if (line.length > 0) executeCommand(line.split(","))
})

bluetooth.startUartService()
stopMovement()
if (bobId == UNSET_ID) showUnsetId()
else basic.showIcon(IconNames.No)

basic.forever(function () {
    if (connected && randomDisplay && !gameActive && bobId != UNSET_ID) {
        showRandomPattern()
    }
    basic.pause(1000)
})
