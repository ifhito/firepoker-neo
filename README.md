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
pnpm test     # 単体テスト (Vitest)
pnpm test:run # CI 向けテスト実行 (終了コード重視)
pnpm test:coverage # カバレッジレポート生成
```

> **NOTE:** 環境変数が未設定の場合はモックデータを使用します。Notion 連携を有効にする際は [Notion 連携の設定](#notion-連携の設定) を参照してください。

## Notion 連携の設定

下記の環境変数を `.env.local` もしくはプロジェクト設定に追加すると、実際の Notion DB から PBI を取得できます。

```
NOTION_TOKEN=secret_xxx                        # Notion インテグレーションのシークレット
NOTION_PBI_DB_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx  # PBI 一覧データベース ID
NOTION_SESSION_DB_ID=yyyyyyyyyyyyyyyyyyyyyyyy  # (任意) セッション履歴を保存する DB ID
NOTION_PBI_TITLE_PROPERTY=Title                # (任意) タイトル列名
NOTION_PBI_STATUS_PROPERTY=Status              # (任意) ステータス列名
NOTION_PBI_STORYPOINT_PROPERTY=StoryPoint      # (任意) ストーリーポイント列名
NOTION_PBI_ASSIGNEE_PROPERTY=Assignee          # (任意) 担当者列名
NOTION_PBI_EPIC_PROPERTY=Epic                  # (任意) エピック列名
NOTION_PBI_LASTESTIMATED_PROPERTY=LastEstimatedAt # (任意) 最終見積り日時列名
```

プロパティ名は設計書通り `Title`, `Status`, `StoryPoint`, `Assignee`, `Epic`, `LastEstimatedAt` を想定しています。値が取得できない場合はモックデータに自動フォールバックします。

### データベース共有手順

1. Notion で対象の PBI データベースを開き、右上の **Share** → **Connect** から今回作成したインテグレーションを招待します。共有しないと API からは 404/403 が返ります。
2. `.env.local` に環境変数を設定し、`pnpm dev` を再起動します。
3. 列タイプは以下を推奨します（テキスト等でも動作しますが、型に応じて自動的にフィルターが調整されます）。

| 列名 (デフォルト) | 推奨 Notion 型 | 備考 |
| ----------------- | -------------- | ---- |
| Title              | Title          | Notion 既定列 |
| Status             | Select / Multi-select | 指定があればフィルタに使用 |
| StoryPoint         | Number         | 見積もり値 |
| Assignee           | People / Text  | 任意 |
| Epic               | Select / Text  | 任意 |
| LastEstimatedAt    | Date           | 無ければソートされません |

設定画面 (`/settings`) では、取得済みの環境変数とプロパティ名を確認できます。

## 今後の拡張ポイント

- Notion API クライアントの本実装とキャッシュ戦略。
- WebSocket サーバー (Fastify + ws) とのリアルタイム連携。
- Redis への移行と永続化オプションの検討。
- Terraform / GitHub Actions による IaC & CI/CD パイプラインの整備。
