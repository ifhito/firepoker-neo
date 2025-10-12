#!/bin/bash
set -e

# 環境変数の設定
export AWS_REGION=${AWS_REGION:-ap-northeast-1}
export CLUSTER_NAME=${CLUSTER_NAME:-firepoker-cluster}
export SERVICE_NAME=${SERVICE_NAME:-firepoker-service}
export TASK_DEFINITION=${TASK_DEFINITION:-firepoker-task}

echo "Updating ECS service..."
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service $SERVICE_NAME \
  --force-new-deployment \
  --region $AWS_REGION

echo "Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster $CLUSTER_NAME \
  --services $SERVICE_NAME \
  --region $AWS_REGION

echo "Deployment complete!"
