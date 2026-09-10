# BOB2 AI Dancing

> 見て、まねして、一緒に踊る。AIと4台のBOB2によるダンス・チャレンジ。

![BOB2 AI Dancing システム構成](Images/system-diagram.png)

CreateAIを搭載した2台のmicro:bitが人の両腕の動きを認識し、4台のBOB2が披露するダンスとの一致度をWebアプリで採点します。DJ2GO2をゲームコントローラーとして使う、Maker Faire Tokyo 2026向けの実験的な作品です。

このリポジトリは、未完成ながらMFT 2026時点の作品を再現できる形で残した記録です。

## 構成

- [`BOB2-microbit/`](BOB2-microbit/): 4台のBOB2共通ファームウェアとHEX
- [`CreateAI-microbit/`](CreateAI-microbit/): 左右の腕に装着するCreateAI用TSとHEX
- [`Control-microbit/`](Control-microbit/): radioをUSB Serialへ中継するファームウェアとHEX
- [`WebApp/`](WebApp/): ゲーム進行、採点、DJ2GO2、BLE接続を担うWebアプリ

詳しい動作は[仕様書](SPECIFICATION.md)、設営・起動方法は[運用マニュアル](MANUAL.md)を参照してください。試験結果は[SFT](SFT.md)、制作の経緯は[作業録](作業録.md)に残しています。

## 起動

```bash
cd WebApp
python3 -m venv .venv
.venv/bin/pip install -r ble/requirements.txt
npm start
```

ChromeまたはEdgeで `http://localhost:4173` を開きます。実機なしでもデモモードで画面とゲーム進行を確認できます。

## Project status

MFT 2026 snapshot / work in progress. 未解決事項は[Issueリスト](Issueリスト.md)に記録しています。
