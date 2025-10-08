# 作成したいfire pockerについて

## アイデア詳細

fire pockerをこのプロジェクトでは作成したいです。

ただし、このfire pockerはフィボナッチ数列でストーリーポイントを入力する以外に以下の特徴があります

1. NotionのDBと連携する
   - PBIのDB一覧のNotionDB
   - PBI管理DBのNotionDB
2. Notion DBから見積もりをするPBIの項目を取得でき、画面に表示できる
3. Notion DBから同じストーリーポイントのチケットを過去10個分まで取得し、同様のストーリーポイントのPBIがわかる

## 技術スタック

- インフラ
   - terraform
   - lambda web adapter

- フロント
   - Next.js