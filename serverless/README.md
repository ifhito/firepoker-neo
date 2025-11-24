# Serverless Stack

API Gateway(WebSocket) + Lambda をバックエンドに、S3 + CloudFront へ配置可能な CSR Next.js フロントエンドを `serverless/` 以下に集約しました。既存のコンテナ向けアプリは `container/` に残っているため、両構成を並行して評価できます。

## ディレクトリ構成

- `src/websocketHandler.ts` – WebSocket ルートラムダ。`$connect` / `$disconnect` / `$default` を処理し、Notion 連携を担当。
- `web/` – 完全 CSR モードの Next.js アプリ。ビルド時に `output: 'export'` を有効化して S3 静的ホスティングに対応。
- `tests/` – Lambda・Web クライアント双方のユニットテスト。

## Web クライアント (CSR)

`web/app/page.tsx` は `use client` ベースで動作し、ブラウザから直接 API Gateway WebSocket に接続して PBIs の取得やストーリーポイント更新を行います。環境変数を通じてエンドポイントを切り替え可能です。

- `NEXT_PUBLIC_WS_ENDPOINT` – API Gateway WebSocket エンドポイント (例: `wss://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod`)
- `NEXT_PUBLIC_REST_ENDPOINT` – REST Lambda を利用する場合のベース URL (将来の拡張用、既定値は `http://localhost:3000`)

### ローカル開発

```bash
pnpm dev:serverless
```

### 静的ビルド & エクスポート

```bash
pnpm build:serverless
pnpm export:serverless               # S3 へアップロードする `serverless/web/out` を生成
pnpm export:serverless -- --outputs serverless/terraform/dev.outputs.json --stage dev
                                      # Terraform の output(JSON) から NEXT_PUBLIC_* を注入
```

生成された `out/` ディレクトリをご自身の S3 バケットへデプロイし、CloudFront などの CDN と組み合わせて公開できます。

`pnpm export:serverless` は `serverless/scripts/export-with-outputs.cjs` を経由し、`terraform output -json` の結果を保存したファイルから
`ws_endpoint` や `static_site_domain` を読み取ります。CI では `terraform output -json > serverless/terraform/dev.outputs.json`
のように書き出し、ステージ名を `--stage` で渡すと固定の CloudFront URL / WebSocket エンドポイントがビルドへ埋め込まれます。

## Lambda WebSocket

1. API Gateway が Lambda へ WebSocket イベントを転送。
2. `handleEvent` がイベントタイプを判定し、`listPbis` / `updateStoryPoint` などのアクションを Notion クライアントへ委譲。
3. 応答は API Gateway Management API 経由でクライアント接続へ送信します (`WS_CALLBACK_ENDPOINT` が未指定ならイベントから URL を計算)。

### テスト

```bash
pnpm vitest run serverless/tests/websocketHandler.test.ts
pnpm vitest run serverless/tests/websocketConfig.test.ts
```

## デプロイのヒント

- Lambda には `NOTION_TOKEN`, `NOTION_PBI_DB_ID` などを設定し、`getNotionClient` が REST/モック切り替えを行う。
- WebSocket への応答 URL を固定する場合は `WS_CALLBACK_ENDPOINT` を指定。
- CloudFormation/Terraform 側では `$connect` / `$disconnect` / `$default` ルートを本 Lambda に割り当ててください。
