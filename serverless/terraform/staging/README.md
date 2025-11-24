# Staging Environment

Terraform 構成の雛形です。`terraform.tfvars` に実際の値を用意し、以下の手順でデプロイします。

```bash
cd serverless/terraform/staging
cp terraform.tfvars.example terraform.tfvars   # 実値に書き換え
terraform init
terraform apply
```

- `module.session_access` が Notion 秘匿情報と DynamoDB テーブルを作成します。
- `module.websocket_lambda` は Lambda + API Gateway WebSocket を構築し、Secrets/Dynamo へのアクセス権限を付与します。
- `module.static_site` は S3 + CloudFront で CSR アプリの配信経路を用意します。
- `module.monitoring` は ConnectionsActive/Throttles/5XXError のアラームを SNS へ通知します。

`terraform output -json > ../staging.outputs.json` を実行し、`pnpm export:serverless -- --outputs serverless/terraform/staging.outputs.json --stage staging` で CSR ビルドへエンドポイントを注入してください。
