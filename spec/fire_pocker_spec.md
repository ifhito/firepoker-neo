# Fire Pocker 要件定義書

## 1. 概要
- Fire Pocker は、スクラムチームが Notion 上のプロダクトバックログアイテム (PBI) を対象にプランニングポーカー形式で見積もりを行うための Web アプリケーションである。
- ストーリーポイントはフィボナッチ数列 (0, 1, 2, 3, 5, 8, 13, 21, 34) のみを入力手段として提供する。
- Notion の既存 DB と連携し、最新の PBI 情報と過去の見積もり履歴を参照できる。

## 2. 目的・ゴール
- Notion を中心に管理されている PBI の見積もりを、専用ツールを介さずに効率化する。
- Notion に格納された PBI 情報を正確に取得し、チームメンバーが同じ情報を元に議論できる場を提供する。
- 類似ストーリーポイントを持つ過去 PBI を提示し、見積もりの精度向上とナレッジ共有を促進する。

## 3. スコープ
- 対象スコープ: PBI の見積もりセッションの支援、Notion DB との同期、類似 PBI 推薦。
- 非スコープ: Notion DB の作成・構成変更、ユーザーアカウント管理、Notion 以外のツール連携、自動採番や自動タスク生成。

## 4. 用語定義
- PBI: Product Backlog Item。Notion 上のレコードとして管理される。
- セッション: 1 回の見積もりワーク。複数 PBI を順に取り上げる。
- ファシリテーター: セッションを作成・進行し、見積もり対象の PBI を確定するユーザー。
- 参加者: 見積もり値を投票するユーザー。

## 5. ユースケース
- `UC-01` セッション開始: ファシリテーターが Notion DB から PBI を選択し、見積もりを開始する。
- `UC-02` PBI 情報参照: セッション中に対象 PBI の詳細 (タイトル、説明、担当、現行ステータス) を確認する。
- `UC-03` 見積もり投票: 各参加者がフィボナッチ値のいずれかを選択して投票する。
- `UC-04` 類似 PBI 参照: 過去の同一ストーリーポイントの PBI 最大 10 件を参照し、リンクを開く。
- `UC-05` 合意結果の反映: 選択されたストーリーポイントを Notion の対象カラムに更新する。
- `UC-06` セッション履歴確認 (任意): 最新のセッションで取り上げた PBI と結果を簡易表示する。
- `UC-07` ホスト委譲: ファシリテーターが別の参加者にホスト権限を移譲し、投票制御や確定操作を引き継ぐ。

## 6. システム全体像
- フロントエンド: Next.js アプリケーション (App Router)。ビルドした静的アセットは S3 + CloudFront で配信し、SSR/API 機能はコンテナ化した Next.js サーバーを Amazon ECS Fargate 上の単一タスク内で稼働させる。
- リアルタイム通信: 同じタスクに配置した Node.js ベースの WebSocket サーバー (Express + ws など) が Application Load Balancer (ALB) の WebSocket 対応リスナー経由で接続を受け付ける。メッセージフォーマットと接続管理ロジックは抽象インターフェース化し、他クラウドのコンテナ基盤へ移行可能にする (ADR 0001 参照)。
- セッション状態: 同一タスク定義内で Redis コンテナ (サイドカー) を起動し、WebSocket サーバー・Next.js API が共有するインメモリストアとして利用する。Redis のデータは永続化せず、タスク再起動時に初期化される前提とする。
- データ連携: Notion API (Official) を使用し、PBI データの取得・更新および最終的なストーリーポイント保存を行う。API キーは Notion インテグレーションで取得し、AWS Systems Manager Parameter Store / Secrets Manager に保管。
- 認証: 初期フェーズは共有シークレット + セッション ID による簡易認証。ALB もしくはアプリケーション層でトークン検証を行い、ロジックはアダプタ層に閉じ込めて将来的な OAuth2/OIDC への移行を容易にする。

## 7. 機能要件
### 7.1 Notion 連携
- Notion DB 構成
  - `PBI一覧DB`: 見積もり対象候補を保持。必須プロパティ: `Title` (Title), `Status` (Select), `StoryPoint` (Number), `Assignee` (People), `Epic` (Relation), `LastEstimatedAt` (Date)。
  - `PBI管理DB`: セッション履歴・結果を保持。プロパティ: `PBI` (Relation -> PBI一覧DB), `SessionDate` (Date), `FinalPoint` (Number), `Facilitator` (People), `Notes` (Rich text)。
