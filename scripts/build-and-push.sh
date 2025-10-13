#!/bin/bash
set -e

# 環境変数の設定
export AWS_REGION=${AWS_REGION:-ap-northeast-1}
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ENVIRONMENT=${ENVIRONMENT:-dev}
export ECR_REPOSITORY=${ECR_REPOSITORY:-firepoker-${ENVIRONMENT}}
export IMAGE_TAG=${IMAGE_TAG:-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)}

echo "Building Docker image..."
docker build --platform=linux/arm64 -t $ECR_REPOSITORY:$IMAGE_TAG .

echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "Creating ECR repository if it doesn't exist..."
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION || \
  aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION

echo "Tagging image..."
docker tag $ECR_REPOSITORY:$IMAGE_TAG $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "Pushing image to ECR..."
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG

echo "Image pushed successfully: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"
echo "Environment: $ENVIRONMENT"
echo "To deploy this image, run:"
echo "  ENVIRONMENT=$ENVIRONMENT IMAGE_TAG=$IMAGE_TAG ./scripts/deploy-ecs.sh"
