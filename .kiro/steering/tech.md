# Technology Stack

## Architecture

モノレポ構成で Next.js App Router アプリ (container/) と Serverless WebSocket + CSR Next.js (serverless/) を同居させています。TypeScript のドメイン型と Notion アダプタを共有し、`@/*` エイリアス経由で Lambda 側からも container/src のロジックを再利用します。リアルタイム層は Socket.IO (ECS) / API Gateway WebSocket (Lambda) の 2 系統を同一のドメインイベントで駆動します。

## Core Technologies

- **Language**: TypeScript (strict mode, shared between app/serverless/tests)
- **Framework**: Next.js 14 (App Router) for container, CSR Next.js 14 for serverless/web, AWS Lambda for WebSocket handler
- **Runtime**: Node.js 18+ (Next.js 推奨), AWS Lambda Node.js 18.x, pnpm ワークスペース

## Key Libraries

- `@notionhq/client` + カスタム `getNotionClient` で実/モック切替
- `@tanstack/react-query` と専用 `ReactQueryProvider` によるデータフェッチ統合
- `zustand` ストアで WebSocket 状態/ローカル投票を一元管理
- `socket.io` / `socket.io-client` (コンテナ版のリアルタイム) と `ws` (サーバーレスの送信)
- `ioredis` + `ioredis-mock` によるセッションストレージ抽象化
- `zod` ベースの入力バリデーション / 型安全 API レイヤー
- `vitest` + `@vitest/coverage-v8` で Lambda・Next 双方のユニットテスト

## Development Standards

### Type Safety
- すべての tsconfig で `strict: true`、`noEmit`、`moduleResolution` を bundler/node に固定
- `src/domain/*` で PBI/Session 型を宣言し、UI/サーバーが共有
- `zod` と型ガード(`isVoteCastMessage` など)で WebSocket メッセージを安全に扱う

### Code Quality
- `pnpm lint` が container と serverless/web の `next lint` を連続実行
- Prettier 3 + ESLint(core-web-vitals) を採用、CI でも同じ設定 (`.prettierrc` は root)
- 依存を通じて `@types/*` を固定し、`tsc --noEmit` (`pnpm typecheck`) で差分を検出

### Testing
- `pnpm vitest run serverless/tests/websocketHandler.test.ts` などパス単位で Lambda を検証
- container/tests 配下ではセッションストア、Notion サービス、Zustand ストアなどをユニットテスト
- `USE_REDIS_MOCK` と `ioredis-mock` により CI/ローカルで外部 Redis に依存しない

## Development Environment

### Required Tools
- Node.js 18 以上 + `pnpm` (Lockfile は `pnpm-lock.yaml`)
- Docker Compose (任意) — Redis 導入や ECS/E2E テスト用
- AWS CLI / Terraform (infra/docs で参照)

### Common Commands
```bash
# コンテナ Next.js 開発
pnpm dev

# サーバーレス CSR 開発 + Lambda テスト
pnpm dev:serverless
pnpm vitest run serverless/tests/websocketHandler.test.ts

# 型 & lint & テスト一括
pnpm typecheck
pnpm lint
pnpm test:run

# CSR を S3 配信用にエクスポート
pnpm export:serverless
```

## Key Technical Decisions

- **Notion クライアントの二層化**: `getNotionClient` で env 未設定時はモック、設定済みは REST API を呼ぶことで安全なデモと本番を両立。
- **リアルタイム抽象**: `src/client/realtime` と `src/store/sessionRealtime` が Socket.IO イベントを 1 つのストアに集約し、UI は `useSessionRealtimeStore` からだけ状態を読む。
- **ドメイン共有**: serverless/tsconfig が `@/* -> ../container/src/*` を参照し、Lambda と CSR でも container のドメインロジックを再コンパイルせず利用。
- **フォールバック可能なインフラ**: Redis, Notion, WebSocket の各依存は `.env` 変数でオン/オフを制御、`ensureDemoSession` でデータを作り直しやすい。
- **タスク自動化**: `scripts/terraform-setup.sh`, `docs/quick-start.md` などインフラ手順をコード化し、fire-and-forget な ECS デプロイを再現。

---
_主要スタックだけを保持し、granularity は README/Spec に委譲します_
