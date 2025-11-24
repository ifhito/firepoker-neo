# Fire Pocker リアルタイム構成 (2025-10-21)

## 1. 概要
Fire Pocker では、HTTP API と WebSocket を組み合わせてプランニングポーカーを実現しています。リアルタイムチャネルはセッション状態（参加者一覧・投票状況・アクティブ PBI・フェーズ）をクライアント間で同期し、HTTP はセッション作成・PBI カタログ取得・初期表示など補助的な用途に使用します。

```
ブラウザ (Next.js クライアント) ── WebSocket ── Next.js API Route (`pages/api/ws.ts`) ── Redis
                 │                                               │
                 └──── HTTP (REST) ──────────────────────────────┘
```

主要なポイント:
- **通信方式**: WebSocket (`ws://<origin>/api/ws`)
- **実行基盤**: Next.js App Router + `ws` による独自 WS サーバー
- **状態管理**: Redis (ioredis) にセッションスナップショット・投票・joinToken を保存
- **クライアントストア**: Zustand (`src/store/sessionRealtime.ts`) が WebSocket のライフサイクルと UI 状態を管理

## 2. コンポーネント詳細

### 2.1 WebSocket クライアント (`src/client/realtime/websocketClient.ts`)
- ブラウザの `origin` と `/api/ws` から WebSocket URL を組み立てる。
- `open` / `message` / `error` / `close` を購読し、コールバック経由でストアに伝える。
- `send` / `isConnected` / `connect` / `disconnect` を提供。

### 2.2 セッションリアルタイムストア (`src/store/sessionRealtime.ts`)
- 接続状態、最新セッションスナップショット、ローカル投票値、接続中クライアントを保持。
- `connect(client, sessionId, joinToken, userId)` でソケットを張り、`handleMessage` で `state_sync` `finalized` `error` を処理。
- `sendVote` / `requestReveal` / `resetVotes` / `finalize` が WebSocket にイベントを書き込む（HTTP フォールバックは撤廃済み）。

### 2.3 セッション詳細ページ (`app/(authenticated)/session/[sessionId]/SessionDetailClient.tsx`)
- 初回表示時に `useSessionState` で HTTP スナップショットを取得。
- マウント時に `/api/ws` をウォームアップし、WebSocket クライアントを生成してストアに渡す。
- HTTP 取得した状態をストアに同期し、その後の `state_sync` を適用しやすくする。
- 表示する UI:
  - `PbiSelectionPanel`: セッションに紐づく PBI の追加・削除・アクティブ切替を WebSocket イベントで送信し、`state_sync` を通じて全参加者へ共有。
  - `FibonacciPanel`: フィボナッチカードを表示。`connectionStatus === 'connected'` かつ `currentUserId` があればボタンが有効。

### 2.4 WebSocket サーバー (`pages/api/ws.ts`)
- Next.js API サーバーにアタッチされた単一の `WebSocketServer`。
- クエリの `sessionId` と `token` を Redis のレコードで検証。
- セッションごとに接続集合を管理し、受信イベントごとに以下を処理:
  - `vote_cast`: Redis の投票結果とフェーズを更新。
  - `reveal_request`: フェーズを `REVEAL` へ変更。
  - `reset_votes`: 投票値を初期化。
  - `finalize_point`: `finalizeSession` を呼び出し Notion (モック) へ反映後フェーズを `FINALIZED` に。
- 各イベント処理後、最新状態を `state_sync` として全クライアントへブロードキャスト。

### 2.5 セッションストア/サービス (`src/server/session/store.ts`, `src/server/session/service.ts`)
- Redis の `session:{id}` `session:token:{token}` キーを 24 時間 TTL で管理。
- 参加者登録、PBI 追加/削除、投票などのドメイン操作が HTTP ルート／WebSocket サーバー双方から利用される。

## 3. メッセージフロー

1. **参加 (Join)**
   - クライアントが `/session/{id}?token=...` にアクセス（HTTP で初期状態取得）。
   - セッションページが `/api/ws` をウォームアップ後、joinToken 付き WebSocket を初期化。
   - サーバーが token を検証し、接続リストに追加して直ちに `state_sync` を送信。

2. **投票・PBI 操作 (Voting / PBI Management)**
   - WebSocket が `connected` の状態でユーザーがカードをクリック。
   - ストアが `localVote` を更新し `vote_cast` を送信。
   - サーバーは Redis を更新し、最新の投票状況を含む `state_sync` を再送。
   - PBI 追加/削除は `pbi_add` / `pbi_remove`、アクティブ切替は `pbi_set_active` を送信し、サーバーが `updateSessionPbis` / `selectActivePbi` を実行後 `state_sync` で広報。

3. **開示 / リセット / 確定**
   - ボタンから `reveal_request` / `reset_votes` / `finalize_point` を送信。
   - サーバーが状態を更新し、必要に応じて Notion へ書き戻し、その後 `state_sync` を配信。

## 4. HTTP エンドポイント一覧
| Endpoint | Method | 用途 |
|----------|--------|------|
| `/api/sessions` | POST | セッション作成（`sessionId` と `joinToken` を返す）。 |
| `/api/sessions/{id}` | GET | セッション状態の取得（SSR・フォールバック読取に使用）。 |
| `/api/sessions/{id}/participants` | POST | 参加時のユーザー登録。 |
| `/api/sessions/{id}/pbis` | POST | セッションに紐づく PBI の追加・削除。 |
| `/api/sessions/{id}/active-pbi` | POST | アクティブ PBI の切り替え。 |
| `/api/pbis`, `/api/pbis/{id}/similar` | GET | PBI カタログや類似 PBI の取得。 |

HTTP は **初期状態の取得**・**カタログ管理**・**Notion 連携** といった役割に留まり、リアルタイム協調（投票やフェーズ操作）は WebSocket イベントに依存します。

## 5. 運用メモ
- Redis を起動 (`docker compose -f docker-compose.redis.yml up -d`) するか、必要に応じ `USE_REDIS_MOCK=true` を指定してください。
- 開発時は `pnpm dev` を実行し、ターミナルの `ws connection accepted` ログで接続状況を確認できます。
- 新しいイベントを追加する場合は、WebSocket サーバーとクライアントストア双方のハンドリングを更新して整合性を保ってください。
