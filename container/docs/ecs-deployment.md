# Fire Pocker - ECS デプロイガイド

## 前提条件

- AWS CLI がインストールされ、適切な認証情報が設定されていること
- Docker がインストールされていること
- 必要な AWS リソース (VPC, サブネット, セキュリティグループ) が作成されていること

## ローカルでのDocker実行

```bash
# 環境変数ファイルを作成
cp .env.local .env.production

# Docker Composeで起動
docker-compose up -d

# ログの確認
docker-compose logs -f

# 停止
docker-compose down
```

## ECS へのデプロイ手順

### 1. ECR にイメージをプッシュ

```bash
# イメージのビルドとプッシュ
./scripts/build-and-push.sh
```

### 2. ECS クラスターの作成

```bash
aws ecs create-cluster \
  --cluster-name firepoker-cluster \
  --region ap-northeast-1
```

### 3. CloudWatch Logs グループの作成

```bash
aws logs create-log-group \
  --log-group-name /ecs/firepoker \
  --region ap-northeast-1
```

### 4. Secrets Manager にシークレットを登録

```bash
# Notion トークン
aws secretsmanager create-secret \
  --name firepoker/notion-token \
  --secret-string "your-notion-token" \
  --region ap-northeast-1

# PBI データベース ID
aws secretsmanager create-secret \
  --name firepoker/pbi-db-id \
  --secret-string "your-pbi-db-id" \
  --region ap-northeast-1
```

### 5. タスク定義の登録

```bash
# ACCOUNT_ID を実際の AWS アカウント ID に置換
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
sed -i.bak "s/ACCOUNT_ID/$AWS_ACCOUNT_ID/g" ecs-task-definition.json

# タスク定義の登録
aws ecs register-task-definition \
  --cli-input-json file://ecs-task-definition.json \
  --region ap-northeast-1
```

### 6. ECS サービスの作成

```bash
aws ecs create-service \
  --cluster firepoker-cluster \
  --service-name firepoker-service \
  --task-definition firepoker-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:ap-northeast-1:ACCOUNT_ID:targetgroup/firepoker-tg/xxxxx,containerName=firepoker-app,containerPort=3000" \
  --region ap-northeast-1
```

### 7. デプロイの更新

```bash
# 新しいイメージをデプロイ
./scripts/deploy-ecs.sh
```

## 環境変数

以下の環境変数が必要です:

- `NOTION_TOKEN`: Notion API トークン
- `NOTION_PBI_DB_ID`: PBI データベース ID
- `REDIS_HOST`: Redis ホスト (デフォルト: localhost)
- `REDIS_PORT`: Redis ポート (デフォルト: 6379)
- `NODE_ENV`: 環境 (production)

## トラブルシューティング

### ログの確認

```bash
# ECS タスクのログを確認
aws logs tail /ecs/firepoker --follow --region ap-northeast-1
```

### タスクの状態確認

```bash
aws ecs describe-tasks \
  --cluster firepoker-cluster \
  --tasks $(aws ecs list-tasks --cluster firepoker-cluster --query 'taskArns[0]' --output text) \
  --region ap-northeast-1
```

### サービスの状態確認

```bash
aws ecs describe-services \
  --cluster firepoker-cluster \
  --services firepoker-service \
  --region ap-northeast-1
```

## ALB 設定

ALB を使用する場合、以下の設定が必要です:

1. **ヘルスチェック**: `/api/health`
2. **ターゲットタイプ**: IP
3. **プロトコル**: HTTP
4. **ポート**: 3000
5. **WebSocket サポート**: 有効化

## スケーリング

```bash
# タスク数を変更
aws ecs update-service \
  --cluster firepoker-cluster \
  --service firepoker-service \
  --desired-count 2 \
  --region ap-northeast-1
```

## 注意事項

- Redis はサイドカーコンテナとして同じタスク内で実行されます
- WebSocket 接続のため、ALB のスティッキーセッションを有効にすることを推奨
- 本番環境では ElastiCache for Redis の使用を推奨
