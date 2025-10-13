#!/bin/bash
set -e

# 環境変数の設定
export AWS_REGION=${AWS_REGION:-ap-northeast-1}
export ENVIRONMENT=${ENVIRONMENT:-dev}
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPOSITORY=${ECR_REPOSITORY:-firepoker-${ENVIRONMENT}}
export IMAGE_TAG=${IMAGE_TAG:?IMAGE_TAG is required}
export CLUSTER_NAME=${CLUSTER_NAME:-firepoker-${ENVIRONMENT}-cluster}
export SERVICE_NAME=${SERVICE_NAME:-firepoker-${ENVIRONMENT}-service}
export TASK_DEFINITION=${TASK_DEFINITION:-firepoker-${ENVIRONMENT}-task}

echo "Environment: $ENVIRONMENT"
echo "Image: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo ""

# タスク定義の存在確認
echo "Checking if task definition exists..."
if ! aws ecs describe-task-definition --task-definition $TASK_DEFINITION --region $AWS_REGION &> /dev/null; then
  echo "Error: Task definition '$TASK_DEFINITION' not found."
  echo "Please create the task definition first using Terraform or AWS Console."
  exit 1
fi

# クラスターの存在確認
echo "Checking if cluster exists..."
if ! aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION --query 'clusters[0].status' --output text | grep -q "ACTIVE"; then
  echo "Error: Cluster '$CLUSTER_NAME' not found or not active."
  echo "Please create the cluster first using Terraform or run: terraform apply -var-file=${ENVIRONMENT}.tfvars"
  exit 1
fi

# サービスの存在確認
echo "Checking if service exists..."
if ! aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION --query 'services[0].status' --output text | grep -q "ACTIVE"; then
  echo "Error: Service '$SERVICE_NAME' not found or not active in cluster '$CLUSTER_NAME'."
  echo "Please create the service first using Terraform or run: terraform apply -var-file=${ENVIRONMENT}.tfvars"
  exit 1
fi

# 新しいタスク定義を登録（イメージを更新）
echo "Registering new task definition with updated image..."

# 既存のタスク定義を取得して一時ファイルに保存
TEMP_TASK_DEF=$(mktemp)
aws ecs describe-task-definition --task-definition $TASK_DEFINITION --region $AWS_REGION --query 'taskDefinition' --output json > $TEMP_TASK_DEF

# 新しいイメージで置き換えて新しい一時ファイルに保存
NEW_TASK_DEF=$(mktemp)
jq --arg IMAGE "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG" \
  '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
  $TEMP_TASK_DEF > $NEW_TASK_DEF

# 新しいタスク定義を登録
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://$NEW_TASK_DEF --region $AWS_REGION --query 'taskDefinition.taskDefinitionArn' --output text)

# 一時ファイルをクリーンアップ
rm -f $TEMP_TASK_DEF $NEW_TASK_DEF

echo "New task definition registered: $NEW_TASK_DEF_ARN"

echo "Updating ECS service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --task-definition $NEW_TASK_DEF_ARN \
  --force-new-deployment \
  --region $AWS_REGION \
  --query 'service.taskDefinition' \
  --output text

echo "Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION

echo "Deployment complete!"
