# Project Structure

## Organization Philosophy

`container/` は Next.js App Router を中心に「サーバー依存・UI・ドメイン」を分離したレイヤー構造、`serverless/` は Lambda WebSocket と CSR Next.js を最小限のフォルダで束ねる構造です。両者は TypeScript ドメイン型を共有しており、「UI は `app/`、ドメインは `src/`、インフラ/ドキュメントは `docs|terraform|scripts/`」というパターンを守ればどちらにコードを追加しても迷いません。

## Directory Patterns

### Next.js App Router Surface
**Location**: `container/app/` (例: `app/(authenticated)/session/[sessionId]/page.tsx`)  
**Purpose**: サーバーコンポーネントから `src/server/*` のサービスを呼び出し、クライアント側に渡すプレゼンテーション層。`layout.tsx` が `ReactQueryProvider` や `ensureDemoSession` を初期化します。  
**Example**: `app/(authenticated)/session/[sessionId]/page.tsx` がルーム状態を取得し、`SessionDetailClient` を描画。

### Domain & Service Layer
**Location**: `container/src/domain`, `container/src/server/*`, `container/src/lib/*`  
**Purpose**: PBI/Session 型、Notion クライアント、Redis セッションストア、WebSocket メッセージ判定を定義。UI 側はここで定義されたメソッドを通じてのみ状態を操作します。  
**Example**: `src/server/notion/client.ts` が実/モック両対応の Notion API、`src/server/session/service.ts` がセッション CRUD を提供。

### Realtime Client State
**Location**: `container/src/client/realtime/*`, `container/src/store/sessionRealtime.ts`  
**Purpose**: Socket.IO との接続ハンドラを `RealtimeClient` インターフェースで抽象化し、Zustand ストアが UI へシンプルな API (`connect`, `sendVote`, `delegateFacilitator` など) を提供。  
**Example**: `src/client/realtime/websocketClient.ts` が `io()` 設定を一括管理。

### Serverless Runtime
**Location**: `serverless/src/websocketHandler.ts`, `serverless/tests/*`  
**Purpose**: API Gateway WebSocket イベントを `handleEvent`/`handleMessage` で振り分け、Notion クライアントとレスポンダを依存注入。ヴィテストで `$connect/$disconnect/$default` の分岐を検証。

### Serverless CSR Web
**Location**: `serverless/web/` (App Router CSR)  
**Purpose**: ブラウザから直接 WebSocket を開き、PBI フィルタと更新コマンドを送信する軽量 UI。`src/hooks/usePlanningPokerSession.tsx` が接続状態とイベントログを保持し、`NEXT_PUBLIC_WS_ENDPOINT` で切り替え。S3 配信用に `next export` を想定。  
**Example**: `web/app/page.tsx` が filters -> websocket -> table 表示の 1 ページ構成。

### Infra / Docs Artifacts
**Location**: `container/docs`, `container/scripts`, `container/terraform`  
**Purpose**: ECS+Redis の IaC・手順・クイックスタートを保管し、アプリコードと同じ Git 履歴で更新。

## Naming Conventions

- **Files**: Next.js ルートやディレクトリはケバブ/スネークを避けた小文字、共有ライブラリは `sessionRealtime.ts` のような camelCase。
- **Components**: `SessionDetailClient`, `ReactQueryProvider` など PascalCase。クライアントコンポーネントは `use client` で明示。
- **Functions/Hooks**: camelCase (`ensureDemoSession`, `usePlanningPokerSession`)。ストア/サービスは動詞 + 名詞で役割を明確化。

## Import Organization

```typescript
import { getSessionState } from '@/server/session/service'; // @/* = container/src/*
import SessionDetailClient from './SessionDetailClient';    // 同階層は相対パス
```

**Path Aliases**:
- `@/*` → `container/src/*` (App Router と Lambda が共有)
- `@serverless/web/*` → `serverless/web/src/*`
- `@container/*` → `container/src/*` (CSR からドメインを参照するための別名)

## Code Organization Principles

- App Router のサーバーコンポーネントは `src/server/*` で取得したプレーンデータを props として渡し、クライアント側の Zustand/React Query がリアルタイム更新を担う。
- ドメイン層は I/O 抽象 (`NotionClient`, `RealtimeClient`, `SessionStore`) を介しており、テストではモック実装を差し替える。
- Serverless 側も `HandlerDependencies` を注入できる構造にしており、テスト/本番で HTTP 呼び出しやレスポンダを切り替えやすい。
- `docs/` や `spec/` はアプリコードと同じ階層に保持し、ステアリングからは参照だけに留める (詳細は各 README/Spec に記載)。

---
_ディレクトリの役割と命名ルールを示し、詳細なファイル一覧は持たない_
