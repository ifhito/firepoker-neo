# Development Environment Configuration (Minimal)
aws_region  = "ap-northeast-1"
environment = "dev"
project_name = "firepoker-dev"

# VPC Configuration
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# ECS Configuration (Minimal for internal tool)
ecs_task_cpu    = 256  # 0.25 vCPU (minimum for Fargate)
ecs_task_memory = 512  # 512 MB (minimum for Fargate)

ecs_app_cpu    = 192  # 0.1875 vCPU
ecs_app_memory = 384  # 384 MB

ecs_redis_cpu    = 64  # 0.0625 vCPU
ecs_redis_memory = 128 # 128 MB

ecs_desired_count = 1  # Single task for cost savings
ecs_min_capacity  = 1
ecs_max_capacity  = 1  # No auto scaling needed

# Notion Configuration
# Set these via environment variables or -var flags:
# notion_token       = "your-notion-token-here"
# notion_pbi_db_id   = "your-pbi-db-id-here"

# Domain Configuration (optional for dev)
domain_name     = ""
certificate_arn = ""

# Container Image (will use ECR repository URL by default)
container_image = "latest"
