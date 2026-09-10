# BOB2 AI Dancing 運用マニュアル

## 1. 必要なもの

- MacBook Pro
- BOB2 4台と、それぞれに搭載するmicro:bit
- CreateAI用micro:bit 2台（左腕用・右腕用）
- Control用micro:bit 1台
- DJ2GO2 1台
- USBケーブル、BOB2用電源、CreateAIを腕へ装着するバンド
- Node.js 18以降、Python 3、ChromeまたはEdge

## 2. micro:bitへ書き込む

| 対象 | 台数 | HEX |
|---|---:|---|
| BOB2 | 4 | `BOB2-microbit/BOB2mbit-common.hex` |
| Control | 1 | `Control-microbit/CtrlMbit.hex` |
| CreateAI 左腕 | 1 | `CreateAI-microbit/CreateAI-L.hex` |
| CreateAI 右腕 | 1 | `CreateAI-microbit/CreateAI-R.hex` |

micro:bitをUSB接続し、対応するHEXを`MICROBIT`ドライブへコピーする。BOB2の4台には同じHEXを書き込む。TSを変更する場合はMakeCodeで対応プロジェクトを開き、再コンパイルしたHEXも同じフォルダーへ保存する。

## 3. BOB2のIDを設定する

1. 4台のBOB2へ電源を入れる。
2. 未設定を示す「9」が出た機体ではA+Bを押す。
3. A+Bを押すたび、IDが0、1、2、3、0の順に変わる。
4. 4台へ重複しないID 0〜3を設定する。
5. Bボタンを押し、各IDを確認する。

設定したIDは電源を切っても保持される。Aは万歳位置の確認、ロゴは腕と車輪の簡易動作確認に使える。

## 4. Webアプリを準備する

初回だけ、ターミナルで次を実行する。

```bash
cd WebApp
python3 -m venv .venv
.venv/bin/pip install -r ble/requirements.txt
```

起動時は次を実行する。

```bash
cd WebApp
npm start
```

ChromeまたはEdgeで `http://localhost:4173` を開く。macOSからBluetoothの利用許可を求められた場合は許可する。

## 5. 機器を接続する

1. Control micro:bitをUSB接続し、画面の「Ctrl micro:bit 接続」を押してシリアルポートを選ぶ。
2. DJ2GO2をUSB接続し、「DJ2GO2 接続」を押す。
3. BOB2へ電源を入れ、「接続管理」を開く。
4. 「すべて接続」、または候補ごとの「この1台を接続」で4台を接続する。
5. 画面が`4 / 4台`となり、ID 0〜3が表示されることを確認する。
6. 左右のCreateAIを装着する。LEDの矢印は、右腕用が左向き、左腕用が右向きに見える。
7. CreateAI受信診断で`d0-L/R`〜`d3-L/R`と`idle-L/R`が更新されることを確認する。

## 6. ゲームを実行する

- DJ2GO2左側PLAY、または画面の初級で開始: 初級
- DJ2GO2右側PLAY、または画面の上級で開始: 上級
- どちらかのCUE、または画面の中断: 即時中断
- 画面の初期位置: 車輪を止め、BOB2の腕を30度へ移動

開始後、参加者は対象BOB2のチェックとカウントダウンを見て、BOB2の動きをまねる。4台終了後、Web画面とBOB2のLEDで結果を確認する。

## 7. 終了する

1. ゲーム中なら「中断」を押す。
2. ターミナルで`Ctrl+C`を押し、Webアプリを終了する。
3. BOB2とCreateAIの電源を切る。
4. USB機器を取り外す。

## 8. トラブル対応

### BOB2が見つからない

1. BOB2背面のリセットを押す。
2. ID未設定ならA+Bで設定する。
3. macOSのBluetooth設定に`BBC micro:bit`が登録済みなら登録を解除する。
4. 電池を外して10秒待ち、再接続する。
5. Webアプリを再起動し、もう一度スキャンする。

### CreateAIの値が届かない

- Control micro:bitがWeb Serialで接続済みか確認する。
- 3台ともradio group 96のファームウェアか確認する。
- CreateAI受信診断のRAW欄を確認する。
- 左右のHEXを入れ違えていないか確認する。

### BOB2が意図せず動く

画面またはDJ2GO2のCUEで中断する。反応しなければBOB2の電源を切り、車輪を浮かせた状態で原因を確認する。

## 9. 本番前チェック

- [ ] BOB2 4台のIDが0〜3で重複していない
- [ ] BOB2のA・B・ロゴ動作が正常
- [ ] Controlと左右CreateAIの値が画面へ届く
- [ ] DJ2GO2のPLAYとCUEが動く
- [ ] BOB2が4台ともBLE接続済み
- [ ] 初級・上級・中断・最終表示を確認済み
- [ ] ケーブル、電池、予備電源を準備済み

正式な試験手順と過去結果は[SFT.md](SFT.md)を参照する。
