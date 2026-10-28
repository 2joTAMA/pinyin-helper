# 拼音帮手

中国語（簡体字）を入力すると、下にピンインが自動表示される個人用ツール。

## ファイル構成

| パス | 中身 |
|---|---|
| `index.html` | 画面の骨組み（HTML）と、スクリプトの読み込み順 |
| `style.css` | アプリのスタイル |
| `js/core.js` | 共通部品：画面の要素、表示設定、ピンイン変換、保存データ、どのページでも使う部品 |
| `js/input-page.js` | 入力ページ：文章とピンインの表示、元に戻す、保存・タイトル、ファイルを開く／新規 |
| `js/list-page.js` | 保存一覧ページ：バックアップ、フォルダとファイルの一覧、スワイプ・並び替え |
| `js/wordbook-page.js` | 単語帳ページ：並び替え、選択モード、単語カード |
| `js/all-kanji-page.js` | 全漢字ページ：漢字カード、漢字の削除（長押し）、単語シート |
| `js/app.js` | アプリ全体：表示切り替えボタン、タブの切り替え、起動 |
| `vendor/pinyin-pro.min.js` | 漢字→ピンイン変換ライブラリ [pinyin-pro](https://github.com/zh-lx/pinyin-pro)（配布版をそのまま置いている） |
| `data/kanji-map.js` | 日本の字体→簡体字の対応表 `KANJI_MAP`（入力した日本語の漢字を中国語の字に直す） |
| `data/ja-glyphs.js` | 「日本漢字」表示の例外（そのまま表示する字 `JA_KANJI_NO_CONVERT`、使う字形を指定する字 `JA_KANJI_PREFERRED`） |
| `data/char-freq.js` | 漢字の出現頻度順 `CHAR_FREQ_ORDER`（全漢字ページの並び順に使う） |
| `data/custom-words.js` | 読み・軽声を補正するカスタム辞書 `CUSTOM_WORDS` |
| `images/` | ホーム画面アイコンと背景画像 |
| `sw.js` | Service Worker。アプリのファイルを端末に保存して、オフラインでも起動できるようにする（ファイルを増減したら中の `PRECACHE_URLS` と `CACHE_NAME` を更新する） |
| `manifest.webmanifest` | アプリ名・アイコン・全画面表示の設定 |

## 公開方法（GitHub Pages）

1. このリポジトリの Settings → Pages を開く
2. "Source" を `Deploy from a branch` にする
3. Branch を `main` / フォルダを `/(root)` にして Save
4. 数分待つと `https://（ユーザー名）.github.io/（リポジトリ名）/` で公開される

## 使い方

公開されたURLをiPhoneのSafariで開き、共有ボタン →「ホーム画面に追加」でアイコン化できる。
