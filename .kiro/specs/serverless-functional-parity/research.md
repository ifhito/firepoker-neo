# Research & Design Decisions Template

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.

**Usage**:
- Log research activities and outcomes during the discovery phase.
- Document design decision trade-offs that are too detailed for `design.md`.
- Provide references and evidence for future audits or reuse.
---

## Summary
- **Feature**: serverless-functional-parity
- **Discovery Scope**: Extension
- **Key Findings**:
  - Serverless WebSocket ハンドラ (`serverless/src/websocketHandler.ts`) は `@/server/notion/client` を直接呼び出す構造で、アクションは `listPbis` と `updateStoryPoint` の2種類に集約されているため、Lambda 1本でパリティを取りつつ依存注入ポイントを設計すれば拡張しやすい。
  - CSR UI (`serverless/web/app/page.tsx`, `web/src/hooks/usePlanningPokerSession.tsx`) は WebSocket 経由のフィルタリング／ストーリーポイント更新に限定されており、S3 + CloudFront で静的配信する Next.js export パターンと相性が良い。
  - 既存の Terraform (container/terraform) は ECS 用で、serverless 用には API Gateway WebSocket + Lambda + S3/CloudFront + Secrets Manager を同居させる別スタックが必要。Terraform で環境変数や権限 (execute-api:ManageConnections) をまとめて管理する方針が妥当。

## Research Log

### Serverless WebSocket Handler 既存実装
- **Context**: 既存の serverless/src/websocketHandler.ts がどこまで要件を満たしているか確認する必要があった。
- **Sources Consulted**: `serverless/src/websocketHandler.ts`, `serverless/tests/websocketHandler.test.ts`
- **Findings**:
  - イベント種類は CONNECT / DISCONNECT / MESSAGE。MESSAGE 時は JSON パース後に `listPbis` or `updateStoryPoint` を実行。
  - Notion クライアントは `getNotionClient()` (container 側) を使用し、環境変数が未設定ならモックへ自動フェイルオーバーする。
  - レスポンスは `WS_CALLBACK_ENDPOINT` もしくは API Gateway Management API を推測して `fetch` で POST するシンプルなアダプタ。
- **Implications**:
  - Lambda 層では依存注入ポイント (NotionClient, WebSocketResponder) を保ったまま、監査ログ・リトライ設定・構造化ログ付与を追加する設計が必要。
  - IAM ロールに `execute-api:ManageConnections` を付与し、Terraform で `WS_CALLBACK_ENDPOINT` を出力・環境変数設定する。

### CSR Web クライアント挙動
- **Context**: parity の対象となる UI フローを把握するため。
- **Sources Consulted**: `serverless/web/app/page.tsx`, `serverless/web/src/hooks/usePlanningPokerSession.tsx`, `serverless/tests/websocketConfig.test.ts`
- **Findings**:
  - CSR 側は `NEXT_PUBLIC_WS_ENDPOINT` を読んで WebSocket を初期化し、`listPbis` と `updateStoryPoint` の2つのアクションを送受信するだけの単純なイベント駆動。
  - テーブルに表示する属性は `ProductBacklogItem` 型のフィールド (status, sprint, assignee, lastEstimatedAt) に限られる。
  - フィルターはフロントのみ保持し、初回接続時に `latestFiltersRef` から `listPbis` を送る。
- **Implications**:
  - S3/CloudFront で配信するに当たり、環境差分は `.env` ではなくビルド時の `NEXT_PUBLIC_*` or runtime config で注入する必要。
  - CloudFront デプロイ時にエラー/接続ステータス表示を監視指標として扱う。

### インフラ / Terraform 戦略
- **Context**: serverless 用の IaC で何を管理するかを決めるため。
- **Sources Consulted**: `container/terraform/README.md` (既存方針の確認), AWS Docs (`https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html`, `https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_api`)
- **Findings**:
  - 既存 Terraform は ECS, ALB, Redis にフォーカスしているため、serverless では別ステート管理が望ましい。
  - WebSocket API v2 と Lambda 統合、IAM ロール作成、Stage + Route (`$connect`, `$disconnect`, `$default`) の設定が必要。
  - CSR 配信用の S3 バケット + CloudFront ディストリビューション + OAC/バケットポリシー、及びアーティファクトアップロード手順が必要。
- **Implications**:
  - `serverless/terraform` 配下にモジュール構成 (`lambda`, `websocket`, `static_site`) を定義し、パラメータとして Notion シークレットやエンドポイントを受け取る。
  - Terraform が `NEXT_PUBLIC_WS_ENDPOINT` や `WS_CALLBACK_ENDPOINT` を outputs として提供し、CI/CD でビルドに渡す動線を作る。

