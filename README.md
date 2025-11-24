# Fire Pocker Neo Monorepo

このリポジトリは 2 つの実行コンテキストに分割されました。

- `container/` — 既存の Next.js + Socket.IO 実装。Docker/ECS を想定したコンテナ配下のコード・ドキュメントを格納。
- `serverless/` — Lambda/WebSocket(API Gateway) と CSR Next.js (S3 配信) を収めたサーバーレス構成。

開発コマンドはルートの `package.json` にまとまっており、`pnpm` からそれぞれを操作できます。

```bash
# Next.js 側のローカル開発
pnpm dev

# Serverless CSR フロントエンド
pnpm dev:serverless

# サーバーレス WebSocket ハンドラの単体テスト
pnpm vitest run serverless/tests/websocketHandler.test.ts
```

S3/CloudFront へアップロードする静的資産は `pnpm export:serverless` で生成できます。  
詳細なドキュメントは `container/README.md` および `serverless/README.md` を参照してください。
