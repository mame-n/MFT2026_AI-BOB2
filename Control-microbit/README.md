# CtrlMbitファームウェア

右手用・左手用CreateAI micro:bitからradio group 96で受け取った一致度を、USB SerialでMBPへ中継します。

## 書き込みファイル

`CtrlMbit.hex`

## 正規形式

CreateAIから受信するKey・Value:

```text
d0-R = 83
d3-L = 69
idle-R = 21
```

MBPへ送るUSB Serial:

```text
danceNo0-R:83
danceNo3-L:69
idle-R:21
```

`radio.sendValue`のKeyは最大8文字なので、CreateAI側では`d0-R`〜`d3-R`、`d0-L`〜`d3-L`、`idle-R`、`idle-L`を使用します。CtrlMbitがUSB Serialへ出すときだけ`danceNo0-R`〜`danceNo3-L`へ展開します。`idle`はWebAppの診断表示だけに使い、採点対象外です。

CreateAI側のソースとHEXは`../CreateAI-microbit/`にあります。