- アプリケーションは Notion Secret や DB ID を環境変数として受け取る (`NOTION_TOKEN`, `NOTION_PBI_DB_ID`, `NOTION_SESSION_DB_ID`)。
- API コールは 400ms 以内でレスポンスを返せるように CloudFront キャッシュや Redis (ElastiCache) による短期 TTL キャッシュを導入。
- エラーハンドリング: Notion API が失敗した場合、UI で明示的なリトライと障害メッセージを表示し、詳細を CloudWatch Logs / X-Ray に出力。
- セッション作成時、クライアントは ALB 経由で Next.js API (コンテナ) に POST し、対象 PBI の ID 群と作成者情報を Redis に保存する。戻り値として `session_id` と署名付き参加コードを受け取る。Redis のキーは `session:{id}:meta` 形式で保持し、TTL はセッション終了後 24 時間で失効する。
- 参加者は `session_id` を基に WebSocket 接続を確立し、初回接続時に Redis から取得したスナップショットが `state_sync` イベントとして配信される。処理は WebSocket サーバーが直接行い、ioredis などのクライアントを通じてデータへアクセスする。
- セッション状態: `準備中`, `投票中`, `開示中`, `合意済`。状態遷移は以下のルールに従う。
  - `準備中` → `投票中`: 任意の参加者が `start_session` イベントを送信。WebSocket サーバーが検証後に Redis を更新し、全クライアントへブロードキャスト。
  - `投票中` → `開示中`: 全員投票済み、またはいずれかのユーザーが `reveal_request` を送信した時点で遷移。
  - `開示中` → `合意済`: 任意のユーザーが `finalize_point` を送信し、WebSocket サーバーが Notion API を呼び出してストーリーポイントを更新。
  - 任意状態 → `投票中`: 任意のユーザーが `reset_votes` を送信。投票値が削除され、状態は `投票中` に戻る。
- WebSocket メッセージは `event`, `sessionId`, `payload` を必須フィールドとする抽象フォーマットで定義し、ALB/コンテナ環境固有の情報はアダプタ層に封じ込める。
- 状態変更イベントは Redis Streams を通じてバックグラウンドワーカーへ転送し、監査ログや Notion 更新再試行を処理。Streams の利用が難しい場合は Amazon SQS など別キューへ複製するアダプタを準備する。

### 7.3 ストーリーポイント投票
- 投票パネルにはフィボナッチ値のボタンを表示。デフォルトは 8 個 (0～34) だが、管理画面で拡張できる余地を残す。
- 各参加者の投票は WebSocket 経由で `vote_cast` メッセージとして送信され、WebSocket サーバーが Redis (`session:{id}:votes`) に Upsert。処理結果は `vote_ack` として送信者に返し、他参加者へは匿名集計をブロードキャストする。
- 全員投票済み、またはいずれかのユーザーが `reveal_request` を送信した場合に結果を開示する。
- 個人の投票値は開示まで秘匿し、`reveal` 状態で名前と値をマッピングして表示。`reset_votes` メッセージで投票レコードを削除し、匿名状態に戻す。

### 7.4 類似 PBI 取得
- セッション中に確定したストーリーポイント、もしくはファシリテーターが選択した暫定値を元に Notion API でクエリ。
- 条件: `StoryPoint` が一致し、`Status` が `Done` または `Released` など完了系に属するレコードを対象。
- 最大 10 件を新しい順 (`LastEstimatedAt` 降順) に取得し、タイトル、Notion ページ URL、完了日を UI に表示。
- 類似 PBI が存在しない場合はプレースホルダーを表示し、追加学習のためのリンク (FAQ 等) を検討。

### 7.5 システム設定・運用
- 初回セットアップ用に簡易 CLI または npm script (`pnpm run setup:env`) を提供し、Notion DB ID や AWS リソース識別子を `.env` に書き出す。その後 Terraform により Parameter Store / Secrets Manager へ同期。
- 管理者のみがストーリーポイント候補の追加やセッションデータのエクスポートを行える設定画面を持つ (後続フェーズ)。
- WebSocket 接続イベントやエラーは CloudWatch Logs / CloudWatch Metrics に記録し、異常切断率・レイテンシが閾値を超えた場合に SNS 経由で通知する。OpenTelemetry エクスポートを用意し、将来的に他監視基盤へ移行しやすくする。

### 7.6 状態遷移とリセット
- 状態遷移表
  - `準備中` → `投票中`: `start_session`
  - `投票中` → `開示中`: `reveal_request`
  - `開示中` → `合意済`: `finalize_point`
  - 任意状態 → `投票中`: `reset_votes`
