# Requirements Document

## Introduction
Fire Pocker Neo の serverless/ 構成は、AWS Lambda と S3/CloudFront を利用して container/ 構成と同等のプランニングポーカー体験を提供することを目的とする。Notion バックログとの連携、リアルタイムな WebSocket 操作、S3 から配信される CSR UI を統合し、スクラムチームがどの環境でも同じワークフローを実行できるようにする。

## Requirements

### Requirement 1: Serverless WebSocket Backend
**Objective:** As a ファシリテーター, I want Lambda ベースの WebSocket API が PBI 取得と見積もり更新を処理する, so that コンテナ版と同じリアルタイム操作を実現できる

#### Acceptance Criteria
1. When WebSocket クライアントが `$connect` を行うとき, the Serverless WebSocket サービス shall 検証した sessionId と joinToken を接続メタデータとして保持する。
2. When クライアントが `listPbis` アクションとフィルターを送信するとき, the Serverless WebSocket サービス shall Notion クライアント (実 or モック) から PBI を取得して `listPbisResult` を返す。
3. When クライアントが `updateStoryPoint` アクションで pbiId・point・memo を送信するとき, the Serverless WebSocket サービス shall 対応する PBI を更新し `updateStoryPointResult` を返却する。
4. If Notion API 呼び出しや入力検証で失敗が発生した場合, the Serverless WebSocket サービス shall `error` イベントに理由を含めて接続へ送信する。
5. While WebSocket 接続が維持されている間, the Serverless WebSocket サービス shall connectionId と stage を基に API Gateway Management API もしくは `WS_CALLBACK_ENDPOINT` を通じてレスポンスを配信する。

### Requirement 2: CSR Planning UI on S3
**Objective:** As a プランニング参加者, I want S3 配信の CSR UI から同じフィルター・投票操作を行う, so that サーバーレス構成でも見積もりを完結できる

#### Acceptance Criteria
1. When ユーザーが S3/CloudFront から CSR ページを読み込むとき, the Serverless CSR Web shall `NEXT_PUBLIC_WS_ENDPOINT` を読み取り WebSocket 接続を初期化する。
2. When ユーザーが Status/Search/Sprint フィルターを更新して `Fetch PBIs` を押下するとき, the Serverless CSR Web shall `listPbis` アクションを送信しテーブルを更新する。
3. When ユーザーが PBI を選択して Story Point と memo を指定し `Update` を押下するとき, the Serverless CSR Web shall `updateStoryPoint` を送信し結果メッセージを表⽰する。
4. If WebSocket 接続が切断またはエラー状態になった場合, the Serverless CSR Web shall 接続ステータスを表示し更新系ボタンを無効化する。
5. While PBI 一覧が取得済みで選択項目がない間, the Serverless CSR Web shall 先頭の PBI を自動選択して投票操作を可能にする。
6. Where PBI に status・sprint・assignee・lastEstimatedAt が存在する, the Serverless CSR Web shall 該当情報をテーブルに表示して容認できるようにする。

### Requirement 3: Configuration and Deployment Controls
**Objective:** As a プラットフォームエンジニア, I want serverless/ 構成をステージごとに設定・デプロイできる, so that 環境差を最小化しつつコンテナ版と同じビヘイビアを提供できる

#### Acceptance Criteria
1. When `NEXT_PUBLIC_WS_ENDPOINT` または `NEXT_PUBLIC_REST_ENDPOINT` が設定されているとき, the Serverless System shall その値を CSR UI の接続先として利用する。
2. If `NOTION_TOKEN` などの必須環境変数が未設定の場合, the Serverless System shall モックデータにフォールバックし接続エラーを回避する。
3. When `WS_CALLBACK_ENDPOINT` が指定されているとき, the Serverless WebSocket サービス shall そのエンドポイントを基に `@connections` への POST を送信する。
4. Where デプロイターゲットが S3 + CloudFront である, the Serverless CSR Web shall `pnpm export:serverless` 成果物を相対パス参照にして静的配信できるようにする。
5. The Serverless System shall IaC/ドキュメントに API Gateway WebSocket ルート (`$connect`, `$disconnect`, `$default`) と Lambda の紐付け手順を含める。
6. The Serverless System shall Terraform ベースの IaC を serverless/ 内に保持し、Lambda・API Gateway WebSocket・S3・CloudFront を同じ設定で構築できるようにする。

### Requirement 4: Reliability and Observability Parity
**Objective:** As a SRE, I want serverless/ 構成でエラー検知とリカバリを行える, so that コンテナ版と同等の信頼性を保証できる

#### Acceptance Criteria
1. When 任意の WebSocket アクションを処理するとき, the Serverless WebSocket サービス shall sessionId・action・connectionId を含む構造化ログを出力する。
2. If 受信ボディが JSON として解析できない場合, the Serverless WebSocket サービス shall `error` イベントを返し 400 系の応答を記録する。
3. When Lambda がスロットルや失敗を検出したとき, the Serverless System shall CloudWatch メトリクス/アラームにエラー数を公開する。
4. While 接続数が設定した同時実行上限 (10 接続) を超える恐れがある間, the Serverless System shall 追加接続を拒否または遅延させて既存セッションを保護する。
5. The Serverless System shall 重要な操作 (PBI 更新・接続/切断・エラー) のテレメトリをサマリできるようダッシュボード化のためのメトリクス項目を提供する。
