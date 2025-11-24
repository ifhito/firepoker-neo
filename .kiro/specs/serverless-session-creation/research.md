# Research & Design Decisions Template

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: serverless-session-creation
- **Discovery Scope**: Extension
- **Key Findings**:
  - Container 側の `/api/sessions` は `createSession` サービスで sessionId/joinToken を生成し、`publishSessionAccess` で DynamoDB エントリを作成しているため、serverless でも同データ型とライフサイクルを踏襲する必要がある。
  - Serverless スタックは WebSocket (API Gateway v2 + Lambda) のみ実装されているため、セッション作成には別途 HTTP API を導入し CSR から POST できるようにする必要がある。
  - 参加者へ joinToken を提示する UI ロジックは `persistSessionIdentity` など container のクライアントライブラリを再利用でき、serverless/web でもモジュール共有が可能である。

## Research Log

### 既存セッション作成フローの調査
- **Context**: 機能 parity を確保するため、container 実装の責務とデータフローを把握した。
- **Sources Consulted**: `container/app/intake/page.tsx`, `container/app/api/sessions/route.ts`, `container/src/server/session/service.ts`
- **Findings**:
  - Intake UI は facilitator 名・Notion DB ID を入力し、`/api/sessions` へ `SessionRequestBody` を送信している。
  - `createSession` は `generateSessionId`/`generateJoinToken`、`publishSessionAccess` を呼び出し DynamoDB に joinTokenHash と TTL を保存する。
  - 応答には joinToken と初期 `SessionState` が含まれ、クライアントは `persistSessionIdentity` で sessionStorage に保持する。
- **Implications**: serverless 版 API も同じ DTO とユーティリティを使用し、TTL・最大接続数など `publishSessionAccess` の契約を壊さない必要がある。

### Serverless API 方式
- **Context**: WebSocket Lambda に作成ロジックを混在させるか、HTTP Lambda を追加するかを比較した。
- **Sources Consulted**: 既存 serverless/terraform/modules, AWS API Gateway v2 + Lambda best practices (既知知識)
- **Findings**:
  - WebSocket ハンドラは Notion 操作とステートレスメッセージに特化しており、リクエストサイズや 201 レスポンスの取り扱いが複雑になる。
  - API Gateway HTTP (REST) はフォーム POST と 201 レスポンス、CORS 制御を扱いやすい。Terraform でも別 Lambda module を追加しやすい構造になっている。
- **Implications**: Session Creation 用に HTTP API を新設し、CSR は `NEXT_PUBLIC_REST_ENDPOINT` を通じて POST する設計とする。

### 永続化戦略 (Dynamo)
- **Context**: joinToken 以外にセッションタイトルや backlog 情報を保持する必要があるか整理。
- **Sources Consulted**: `container/src/server/session/access/store.ts`, DynamoDB ベストプラクティス (既知)
- **Findings**:
  - SessionAccess テーブルは joinTokenHash, maxConnections, activeConnections, expiresAt のみを管理しており、追加フィールドを混在させると Validator ロジックに影響する。
  - メタデータや UI 表示用情報は別テーブル `SessionMetadata` (PK=sessionId) を作成した方が責務分離できる。TTL や LSI/Lambda アクセスに干渉しない。
- **Implications**: 新テーブルでタイトル・facilitator 表示名・backlog フィルター等を保持し、将来の管理画面にも再利用できるようにする。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| WebSocket handler 内に統合 | 既存 Lambda に `$default` メッセージとして createSession を実装 | Lambda 追加不要 | WebSocket payload が肥大化、HTTP フォーム投稿と相性が悪い、IAM/サイニングが複雑 | 不採用 |
| API Gateway HTTP + 専用 Lambda | `POST /sessions` を HTTP API で公開し、JSON を検証して Dynamo/SessionAccess を更新 | CORS/レスポンス処理が容易、観測性も HTTP ログで一元化 | リソース追加によりコスト増。API キー/認証制御を別途考慮 | 採用 |
| App Router へのプロキシ | container 側 API を CloudFront からプロキシ利用 | 既存実装を再利用 | serverless 構成の独立性を損なう。VPC/セキュリティ複雑 | 不採用 |

## Design Decisions

### Decision: HTTP Lambda を追加してセッション作成を提供
- **Context**: WebSocket ハンドラへ統合すると JSON モデルが複雑化し、UI からの素直な POST が困難。
- **Alternatives Considered**:
  1. WebSocket `$default` アクションに createSession を追加
  2. container API をそのまま呼び出す (プロキシ)
- **Selected Approach**: API Gateway HTTP + Lambda `sessionCreationHandler` を新設し、`POST /sessions` を受け付けて SessionAccess/Dynamo に書き込む。
- **Rationale**: UI との CORS 制御、201 レスポンス、将来の管理 UI 拡張を考慮すると HTTP エンドポイントが自然。
- **Trade-offs**: インフラが 1 Lambda 増えるが、運用コストは最小限。署名/API キー対応が別途必要。
- **Follow-up**: Terraform module 追加とデプロイパイプライン更新。

### Decision: SessionMetadata Dynamo テーブルを導入
- **Context**: joinToken 用テーブルに列を追加すると Validator/Monitor に影響する。
- **Alternatives Considered**:
  1. 既存 SessionAccess テーブルを拡張
  2. S3/Notion 等にメタデータを保存
- **Selected Approach**: `session_metadata` テーブル (PK=sessionId) を作り、タイトル・facilitator 名・backlog ソース等を JSON で保持。
- **Rationale**: 可観測性向上と将来のセッション一覧 API を視野に入れた分離。
- **Trade-offs**: 追加テーブルの Terraform 管理が必要。複数テーブル更新の整合性を Lambda で制御する必要がある。
- **Follow-up**: TTL/二次インデックス要件をタスク化し、監視を追加する。

### Decision: container のドメインロジックを再利用
- **Context**: sessionId/joinToken 生成や Notion 連携ユーティリティは container 側に存在。
- **Alternatives Considered**:
  1. serverless 側で独自実装
  2. 既存関数を `@/*` エイリアスで共有
- **Selected Approach**: 既存ユーティリティ (`generateSessionId`, `generateJoinToken`, `publishSessionAccess`, `persistSessionIdentity`) を再利用。
- **Rationale**: ドメイン一貫性とテスト済みロジックを活かせる。
- **Trade-offs**: serverless ビルドに container コードが含まれるため、バンドルサイズに注意。
- **Follow-up**: 重複依存が問題化したら shared パッケージ化を検討。

## Risks & Mitigations
- REST エンドポイントを公開することで悪用されるリスク — API Key や Rate Limit 設定、joinToken TTL を導入。
- DynamoDB 二重書き込みの失敗で joinToken/metadata が不整合になる — Lambda 内でトランザクション (TransactWriteItems) または補償ロジックを採用。
- UI が `NEXT_PUBLIC_WS_ENDPOINT` と `NEXT_PUBLIC_REST_ENDPOINT` を不一致で参照する — export スクリプトで両方の outputs を一貫して注入し、.env サンプルを更新。

## References
- `container/app/intake/page.tsx`
- `container/app/api/sessions/route.ts`
- `container/src/server/session/service.ts`
- `container/src/server/session/access/publisher.ts`
- `serverless/terraform/modules/session_access` (既存)
