# FirePoker インフラ構築ガイド

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [前提条件](#前提条件)
4. [初回セットアップ](#初回セットアップ)
5. [デプロイ手順](#デプロイ手順)
6. [運用](#運用)
7. [トラブルシューティング](#トラブルシューティング)
8. [コスト管理](#コスト管理)

---

## 概要

FirePokerは、Planning Pokerセッションを実施するための社内ツールです。
このドキュメントでは、AWS上での最小コスト構成でのインフラ構築方法を説明します。

### 技術スタック

- **フロントエンド**: Next.js 14 (App Router)
- **リアルタイム通信**: Socket.IO
- **セッション管理**: Redis (コンテナ内サイドカー)
- **データ連携**: Notion API
- **インフラ**: AWS ECS Fargate
- **IaC**: Terraform

### インフラの特徴

✅ **コスト最適化**: 月額 $30~46（社内ツール向け最小構成）  
✅ **シンプル**: NAT Gateway不要、パブリックサブネット構成  
✅ **スケーラブル**: 必要に応じて簡単にスケールアップ可能  
✅ **コード管理**: Terraform による Infrastructure as Code

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Application Load Balancer (ALB)  │
        │   - HTTP (Port 80)                 │
        │   - Health Check: /api/health      │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │      ECS Fargate Service           │
        │  ┌──────────────────────────────┐  │
        │  │  Task (Public Subnet)        │  │
        │  │  ┌─────────────────────────┐ │  │
        │  │  │ App Container           │ │  │
        │  │  │ - Next.js + Socket.IO   │ │  │
        │  │  │ - Port 3000             │ │  │
        │  │  └────────┬────────────────┘ │  │
        │  │           │ localhost        │  │
        │  │  ┌────────▼────────────────┐ │  │
        │  │  │ Redis Container         │ │  │
        │  │  │ - Port 6379             │ │  │
        │  │  │ - In-memory storage     │ │  │
        │  │  └─────────────────────────┘ │  │
        │  └──────────────────────────────┘  │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │      Internet Gateway              │
        └────────────┬───────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────┐
        │         Notion API                 │
        │    (PBI データベース)              │
        └────────────────────────────────────┘
```

### ネットワーク構成

```
VPC: 10.0.0.0/16 (dev) / 10.1.0.0/16 (prod)
├─ Public Subnet 1: 10.0.0.0/24 (ap-northeast-1a)
│  ├─ ALB
│  └─ ECS Task 1
│
└─ Public Subnet 2: 10.0.1.0/24 (ap-northeast-1c)
   ├─ ALB (冗長性)
   └─ (ECS Task 2 - 必要に応じて)

Note: NAT Gateway は不要（コスト削減のため）
```

### セキュリティグループ

#### ALB Security Group
- **Inbound**:
  - HTTP (80) from 0.0.0.0/0
  - HTTPS (443) from 0.0.0.0/0 ※証明書設定時
- **Outbound**:
  - All traffic to 0.0.0.0/0

#### ECS Security Group
- **Inbound**:
  - Port 3000 from ALB Security Group のみ
- **Outbound**:
  - All traffic to 0.0.0.0/0 (Notion API通信用)

### リソース一覧

| リソース | 説明 | 用途 | 月額コスト |
|---------|------|------|-----------|
| VPC | 仮想プライベートクラウド | ネットワーク分離 | 無料 |
| Internet Gateway | インターネット接続 | 外部通信 | 無料 |
| Public Subnet × 2 | パブリックサブネット | ALB + ECS配置 | 無料 |
| ALB | Application Load Balancer | 負荷分散・ヘルスチェック | $18/月 |
| ECS Cluster | Fargateクラスター | コンテナ実行環境 | 無料 |
| ECS Service | Fargateサービス | タスク管理 | 無料 |
| ECS Task | Fargateタスク | アプリケーション実行 | $12~28/月 |
| ECR Repository | コンテナレジストリ | イメージ保存 | $1/月程度 |
| CloudWatch Logs | ログ管理 | アプリケーションログ | $5/月程度 |
| Secrets Manager | シークレット管理 | Notion認証情報 | $0.80/月 |
| **合計** | | | **$30~46/月** |

---

## 前提条件

### 必要なツール

```bash
# Terraformのインストール確認
terraform version
# 必要: v1.5.0以上

# AWS CLIのインストール確認
aws --version
# 必要: v2.0以上

# Dockerのインストール確認
docker --version
# 必要: 20.10以上

# Node.jsのインストール確認
node --version
# 必要: 20.x以上

# pnpmのインストール確認
pnpm --version
# 必要: 8.x以上
```

### AWS認証情報の設定

```bash
# 方法1: AWS CLIで設定
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: ap-northeast-1
# Default output format: json

# 方法2: 環境変数で設定
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="ap-northeast-1"
```

### Notion認証情報の取得

1. **Notion Integration作成**
   - https://www.notion.so/my-integrations にアクセス
   - 「New Integration」をクリック
   - 名前: FirePoker、タイプ: Internal
   - 権限: Read content, Update content
   - 「Submit」をクリック
   - **Internal Integration Token** をコピー（`secret_...`で始まる）

2. **PBIデータベースIDの取得**
   - NotionでPBIデータベースを開く
   - URLから32文字のIDを取得
   - 例: `https://www.notion.so/287496327baf80a0b54af179dbd34dd6?v=...`
   - この場合、IDは `287496327baf80a0b54af179dbd34dd6`

3. **データベースへの接続許可**
   - PBIデータベースを開く
   - 右上の「...」→「Connections」→「Add connections」
   - 作成したIntegrationを選択

### 必要な権限

AWS IAMユーザーには以下の権限が必要です：

- `AmazonEC2FullAccess`
- `AmazonECS_FullAccess`
- `AmazonVPCFullAccess`
- `IAMFullAccess`
- `CloudWatchLogsFullAccess`
- `SecretsManagerReadWrite`
- `AmazonEC2ContainerRegistryFullAccess`
- `ElasticLoadBalancingFullAccess`

または、管理者権限（`AdministratorAccess`）

---

## 初回セットアップ

### 1. リポジトリのクローン

```bash
# リポジトリをクローン
git clone https://github.com/ifhito/firepoker-neo.git
cd firepoker-neo

# 依存関係のインストール
pnpm install
```

### 2. Terraformの初期化

```bash
cd terraform
terraform init
```

**出力例:**
```
Initializing the backend...
Initializing provider plugins...
- Finding hashicorp/aws versions matching "~> 5.0"...
- Installing hashicorp/aws v5.xx.x...

Terraform has been successfully initialized!
```

### 3. 環境変数の設定

```bash
# Notion認証情報を環境変数に設定
export TF_VAR_notion_token="secret_YOUR_NOTION_TOKEN"
export TF_VAR_notion_pbi_db_id="287496327baf80a0b54af179dbd34dd6"

# 永続化する場合は ~/.zshrc または ~/.bashrc に追加
echo 'export TF_VAR_notion_token="secret_YOUR_NOTION_TOKEN"' >> ~/.zshrc
echo 'export TF_VAR_notion_pbi_db_id="YOUR_DATABASE_ID"' >> ~/.zshrc
source ~/.zshrc
```

### 4. インフラのデプロイ（簡単な方法）

```bash
# プロジェクトルートに戻る
cd ..

# 対話型セットアップスクリプトを実行
./scripts/terraform-setup.sh
```

スクリプトが以下を自動で実行します：
1. 前提条件のチェック
2. Terraformの初期化
3. 環境選択（dev/prod）
4. 認証情報の確認
5. プランの作成と確認
6. インフラのデプロイ

### 5. インフラのデプロイ（手動の方法）

```bash
cd terraform

# 開発環境の場合
terraform plan -var-file="dev.tfvars"
terraform apply -var-file="dev.tfvars"

# 本番環境の場合
terraform plan -var-file="prod.tfvars"
terraform apply -var-file="prod.tfvars"

# 確認プロンプトで "yes" を入力
```

### 6. デプロイ情報の確認

```bash
# 重要な出力情報を表示
terraform output

# 個別に確認
terraform output alb_url
terraform output ecr_repository_url
terraform output ecs_cluster_name
```

**出力例:**
```
alb_url = "http://firepoker-alb-1234567890.ap-northeast-1.elb.amazonaws.com"
ecr_repository_url = "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/firepoker"
ecs_cluster_name = "firepoker-cluster"
```

---

## デプロイ手順

### 1. Dockerイメージのビルド

```bash
# プロジェクトルートで実行
docker build -t firepoker .
```

### 2. ECRへのプッシュ

#### 方法1: スクリプトを使用（推奨）

```bash
./scripts/build-and-push.sh
```

#### 方法2: 手動でプッシュ

```bash
# ECRリポジトリURLを取得
ECR_URL=$(cd terraform && terraform output -raw ecr_repository_url)
REGION="ap-northeast-1"
ACCOUNT_ID=$(echo $ECR_URL | cut -d'.' -f1)

# ECRにログイン
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# イメージにタグ付け
docker tag firepoker:latest $ECR_URL:latest
docker tag firepoker:latest $ECR_URL:$(git rev-parse --short HEAD)

# プッシュ
docker push $ECR_URL:latest
docker push $ECR_URL:$(git rev-parse --short HEAD)
```

### 3. ECSサービスの更新

#### 方法1: スクリプトを使用（推奨）

```bash
./scripts/deploy-ecs.sh
```

#### 方法2: 手動でデプロイ

```bash
# ECSサービスを強制的に新しいデプロイで更新
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --force-new-deployment \
  --region ap-northeast-1

# デプロイの完了を待機
aws ecs wait services-stable \
  --cluster firepoker-cluster \
  --services firepoker-service \
  --region ap-northeast-1
```

### 4. デプロイの確認

```bash
# ALB URLを取得
ALB_URL=$(cd terraform && terraform output -raw alb_url)

# ヘルスチェックエンドポイントを確認
curl $ALB_URL/api/health

# 期待される出力:
# {
#   "status": "ok",
#   "timestamp": "2025-10-12T12:34:56.789Z",
#   "service": "firepoker"
# }

# ブラウザでアクセス
echo "Application URL: $ALB_URL"
```

---

## 運用

### ログの確認

#### CloudWatch Logs

```bash
# リアルタイムでログをストリーミング
aws logs tail /ecs/firepoker --follow

# アプリケーションログのみ
aws logs tail /ecs/firepoker --follow --filter-pattern "app/"

# Redisログのみ
aws logs tail /ecs/firepocker --follow --filter-pattern "redis/"

# 過去1時間のログを表示
aws logs tail /ecs/firepoker --since 1h

# エラーログのみを抽出
aws logs tail /ecs/firepoker --follow --filter-pattern "ERROR"
```

#### ECSコンソールでログ確認

1. AWSコンソールにログイン
2. ECS → Clusters → firepoker-cluster
3. Services → firepoker-service → Tasks
4. タスクをクリック → Logs タブ

### サービスの状態確認

```bash
# ECSサービスの状態を確認
aws ecs describe-services \
  --cluster firepoker-cluster \
  --services firepoker-service \
  --region ap-northeast-1

# 実行中のタスク一覧
aws ecs list-tasks \
  --cluster firepoker-cluster \
  --service-name firepoker-service \
  --region ap-northeast-1

# タスクの詳細情報
TASK_ARN=$(aws ecs list-tasks \
  --cluster firepoker-cluster \
  --service-name firepoker-service \
  --query 'taskArns[0]' \
  --output text)

aws ecs describe-tasks \
  --cluster firepoker-cluster \
  --tasks $TASK_ARN \
  --region ap-northeast-1
```

### スケーリング

#### 手動スケーリング

```bash
# タスク数を増やす
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 2 \
  --region ap-northeast-1

# タスク数を減らす
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 1 \
  --region ap-northeast-1
```

#### Terraformでのスケーリング

```bash
# dev.tfvars または prod.tfvars を編集
# ecs_desired_count = 2

cd terraform
terraform apply -var-file="dev.tfvars"
```

### 環境変数の更新

```bash
# Secrets Managerの値を更新
aws secretsmanager update-secret \
  --secret-id firepoker/notion-token \
  --secret-string "new_secret_value" \
  --region ap-northeast-1

# ECSサービスを再デプロイ（新しいシークレットを読み込む）
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --force-new-deployment \
  --region ap-northeast-1
```

### バックアップ

#### ECRイメージのバックアップ

```bash
# 全イメージをローカルにプル
ECR_URL=$(cd terraform && terraform output -raw ecr_repository_url)

# 全タグを取得
aws ecr describe-images \
  --repository-name firepoker \
  --region ap-northeast-1 \
  --query 'imageDetails[*].imageTags[0]' \
  --output text | while read tag; do
  docker pull $ECR_URL:$tag
  docker save $ECR_URL:$tag | gzip > firepoker-$tag.tar.gz
done
```

#### Terraform Stateのバックアップ

```bash
cd terraform

# Stateファイルをダウンロード
terraform state pull > terraform.tfstate.backup.$(date +%Y%m%d-%H%M%S)

# S3バックエンド使用時
aws s3 cp s3://firepoker-terraform-state/prod/terraform.tfstate \
  ./terraform.tfstate.backup.$(date +%Y%m%d-%H%M%S)
```

---

## トラブルシューティング

### タスクが起動しない

#### 1. タスクのイベントログを確認

```bash
aws ecs describe-services \
  --cluster firepoker-cluster \
  --services firepoker-service \
  --query 'services[0].events[0:5]' \
  --region ap-northeast-1
```

#### 2. 停止したタスクの理由を確認

```bash
# 最新の停止タスクを取得
STOPPED_TASK=$(aws ecs list-tasks \
  --cluster firepoker-cluster \
  --desired-status STOPPED \
  --query 'taskArns[0]' \
  --output text)

# 停止理由を確認
aws ecs describe-tasks \
  --cluster firepoker-cluster \
  --tasks $STOPPED_TASK \
  --query 'tasks[0].stoppedReason' \
  --region ap-northeast-1
```

#### 3. CloudWatch Logsを確認

```bash
aws logs tail /ecs/firepoker --since 30m
```

#### よくある原因と対処法

| 原因 | 対処法 |
|------|--------|
| イメージが見つからない | ECRにイメージがプッシュされているか確認 |
| Secrets Managerアクセス拒否 | IAMロールの権限を確認 |
| ヘルスチェック失敗 | `/api/health` エンドポイントが正常に応答するか確認 |
| メモリ不足 | タスク定義のメモリ設定を増やす |
| CPU不足 | タスク定義のCPU設定を増やす |

### ヘルスチェックが失敗する

```bash
# タスクのプライベートIPを取得
TASK_ARN=$(aws ecs list-tasks \
  --cluster firepoker-cluster \
  --service-name firepoker-service \
  --query 'taskArns[0]' \
  --output text)

PRIVATE_IP=$(aws ecs describe-tasks \
  --cluster firepoker-cluster \
  --tasks $TASK_ARN \
  --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
  --output text)

# セキュリティグループのInbound ruleを一時的に追加してアクセステスト
# 注意: 本番環境では推奨されません
curl http://$PRIVATE_IP:3000/api/health
```

### ALBに接続できない

```bash
# ALBの状態を確認
aws elbv2 describe-load-balancers \
  --names firepoker-alb \
  --region ap-northeast-1

# ターゲットグループのヘルス状態を確認
TG_ARN=$(aws elbv2 describe-target-groups \
  --names firepoker-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

aws elbv2 describe-target-health \
  --target-group-arn $TG_ARN \
  --region ap-northeast-1
```

**ヘルシーでない場合:**
- ヘルスチェックのパス（`/api/health`）が正しいか確認
- セキュリティグループでポート3000が開いているか確認
- アプリケーションが正常に起動しているか確認

### Notion APIエラー

```bash
# アプリケーションログでNotionエラーを検索
aws logs tail /ecs/firepoker --since 1h --filter-pattern "Notion"

# シークレットが正しく設定されているか確認
aws secretsmanager get-secret-value \
  --secret-id firepoker/notion-token \
  --query 'SecretString' \
  --output text

aws secretsmanager get-secret-value \
  --secret-id firepoker/notion-pbi-db-id \
  --query 'SecretString' \
  --output text
```

**よくある原因:**
- Notion Tokenの有効期限切れ → 再発行
- データベースIDが間違っている → 確認
- IntegrationがデータベースにConnectされていない → Notion側で設定

### コスト超過

```bash
# 現在のコストを確認（AWS Cost Explorerを使用）
aws ce get-cost-and-usage \
  --time-period Start=$(date -v-7d +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics "UnblendedCost" \
  --group-by Type=SERVICE \
  --region us-east-1

# 主なコスト要因をチェック
# 1. NAT Gatewayが作成されていないか確認
aws ec2 describe-nat-gateways --region ap-northeast-1

# 2. 不要なECS タスクが実行されていないか確認
aws ecs list-tasks --cluster firepoker-cluster --region ap-northeast-1

# 3. ALBのリクエスト数を確認（CloudWatch）
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=app/firepoker-alb/xxx \
  --start-time $(date -u -v-1d +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region ap-northeast-1
```

---

## コスト管理

### 月額コストの内訳

#### 開発環境 (dev)

```
ECS Fargate Task:
  - CPU: 0.25 vCPU × $0.04656/hour × 730 hours = $8.50
  - Memory: 0.5 GB × $0.00511/hour × 730 hours = $3.73
  - 小計: $12.23

ALB:
  - 時間単位: $0.0243/hour × 730 hours = $17.74
  - LCU: ~$0.008/LCU × 低負荷 = $1~2
  - 小計: $18~20

CloudWatch Logs:
  - 取り込み: 5 GB × $0.50 = $2.50
  - 保存: 5 GB × $0.03 = $0.15
  - 小計: $2.65

Secrets Manager:
  - シークレット数: 2 × $0.40 = $0.80

ECR:
  - ストレージ: 2 GB × $0.10 = $0.20
  - 転送: AWS内は無料

データ転送:
  - インターネット向け: ~1 GB × $0.114 = $0.11

合計: 約 $30~35/月
```

#### 本番環境 (prod)

```
ECS Fargate Task:
  - CPU: 0.5 vCPU × $0.04656/hour × 730 hours = $17.00
  - Memory: 1 GB × $0.00511/hour × 730 hours = $7.46
  - 小計: $24.46

ALB: $18~20

CloudWatch Logs: $5

Secrets Manager: $0.80

ECR: $0.50

データ転送: $1~2

合計: 約 $46~52/月
```

### コスト削減のヒント

#### 1. 非稼働時間にタスクを停止

```bash
# 夜間・週末にタスクを停止（開発環境のみ）
# 例: 午後8時にタスクを0に
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 0

# 翌朝8時に再開
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 1

# CloudWatch EventsやLambdaでスケジュール化可能
```

**削減効果**: 夜間12時間停止で約50%削減

#### 2. CloudWatch Logsの保持期間短縮

```bash
aws logs put-retention-policy \
  --log-group-name /ecs/firepoker \
  --retention-in-days 3 \
  --region ap-northeast-1
```

**削減効果**: $1~2/月削減

#### 3. 不要なECRイメージの削除

```bash
# 古いイメージを削除（最新10個を保持）
# Terraform lifecycle policyで自動化済み
```

#### 4. ALBアクセスログを無効化

```bash
# デフォルトで無効（追加コストなし）
# 必要な場合のみ有効化
```

### コスト監視の設定

#### AWS Budgetの設定

```bash
# 月額$50のバジェットアラートを作成
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**budget.json:**
```json
{
  "BudgetName": "FirePoker-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "50",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

**notifications.json:**
```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "your-email@example.com"
      }
    ]
  }
]
```

### リソースのクリーンアップ

#### 完全削除

```bash
# スクリプトを使用（推奨）
./scripts/terraform-destroy.sh

# または手動で
cd terraform
terraform destroy -var-file="dev.tfvars"
```

#### 一時停止（開発環境）

```bash
# ECSタスクのみ停止（ALBなどは残す）
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 0

# 再開
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 1
```

---

## CI/CD

### GitHub Actionsによる自動デプロイ

`.github/workflows/deploy-ecs.yml` が設定済みです。

#### ワークフロー

```
main ブランチへのpush
  ↓
Docker イメージビルド
  ↓
ECRへプッシュ
  ↓
ECSタスク定義更新
  ↓
ECSサービス更新
  ↓
デプロイ完了確認
```

#### GitHub Secretsの設定

リポジトリの Settings → Secrets and variables → Actions で設定:

```
AWS_ACCOUNT_ID: 123456789012
AWS_REGION: ap-northeast-1
ECS_CLUSTER: firepoker-cluster
ECS_SERVICE: firepoker-service
ECR_REPOSITORY: firepoker
NOTION_TOKEN: secret_xxx
NOTION_PBI_DB_ID: xxx
```

#### 手動デプロイのトリガー

```bash
# GitHub CLIを使用
gh workflow run deploy-ecs.yml

# またはGitHub UIから
# Actions → Deploy to ECS → Run workflow
```

---

## セキュリティ

### ベストプラクティス

#### 1. IAMロールの最小権限

```bash
# ECS Task Execution Roleの権限を確認
aws iam get-role-policy \
  --role-name firepoker-ecs-task-execution-role \
  --policy-name ecs-secrets-access

# 不要な権限があれば削除
```

#### 2. Secrets Managerの使用

```bash
# 環境変数に直接シークレットを含めない
# 必ずSecrets Managerから取得

# シークレットのローテーション設定
aws secretsmanager rotate-secret \
  --secret-id firepoker/notion-token \
  --rotation-lambda-arn arn:aws:lambda:xxx \
  --rotation-rules AutomaticallyAfterDays=30
```

#### 3. Security Groupの定期チェック

```bash
# ALB Security Groupが広く開いていないか確認
aws ec2 describe-security-groups \
  --group-ids $(aws ec2 describe-security-groups \
    --filters Name=group-name,Values=firepoker-alb-sg \
    --query 'SecurityGroups[0].GroupId' \
    --output text) \
  --region ap-northeast-1
```

#### 4. CloudTrail有効化

```bash
# API呼び出しをログに記録
aws cloudtrail create-trail \
  --name firepoker-trail \
  --s3-bucket-name firepoker-cloudtrail-logs
```

### 脆弱性スキャン

```bash
# ECRイメージの脆弱性スキャン（自動）
aws ecr start-image-scan \
  --repository-name firepoker \
  --image-id imageTag=latest

# スキャン結果の確認
aws ecr describe-image-scan-findings \
  --repository-name firepoker \
  --image-id imageTag=latest
```

---

## 付録

### よく使うコマンド集

```bash
# === 状態確認 ===
# ALB URL
terraform output -raw alb_url

# ECS タスクの状態
aws ecs describe-services --cluster firepoker-cluster --services firepoker-service

# ログのリアルタイム表示
aws logs tail /ecs/firepoker --follow

# === デプロイ ===
# 新しいイメージをデプロイ
./scripts/build-and-push.sh && ./scripts/deploy-ecs.sh

# === スケーリング ===
# タスク数変更
aws ecs update-service --cluster firepoker-cluster --service firepoker-service --desired-count 2

# === トラブルシューティング ===
# 最新のエラーログ
aws logs filter-log-events --log-group-name /ecs/firepoker --filter-pattern "ERROR" --limit 20

# ヘルスチェック
curl $(terraform output -raw alb_url)/api/health

# === クリーンアップ ===
# タスク停止
aws ecs update-service --cluster firepoker-cluster --service firepoker-service --desired-count 0

# 完全削除
./scripts/terraform-destroy.sh
```

### 参考リンク

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [AWS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [Notion API Documentation](https://developers.notion.com/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)

---

## サポート

問題が発生した場合：

1. このドキュメントのトラブルシューティングセクションを確認
2. CloudWatch Logsでエラーログを確認
3. GitHubのIssuesで報告

---

**最終更新**: 2025-10-12  
**バージョン**: 1.0.0  
**メンテナー**: FirePoker Development Team
