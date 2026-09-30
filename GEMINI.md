# Kyushu University Syllabus Site (campusmate改善) - Project Summary

## プロジェクトの概要
九州大学のシラバスシステム（ku-portal）からシラバスデータを自動的にスクレイピングし、静的サイトとして一覧・検索できるWebページ（`index.html`）を生成・更新するためのプロジェクトです。

## 主なファイルと役割
- **`update.sh`**: データの取得、検証、HTMLの更新、Gitへのコミットからプッシュまでの一連のワークフローを自動化するメインのシェルスクリプト。
- **`scrape.py`**: シラバスの取得を行うPythonスクリプト。並列処理（workers）や途中再開に対応しており、シラバス一覧および講義ごとの詳細ページ（HTML）を取得し、JSON形式に変換・保存します。
- **`check_data.py`**: 取得したJSONデータ（`index.json`、`btable.json`など）に欠損や構造の異常がないかを点検します。
- **`build_boilerplate.py` / `import_btable.py` / `plan_dump.py`**: スクレイピングしたデータを基に、Webサイト側で使いやすい形にデータを加工・整形するスクリプト群です。
- **`index.html`**: シラバスデータを表示するためのWeb画面（フロントエンド）。`update.sh` によって最終更新日などが動的に書き換えられます。
- **`data/` ディレクトリ**: スクレイピングした生データ（HTML）や、解析済みの詳細JSONデータ（`detail/`）が保存される場所です。

## ワークフローの仕組み
`update.sh` に引数を渡すことで処理内容を制御します。
- `./update.sh` : 通信を行わず、取得済みデータの整形、点検、HTMLの更新、コミット（確認あり）を行います。
- `./update.sh --fetch` : `scrape.py` を呼び出して不足分のデータをku-portalから新規取得（スクレイピング）します。
- `./update.sh --push` : 変更をコミットしたあとに、`main` ブランチへ自動的に `git push` を行います。

## 技術スタック
- **言語**: Python 3, Bash, HTML/JavaScript
- **主なPythonライブラリ (`requirements.txt`)**: `requests`, `beautifulsoup4`, `lxml` (スクレイピング用)、`pdfplumber` (PDF解析用)

## 開発・運用ルール
- **ブランチとプルリクエスト**: 作業を行う際は、直接 `main` ブランチを編集せず、必ず**新しいブランチを切って作業**を行い、完了後に**プルリクエスト（PR）を作成**すること。このフローを厳守してください。
作業は、ブランチを切ってプルリクエストを作成するようにしてください。（ブランチを切る→プルリクエスト作成の流れは絶対にそうようにしてください。）
