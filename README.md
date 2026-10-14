# 拼音帮手

中国語（簡体字）を入力すると、下にピンインが自動表示される個人用ツール。

## ファイル構成

| パス | 中身 |
|---|---|
| `index.html` | アプリ本体（HTML・CSS・JS） |
| `vendor/pinyin-pro.min.js` | 漢字→ピンイン変換ライブラリ [pinyin-pro](https://github.com/zh-lx/pinyin-pro)（配布版をそのまま置いている） |
| `data/kanji-map.js` | 日本の字体→簡体字の対応表 `KANJI_MAP` |
| `data/char-freq.js` | 漢字の出現頻度順 `CHAR_FREQ_ORDER`（全漢字ページの並び順に使う） |
| `data/custom-words.js` | 読み・軽声を補正するカスタム辞書 `CUSTOM_WORDS` |
| `images/` | ホーム画面アイコンと背景画像 |

## 公開方法（GitHub Pages）

1. このリポジトリの Settings → Pages を開く
2. "Source" を `Deploy from a branch` にする
3. Branch を `main` / フォルダを `/(root)` にして Save
4. 数分待つと `https://（ユーザー名）.github.io/（リポジトリ名）/` で公開される

## 使い方

公開されたURLをiPhoneのSafariで開き、共有ボタン →「ホーム画面に追加」でアイコン化できる。
