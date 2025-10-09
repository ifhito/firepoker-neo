# Fire Pocker Neo

Fire Pocker Neo は、Notion のプロダクトバックログアイテム (PBI) を取り込み、プランニングポーカーでの見積もりを支援する Next.js 14 ベースのプロトタイピングリポジトリです。OpenAPI 仕様、アーキテクチャ設計、開発タスクのメモをコードとして具現化し、フロントエンド/バックエンド/API 層の境界と役割を確認できます。

## プロジェクト構成

- **Next.js App Router**: `app/` ディレクトリ配下にダッシュボード・セッション・設定画面を配置。
- **API Route Handlers**: `app/api/*` で Notion 連携を想定した REST API をモック実装。
- **ドメインモデル**: `src/domain` に PBI やセッション状態の TypeScript 型を定義。
- **Notion アダプタ**: `src/server/notion` で環境変数の検証とモッククライアントを管理。
- **セッションストア**: `src/server/session` に Redis 代替のインメモリストアとシードデータを実装。
- **モックデータ**: `src/mocks` にサンプル PBI を定義し、API や UI に供給。

## 主なエンドポイント

| Method | Path | 説明 |
| ------ | ---- | ---- |
| `GET` | `/api/pbis` | PBI 一覧の検索。クエリ `status`, `search` をサポート。
| `GET` | `/api/pbis/{id}/similar` | 同一ストーリーポイントの類似 PBI を最大 10 件返却。
| `POST` | `/api/sessions` | セッション作成。モックストアに状態を保存し、`joinToken` を発行。
| `POST` | `/api/sessions/{id}/finalize` | 見積もり確定。Notion 書き込みの代わりにモックレスポンスを返却。

## 開発コマンド

```bash
pnpm install
pnpm dev      # 開発サーバー起動 (http://localhost:3000)
pnpm lint     # ESLint (next/core-web-vitals + prettier)
pnpm typecheck
```

> **NOTE:** 実際の Notion API 接続は未実装です。環境変数が設定されていない場合は、自動的にモッククライアントが選択されます。

## 今後の拡張ポイント

- Notion API クライアントの本実装とキャッシュ戦略。
- WebSocket サーバー (Fastify + ws) とのリアルタイム連携。
- Redis への移行と永続化オプションの検討。
- Terraform / GitHub Actions による IaC & CI/CD パイプラインの整備。