- `reset_votes` は接続中のいずれのユーザーからでも送信可能。WebSocket サーバーが Redis の投票レコードを削除し、全クライアントへ最新状態を通知する。
- WebSocket メッセージには `nonce` と `version` を含め二重処理を防止。サーバー側では Redis の `WATCH/MULTI` もしくは Lua スクリプトで楽観ロックを実施し、クライアント側では最新 `version` のみを適用する。

### 7.7 ホスト委譲
- ファシリテーターはセッション画面のヘッダードロップダウンから任意の参加者を選び、`delegate_facilitator` イベントを送出してホスト権限を移譲できる。
- サーバー側は現在のファシリテーター ID を検証し、対象ユーザーが `participants` に存在する場合のみ `meta.facilitatorId` を更新する。結果は `state_sync` で全クライアントに配信。
- 委譲後は新ホストのみが PBI 追加/削除、投票リセット、最終確定などの制御操作を行える。旧ホストは一般参加者と同じ権限に戻る。

## 8. 非機能要件
- パフォーマンス: UI 操作は 200ms 以内にレスポンスを返すことを目標とし、Notion API 呼び出し結果は 5 分間キャッシュ (CloudFront / Redis TTL)。WebSocket 往復遅延は 150ms 以内を目標。
- 可用性: クリティカルなセッション期間中 (平日 10:00-19:00 JST) の稼働率 99.5% 以上。ECS Fargate サービスは最低 2 タスクを維持し、クライアント側で自動再接続 (指数バックオフ) を実装。
- セキュリティ: Notion API キーは AWS Systems Manager Parameter Store もしくは Secrets Manager で管理。通信は HTTPS/WSS のみ、ALB + AWS WAF で保護。
- スケーラビリティ: 1 セッションあたり最大 30 ユーザー、同時 20 セッションを許容。ALB 接続数、ECS CPU/メモリ、Redis メモリ使用率/接続数をモニタリングし、閾値超過でアラート。
- ログ/監査: 重要操作 (リセット、ポイント確定、Notion 更新) のイベントログを CloudWatch Logs → Kinesis Firehose → S3 に集約し、OpenTelemetry で外部監視基盤へも送出可能にする。
- テスト: 単体テスト (Jest/React Testing Library)、統合テスト (Playwright)。CI (GitHub Actions) でプルリクエストごとに実行し、Docker Compose を用いたコンテナ統合テストで WebSocket サーバーと Redis を再現。

## 9. 技術スタック・開発要件
- フロントエンド: Next.js 14 (App Router)、TypeScript、Tailwind CSS (任意)。
- 状態管理: React Query でデータフェッチ、Zustand でリアルタイム投票状態を管理。
- リアルタイム通信: Node.js 20 (Express + ws もしくは Fastify + uWebSockets) を ECS Fargate 上で稼働。クライアント SDK は自前薄ラッパーを実装し、イベントフォーマットを共通化してベンダーロックを緩和。
- バックエンド: Next.js API (Node.js 20) + Redis (サイドカーコンテナ) を利用し、セッション・投票状態をインメモリで管理。永続ストレージは持たず、Notion への確定書き込みで最終結果を保持する。データアクセスはリポジトリ/サービス層で抽象化。
- インフラ: Terraform v1.6 以上。VPC, ALB, ECS Fargate, ECR, S3, CloudFront, Parameter Store を IaC 化。モジュールをクラウド非依存に設計。
- デプロイ: GitHub Actions → Terraform/CodePipeline。コンテナビルド→ECR→ECS デプロイ。ステージは `dev`, `stg`, `prod`。
- 環境変数管理: `.env.local` (開発用)、AWS SSM Parameter Store / Secrets Manager (本番)。
- コーディング規約: ESLint (Next.js 推奨設定 + Prettier)、TypeScript strict モード、Clean Architecture (ポート/アダプタ) を推奨。

## 10. API / データ仕様
- HTTP API (ALB → ECS/Next.js コンテナ)
  - `GET /api/pbis`: Notion `PBI一覧DB` からフィルタ済み一覧を返却。クエリパラメータ `status`, `search`。レスポンスは `{ items: PBI[], nextCursor? }`。
  - `POST /api/sessions`: { title, facilitator, pbiIds[] } を受け取りセッションを作成。Redis にメタ情報を保存し、`sessionId`, `joinToken` を返却。
  - `POST /api/sessions/{sessionId}/finalize`: { finalPoint, memo } を受け取り、Notion DB の `StoryPoint`, `LastEstimatedAt` を更新し、`PBI管理DB` に履歴を追加。完了後 `finalized` イベントを発火。
  - `GET /api/pbis/{id}/similar`: 指定 ID の PBI と同一 `StoryPoint` の過去レコード (最大 10 件) を返却。