### 観測性とセキュリティ
- **Context**: 要件 4 で求められる信頼性/監視要件を満たす方法を整理するため。
- **Sources Consulted**: Requirements doc, `serverless/tests/websocketHandler.test.ts`, AWS Docs (`https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html`)
- **Findings**:
  - 現在の handler は console.log ベースで構造化ログを出していない。
  - CloudWatch 上でカスタムメトリクスを Push する設計は無い。
  - Secrets は現状 `.env` 想定のため、AWS Secrets Manager へ移行する必要がある。
- **Implications**:
  - Lambda Powertools などの導入を検討するが、最小実装では JSON 形式で `console.log` + CloudWatch Metric (PutMetricData) を追加する。
  - Terraform で Secrets Manager (Notion Token 等) を作成し、Lambda に対する暗号化環境変数権限を設定。

## Architecture Pattern Evaluation
| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Single WebSocket Lambda (Selected) | 1 Lambda 関数で `$default` メッセージをルーティングし、Notion 操作をまとめる | コード共有が容易、デプロイ数が少なくコスト低 | 将来アクションが増えると肥大化する | 依存注入とアクションハンドラ分割で拡張性を確保 |
| Multi-Lambda per Action | アクションごとに Lambda を分け、APIGW ルーティングも細分化 | 独立デプロイ・障害範囲の切り分けが容易 | ルート/権限管理が複雑、現状2アクションしかない | 要求機能規模的にオーバーエンジニアリング |
| AppSync/WebSocket API as a Service | AWS AppSync の GraphQL + subscription を活用 | マネージドで状態管理や権限管理が簡単 | 既存ドメインモデルと乖離、GraphQL スキーマ定義が追加工数 | React Query / Zustand ベースの既存設計にそぐわない |

## Design Decisions

### Decision: 単一 WebSocket Lambda でアクションルーティング
- **Context**: `listPbis` と `updateStoryPoint` しか無いが今後追加余地がある。
- **Alternatives Considered**:
  1. Multi-Lambda per action
  2. Lambda + EventBridge で非同期化
- **Selected Approach**: `handleEvent` 内でアクションごとに関数へ委譲する構造を継続し、今後アクション追加時は個別モジュールを追加。
- **Rationale**: デプロイ容易性と API Gateway ルートの単純化を優先。
- **Trade-offs**: 1関数にロジックが集中する→Lint/テストでカバー。
- **Follow-up**: Handler サイズ監視とアクション追加時の分割計画。

### Decision: Notion クライアントの共有
- **Context**: container 側の `@/server/notion/client` を serverless でも再利用している。
- **Alternatives Considered**:
  1. 新規 Notion SDK ラッパーを serverless 内に作成
  2. HTTP 経由で container API を呼び出す
- **Selected Approach**: 既存クライアントを bundler で同梱し、Lambda Layers もしくは esbuild バンドルで共通利用。
- **Rationale**: ドメイン仕様とモック切替のロジックを一元化できる。
- **Trade-offs**: バンドルサイズが増える。ビルド時間への影響あり。
- **Follow-up**: esbuild/Turbopack 設定で tree-shaking を確認。

### Decision: Terraform モジュール構成
- **Context**: serverless 用 IaC をどこに配置するか。
- **Alternatives Considered**:
  1. 既存 container/terraform に追加
  2. serverless/terraform に独立させる
- **Selected Approach**: `serverless/terraform` 以下に `modules/{lambda,websocket,static_site}` を作り、ルートに `environments/{dev,prod}` を用意。
- **Rationale**: 責務分離とステート分割が容易。各構成のライフサイクルが異なるため。
- **Trade-offs**: 共通変数の重複が増える。
- **Follow-up**: 共有 tfvars を scripts で生成する。

### Decision: Secrets Manager + Parameter Injection
- **Context**: Notion トークンや DB ID の扱い。
- **Alternatives Considered**:
  1. SSM Parameter Store
  2. GitHub Actions secrets を直接 Lambda へ設定
- **Selected Approach**: AWS Secrets Manager に JSON シークレットを構築し、Lambda には暗号化環境変数経由で注入。
- **Rationale**: 自動ローテーションやアクセス制御が容易。
- **Trade-offs**: コスト (少額) と権限設定が必要。
- **Follow-up**: Terraform で secret rotation の設定を後続タスクに追加。

## Risks & Mitigations
- Notion API レイテンシにより Lambda タイムアウトが発生 — **Mitigation**: 10s タイムアウト + 再試行制御、レスポンダ遅延時の DLQ を検討。
- WebSocket コネクションリーク — **Mitigation**: `$disconnect` で明示ログ・CloudWatch アラームを設定。
- Terraform ステート分離に伴う重複設定 — **Mitigation**: 共有 tfvars と README で同期手順を記載。

## References
- `serverless/src/websocketHandler.ts`
- `serverless/tests/websocketHandler.test.ts`
- `serverless/web/app/page.tsx`
- `serverless/web/src/hooks/usePlanningPokerSession.tsx`
- `container/terraform/README.md`
- [AWS WebSocket API Overview](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api-overview.html)
- [Terraform aws_apigatewayv2_api](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_api)
- [AWS Lambda Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics.html)
