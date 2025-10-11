# Fire Pocker Neo

Fire Pocker Neo は、Notion のプロダクトバックログアイテム (PBI) を取り込み、プランニングポーカーでの見積もりを支援する Next.js 14 ベースのプロトタイピングリポジトリです。OpenAPI 仕様、アーキテクチャ設計、開発タスクのメモをコードとして具現化し、フロントエンド/バックエンド/API 層の境界と役割を確認できます。

## プロジェクト構成

- **Next.js App Router**: `app/` ディレクトリ配下にダッシュボード・セッション・設定画面を配置。
- **API Route Handlers**: `app/api/*` で Notion 連携を想定した REST API をモック実装。
- **React Query Provider**: `src/components/providers/ReactQueryProvider.tsx` でクライアント側データ取得を管理。
- **ドメインモデル**: `src/domain` に PBI やセッション状態の TypeScript 型を定義。
- **Notion アダプタ**: `src/server/notion` で環境変数の検証とモッククライアントを管理。
- **セッションストア**: `src/server/session` は Redis (ioredis) に状態を保持し、テスト時は `ioredis-mock` にフォールバック。
- **セッション管理 UI**: セッション画面から PBI の追加・削除、アクティブ PBI の切り替えが可能。
- **モックデータ**: `src/mocks` にサンプル PBI を定義し、API や UI に供給。

## 主なエンドポイント

| Method | Path | 説明 |
| ------ | ---- | ---- |
| `GET` | `/api/pbis` | PBI 一覧の検索。クエリ `status`, `search` をサポート。
| `GET` | `/api/pbis/{id}/similar` | 同一ストーリーポイントの類似 PBI を最大 10 件返却。
| `POST` | `/api/sessions` | セッション作成。モックストアに状態を保存し、`joinToken` を発行。
| `POST` | `/api/sessions/{id}/finalize` | 見積もり確定。Notion のストーリーポイントを更新し、履歴 DB に追記（設定時）。


### WebSocket について

`ws://localhost:3000/api/ws?sessionId=<ID>&token=<joinToken>` に接続すると、セッション状態のリアルタイム同期が利用できます。クライアントからは `state_sync` / `vote_cast` などのイベントを JSON で送信します。実装はローカル開発向けの簡易サーバーなので、本番運用時は Fastify 版などに差し替えてください。

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

## Redis / Notion の設定

### Redis

セッション状態は Redis に保存されます。開発中は `REDIS_URL` が未設定でも `redis://127.0.0.1:6379` に接続します。インスタンスを用意できない場合は、`USE_REDIS_MOCK=true` を環境変数に指定すると `ioredis-mock` が使用されます。

```
REDIS_URL=redis://localhost:6379  # 任意。指定が無い場合はローカルホストへ接続
USE_REDIS_MOCK=true               # (任意) Redis を用意できないときにテスト用モックを強制
```

#### Docker で手軽に起動する

ローカルに Redis が無い場合は、付属の Compose ファイルで起動できます。

```bash
docker compose -f docker-compose.redis.yml up -d
# 終了時
docker compose -f docker-compose.redis.yml down
```

初回起動時に `redis-data` ボリュームが作成され、データはコンテナ再起動後も保持されます。停止するだけでアプリは自動的に `ioredis-mock` へフォールバックします。

Next.js の再起動を挟んでもセッションが保持されるため、インメモリ時のような「Session not found」エラーが起きにくくなります。

### Notion 連携の設定

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

環境変数は `.env.local` で管理し、必要に応じて Notion 連携用の値を設定してください。

## 今後の拡張ポイント

- Notion API クライアントの本実装とキャッシュ戦略。
- WebSocket サーバー (Fastify + ws) とのリアルタイム連携。
- Terraform / GitHub Actions による IaC & CI/CD パイプラインの整備。

## 使い方 (ローカル)

1. `pnpm dev` を起動し、`http://localhost:3000/` にアクセスします。
2. ホストの名前と (必要なら) Notion DB ID を入力して ROOM を作成します。
3. 表示された参加 URL を共有し、参加者は `/session/{id}/join?token=...` から表示名を登録して入室します。
4. `/session/{id}` でリアルタイム投票・リセット・確定を行います。
5. 確定すると Notion の PBI にストーリーポイントが書き戻されます。
