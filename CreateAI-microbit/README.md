# CreateAI micro:bit

参加者の左腕・右腕に装着し、CreateAIの一致度をmicro:bit radio group 96でControl micro:bitへ送ります。

| 側 | TypeScript | 書き込み用HEX | 起動表示 |
|---|---|---|---|
| 左腕 | `CreateAI-L.ts` | `CreateAI-L.hex` | 右矢印 |
| 右腕 | `CreateAI-R.ts` | `CreateAI-R.hex` | 左矢印 |

各モデルは4動作と`idle`を持ちます。TSをMakeCodeで変更した場合は、対応するCreateAI学習モデルを含めてコンパイルし、HEXも更新してください。
