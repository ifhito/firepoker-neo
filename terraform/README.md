# FirePoker Terraform Infrastructure

このディレクトリには、FirePokerアプリケーションのAWSインフラをTerraformで管理するためのコードが含まれています。

## 📋 目次

- [構成概要](#構成概要)
- [前提条件](#前提条件)
- [初回セットアップ](#初回セットアップ)
- [環境別デプロイ](#環境別デプロイ)
- [リソース一覧](#リソース一覧)
- [運用](#運用)
- [トラブルシューティング](#トラブルシューティング)

## 🏗️ 構成概要

このTerraform構成では、**社内ツール向けの最小構成**で以下のAWSリソースを作成します:

- **ネットワーク**: VPC、パブリックサブネット（2 AZ）、Internet Gateway
- **ロードバランサー**: Application Load Balancer (ALB)
- **コンテナ**: ECS Fargate クラスター、タスク定義、サービス
- **ストレージ**: ECR リポジトリ
- **シークレット**: Secrets Manager (Notion認証情報)
- **ログ**: CloudWatch Logs
- **セキュリティ**: Security Groups、IAM Roles

### コスト最適化のポイント

✅ **NAT Gateway削除** - パブリックサブネットで直接実行（月$90削減）  
✅ **プライベートサブネット削除** - シンプルなネットワーク構成  
✅ **Auto Scaling無効** - 固定1タスクで十分  
✅ **最小リソース** - 0.25 vCPU / 512 MB (Fargate最小構成)

### アーキテクチャ図

```
Internet
    │
    ▼
[ALB (Public Subnets × 2 AZ)]
    │
    ▼
[ECS Task (Public Subnet)]
    ├─ App Container (Next.js + Socket.IO)
    └─ Redis Container (サイドカー)
    │
    ▼
[Internet Gateway] → [Notion API]
```

## ✅ 前提条件

### 必要なツール

- **Terraform**: v1.5.0以上
- **AWS CLI**: v2.0以上
- **Docker**: コンテナイメージビルド用

### AWS認証情報

AWS CLIで認証情報を設定してください:

```bash
aws configure
```

または環境変数で設定:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="ap-northeast-1"
```

### Notion認証情報

以下の情報を用意してください:

- `NOTION_TOKEN`: Notion APIトークン
- `NOTION_PBI_DB_ID`: PBIデータベースID

## 🚀 初回セットアップ

### 1. Terraformの初期化

```bash
cd terraform
terraform init
```

### 2. 変数の設定

環境変数でNotion認証情報を設定:

```bash
export TF_VAR_notion_token="your-notion-token"
export TF_VAR_notion_pbi_db_id="your-pbi-database-id"
```

または、`terraform.tfvars`ファイルを作成 (注: Gitにコミットしないこと):

```hcl
notion_token     = "your-notion-token"
notion_pbi_db_id = "your-pbi-database-id"
```

### 3. プランの確認

開発環境の場合:

```bash
terraform plan -var-file="dev.tfvars"
```

本番環境の場合:

```bash
terraform plan -var-file="prod.tfvars"
```

### 4. インフラのデプロイ

開発環境:

```bash
terraform apply -var-file="dev.tfvars"
```

本番環境:

```bash
terraform apply -var-file="prod.tfvars"
```

確認プロンプトで `yes` を入力してください。

### 5. 出力情報の確認

デプロイ完了後、以下のコマンドで重要な情報を確認できます:

```bash
terraform output
```

特に以下の情報が重要です:

```bash
# ALBのURLを確認
terraform output alb_url

# ECRリポジトリURLを確認
terraform output ecr_repository_url
```

## 📦 環境別デプロイ

### 開発環境 (dev)

- **タスク数**: 1（固定）
- **リソース**: 0.25 vCPU / 512 MB メモリ（Fargate最小）
- **コスト**: 約 **$30/月**

```bash
terraform workspace select dev || terraform workspace new dev
terraform apply -var-file="dev.tfvars"
```

### 本番環境 (prod)

- **タスク数**: 1（固定、社内ツール用）
- **リソース**: 0.5 vCPU / 1 GB メモリ
- **コスト**: 約 **$50/月**

```bash
terraform workspace select prod || terraform workspace new prod
terraform apply -var-file="prod.tfvars"
```

## 📋 リソース一覧

### ネットワーク

| リソース | 説明 |
|---------|------|
| VPC | 10.0.0.0/16 (dev) または 10.1.0.0/16 (prod) |
| パブリックサブネット | 2 AZ（ALB最小要件 + ECSタスク実行）|
| Internet Gateway | VPCに1つ（外部通信用）|

### コンピューティング

| リソース | 説明 |
|---------|------|
| ECS Cluster | Fargate対応、Container Insights有効 |
| ECS Service | 固定1タスク（Auto Scaling無効）|
| Task Definition | App + Redis の2コンテナ構成（サイドカーパターン）|

### セキュリティ

| リソース | 説明 |
|---------|------|
| ALB Security Group | HTTP (80) / HTTPS (443) 受付 |
| ECS Security Group | ALBからのみ3000番ポート許可 |
| IAM Task Execution Role | ECR pull、CloudWatch Logs、Secrets Manager |
| IAM Task Role | アプリケーションのAWSサービスアクセス用 |

### ストレージ・ログ

| リソース | 説明 |
|---------|------|
| ECR Repository | Dockerイメージ保存 (最新10イメージ保持) |
| CloudWatch Logs | 7日間保持 |
| Secrets Manager | Notion認証情報 (暗号化保存) |

## 🔧 運用

### コンテナイメージのデプロイ

1. **イメージのビルドとプッシュ**:

```bash
# ECRにログイン
aws ecr get-login-password --region ap-northeast-1 | \
  docker login --username AWS --password-stdin $(terraform output -raw ecr_repository_url | cut -d'/' -f1)

# イメージのビルド
cd ..
docker build -t firepoker .

# タグ付け
ECR_URL=$(cd terraform && terraform output -raw ecr_repository_url)
docker tag firepoker:latest $ECR_URL:latest
docker tag firepoker:latest $ECR_URL:$(git rev-parse --short HEAD)

# プッシュ
docker push $ECR_URL:latest
docker push $ECR_URL:$(git rev-parse --short HEAD)
```

2. **ECSサービスの更新**:

```bash
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --force-new-deployment
```

### スケーリング調整

```bash
# 手動でタスク数を変更
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 3
```

### ログの確認

```bash
# CloudWatch Logsを確認
aws logs tail /ecs/firepoker --follow
```

### 状態の確認

```bash
# ECSサービスの状態確認
aws ecs describe-services \
  --cluster firepoker-cluster \
  --services firepoker-service
```

## 🐛 トラブルシューティング

### タスクが起動しない

1. **CloudWatch Logsを確認**:

```bash
aws logs tail /ecs/firepoker --follow
```

2. **タスクの停止理由を確認**:

```bash
aws ecs describe-tasks \
  --cluster firepoker-cluster \
  --tasks $(aws ecs list-tasks --cluster firepoker-cluster --service firepoker-service --query 'taskArns[0]' --output text)
```

3. **よくある原因**:
   - Secrets Managerから認証情報を取得できない
   - ヘルスチェックが失敗している
   - コンテナイメージが存在しない

### ヘルスチェック失敗

```bash
# ALB経由でヘルスチェックエンドポイントを確認
ALB_URL=$(cd terraform && terraform output -raw alb_url)
curl $ALB_URL/api/health
```

期待されるレスポンス:

```json
{
  "status": "ok",
  "timestamp": "2025-10-12T...",
  "service": "firepoker"
}
```

### Secrets Managerエラー

```bash
# シークレットが存在するか確認
aws secretsmanager describe-secret \
  --secret-id firepoker/notion-token

# シークレットの値を確認 (注意: 本番環境では実行しない)
aws secretsmanager get-secret-value \
  --secret-id firepoker/notion-token \
  --query 'SecretString' \
  --output text
```

### インフラの再作成

特定のリソースを再作成する場合:

```bash
# 例: ECSサービスを再作成
terraform taint aws_ecs_service.main
terraform apply -var-file="prod.tfvars"
```

## 🧹 クリーンアップ

### インフラの削除

**警告**: これにより全てのリソースが削除されます。

```bash
terraform destroy -var-file="dev.tfvars"
```

または

```bash
terraform destroy -var-file="prod.tfvars"
```

### 削除前の確認事項

- [ ] データのバックアップは完了していますか？
- [ ] 他のサービスへの依存関係はありませんか？
- [ ] ECRのイメージは保存済みですか？

## 📚 参考資料

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)

## 🔒 セキュリティ注意事項

1. **認証情報の管理**
   - `.tfvars`ファイルにシークレットを直接書かない
   - 環境変数またはSecrets Managerを使用
   - Gitに認証情報をコミットしない

2. **アクセス制御**
   - IAMロールは最小権限の原則に従う
   - Security Groupは必要最小限のポートのみ開放

3. **ログとモニタリング**
   - CloudWatch Logsで異常を監視
   - AWS CloudTrailで操作履歴を記録

### Zscaler IPホワイトリスト

Zscalerを使用している場合、`enable_zscaler_ips = true`に設定することで、Zscalerの公開IPアドレスが自動的にALBセキュリティグループに追加されます。

```hcl
# dev.tfvars または prod.tfvars
enable_zscaler_ips = true

# 都市でフィルタリング（推奨）
# 東京のみの場合
zscaler_city_filter = ["Tokyo"]

# 東京と大阪の場合
# zscaler_city_filter = ["Tokyo", "Osaka"]

# 全世界の場合（非推奨：ルール数が膨大になります）
# zscaler_city_filter = []

allowed_cidr_blocks = [
  "YOUR_OFFICE_IP/32",  # オフィスの固定IP
]
```

**注意事項**:
- Zscaler IPリストは公式API（`https://config.zscaler.com/api/zscaler.net/cenr/json`）から自動取得されます
- **都市フィルタの使用を強く推奨** - 全世界のIPを含めると数百件になります
- 東京の場合: `zscaler_city_filter = ["Tokyo"]` で約10-20個のIP範囲に絞られます
- リストは定期的に更新されるため、`terraform apply`実行時に最新のIPが反映されます

## 💰 コスト見積もり（最小構成）

### 開発環境 (1タスク、最小リソース)

- **ECS Fargate**: 0.25 vCPU × $0.04656/h + 0.5 GB × $0.00511/h ≈ **$12/月**
- **ALB**: $0.0243/h ≈ **$18/月**
- **合計**: 約 **$30/月** 🎉

### 本番環境 (1タスク)

- **ECS Fargate**: 0.5 vCPU × $0.04656/h + 1 GB × $0.00511/h ≈ **$28/月**
- **ALB**: $0.0243/h ≈ **$18/月**
- **合計**: 約 **$46/月** 🎉

### 💡 コスト削減ポイント

- ✅ **NAT Gateway削除**: **$90/月削減**（パブリックサブネット使用）
- ✅ **Auto Scaling無効**: 固定1タスクで十分
- ✅ **最小リソース**: Fargate最小構成（0.25 vCPU / 512 MB）
- ✅ **プライベートサブネット不要**: シンプルな構成

**従来構成 $136/月 → 最小構成 $30/月（78%削減！）**

*注: データ転送料やCloudWatch Logs料金は含まれていません*

## 📞 サポート

問題が発生した場合:

1. [トラブルシューティング](#トラブルシューティング)セクションを確認
2. CloudWatch Logsでエラーログを確認
3. GitHub Issuesで報告

---

**作成日**: 2025-10-12  
**Terraformバージョン**: 1.5.0+  
**AWSプロバイダーバージョン**: 5.0+
