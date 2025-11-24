# Terraform Module Strategy

## Purpose
serverless/terraform 以下で Lambda + WebSocket, S3 + CloudFront, Secrets + Dynamo をモジュール分割し、環境ごとの差分を tfvars/outputs で吸収するためのルールを定義する。コンテナ向け Terraform と混在させず、serverless スタック単体で再利用できる構成を目指す。

## Module Layout
- **modules/websocket_lambda**: Lambda 実行ロール, APIGW WebSocket, ルート (`$default/$connect/$disconnect`), ステージ, `ws_endpoint` / `ws_callback_endpoint` 出力をまとめる。Throttling (`max_connections`) を module 変数で制御し、CloudWatch logging を既定で ON。
- **modules/static_site**: S3 バケット (versioning+public block) + CloudFront Distribution + Origin Access Control を１モジュールに束ねる。`static_site_domain` とバケット名を output にし、`pnpm export:serverless` 成果物デプロイ先を固定。
- **modules/session_access**: Secrets Manager (Notion 認証情報) と DynamoDB (`session_access_table`) を一括管理。Hash key は `sessionId`、LSI で `joinTokenHash` を検索できるようにする。Secret JSON と TTL 有効化は変数で切り替え。
- **environments/<env>**: 各環境は `main.tf` で上記モジュールを呼び出し、`tfvars` に環境固有値 (ドメイン, 証明書, secret JSON) を定義。state backend は serverless 専用 (S3/Dynamo) を設定。

## Naming & Versioning
- すべての module は `terraform.required_version >= 1.5.0` と `aws provider >= 5.0` を宣言し、`terraform fmt` 済みで管理する。
- Lambda 名と API 名には `${var.function_name}` プレフィックスを使用し、Stage は `var.stage_name` で統一 (prod / dev など)。
- S3 バケットは `fire-pocker-${env}-serverless-web` のようなユニーク値を tfvars で渡す。CloudFront alias が無い場合は `domain_aliases = []` を渡して default domain を利用。

## Module Inputs/Outputs Pattern
- **Inputs**: 変数は map/string ベースで簡潔に。例: `environment` map に Lambda 環境変数を集約。
- **Outputs**: クライアント/CI が参照する値だけを露出する (ws_endpoint, ws_callback_endpoint, static_site_domain, session_access_table_name, notion_secret_arn)。Terraform 側で URL を組み立ててから出力することでアプリコードのロジックを単純化。

## Testing & Validation
- `serverless/tests/terraformModules.test.ts` のように Vitest で module ファイル存在と主要リソース/outputs を静的に検証する。新しい module を追加する場合はテストを RED → GREEN の TDD で記述。
- `terraform validate` と `terraform plan` は CI で各環境ディレクトリごとに実行し、plan 成功後のみデプロイ (apply) を許可する。

## Implementation Guidance
1. **Module追加**: modules ディレクトリに `variables.tf`/`main.tf`/`outputs.tf` を必ず揃え、README ではなく steering でルールを明記する。
2. **Routing/Throttling**: WebSocket module は `default_route_settings` で `throttling_burst_limit = throttling_rate_limit = max_connections` を設定し、要件の 10 接続上限を tfvars で渡す。
3. **Security**: Secrets Manager と Dynamo については、Lambda ロールに必要最小限の権限 (GetSecretValue, dynamodb:GetItem/UpdateItem) を `policy_statements` 変数経由で追加できるようにしておく。
4. **Outputs -> App**: `pnpm export:serverless` や Lambda デプロイは Terraform outputs を jq 等で取得し、`.env`/CI context に注入する。ws_callback_endpoint は `https://${api_id}.execute-api.${region}.amazonaws.com/${stage}` 形式で module 内で構築し、アプリ側はそのまま利用する。

## Review Checklist
- [ ] module に 3 ファイル (variables/main/outputs) が揃っているか
- [ ] `required_version` / provider version が steering の値と一致しているか
- [ ] 新規リソースが既存 module と責務が被っていないか
- [ ] outputs が CI/アプリで必要な値に限定されているか
- [ ] Vitest の Terraform モジュール検証テストが更新されているか

このファイルは Terraform module 設計の基準として参照し、新規スタックや機能追加時は内容に沿ってモジュール化・検証を進める。