- WebSocket メッセージ (JSON, 共通フィールド: `sessionId`, `event`, `payload`, `version`, `nonce`)
  - `state_sync`: payload={ state, votes[], participants[], lastUpdatedAt } 初回接続および更新時。
  - `vote_cast`: payload={ userId, point } 投票要求。
  - `vote_ack`: payload={ userId, point, accepted } 投票結果通知。
  - `reveal_request`: payload={ userId } 開示リクエスト。
  - `reset_votes`: payload={ userId } 投票リセット。
  - `finalize_point`: payload={ userId, finalPoint, memo? } 合意ポイント確定要求。
  - `delegate_facilitator`: payload={ userId, delegateTo } ファシリテーター権限委譲。
  - `finalized`: payload={ finalPoint, notionPageId, updatedAt } Notion 更新完了通知。
- エラー時は HTTP / WebSocket ともに `{ code, message, retryable }` 形式で返却し、`code` は共通の列挙 (e.g. `ValidationError`, `Conflict`, `NotionError`) を用いる。

## 11. UI 要件
- 画面構成
  - HOME (ROOM 作成フォーム): セッションタイトル、ホスト名、Notion DB ID を入力し作成ボタンで `joinToken` を生成。
  - JOIN 画面: 共有された URL から表示名を入力し、セッションへ参加。
  - セッション画面: PBI 詳細パネル、フィボナッチカード、投票状況表示、類似 PBI サイドパネル、ホスト委譲ドロップダウン。
  - （将来）セッション履歴/設定画面: 過去結果やポイント候補設定を確認・変更。
- レスポンシブ対応: タブレット (768px) 以上で二列レイアウト、モバイルでは縦一列。
- アクセシビリティ: キーボード操作で投票カードを選択可能、ARIA ラベル対応、コントラスト比 4.5:1 以上。
- リアルタイム表示: 投票状況は WebSocket イベントで即時反映し、再接続時は最新スナップショットを提示。

## 12. 検討事項・リスク
- Notion API のレート制限 (3 req/sec) を考慮し、バッチ取得・キャッシュ・リトライ制御の設計が必須。
- ALB + ECS の常時接続によりコンピュートコストが一定以上発生するため、オートスケールとスケジュール停止 (非稼働時間) のバランスを検討する。
- Redis サイドカーは永続化しないため、タスク障害時にセッション情報が消失するリスクがある。Notion への即時書き込みや再同期用のフェールセーフを用意する。
- ベンダーロックを避けるための抽象化は実装コストが増える。テストコードやドキュメントでインターフェース契約を維持しないと形骸化するリスクがある。
- WebSocket 非対応ネットワーク (プロキシ環境) では接続できない場合がある。HTTP フォールバックの UX と整合性維持が課題。

## 13. AWS 構成方針 (WebSocket 前提)
### 13.1 採用アーキテクチャ
- コンポーネント: CloudFront + S3 (静的配信)、Application Load Balancer (HTTP/HTTPS/WebSocket)、ECS Fargate (Next.js API / WebSocket サーバー + Redis サイドカー)、ECR、Parameter Store / Secrets Manager、CloudWatch。
- ベンダーロック軽減策:
  - WebSocket メッセージとリポジトリをインターフェース化し、AWS 依存コードをアダプタ層に隔離。コンテナイメージは OCI 準拠で他基盤へ移行可能にする。
  - Terraform モジュールを「共通アプリケーション」/「AWS 実装」に分割し、別クラウドの IaC (e.g. Pulumi, Crossplane) に置き換え可能な構造を維持。
  - OpenTelemetry 形式でメトリクス・トレースを収集し、CloudWatch 以外の監視ツールにも転送可能にする。
  - Redis のデータ構造をドキュメント化し、別途管理マネージドサービスやインメモリストアへ置き換えるためのエクスポートスクリプトを用意する。

### 13.2 代替案 (参考)
- AppSync (GraphQL Subscriptions) + DynamoDB: 型安全性と認証統合が魅力。GraphQL 導入コストが増えるため、現フェーズでは採用見送り。
- API Gateway WebSocket + Lambda + DynamoDB: サーバーレスベースでスケール容易だが、AWS 固有 API への依存度が高いためロックイン懸念がある。
- Amazon IVS Chat / Chime SDK: メッセージングをフルマネージドで提供するが、投票イベントへの適用に追加の抽象化が必要。
