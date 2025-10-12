# Production Environment Configuration (Minimal for internal tool)
aws_region  = "ap-northeast-1"
environment = "prod"
project_name = "firepoker"

# VPC Configuration
vpc_cidr           = "10.1.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# ECS Configuration (Balanced for internal production use)
ecs_task_cpu    = 512  # 0.5 vCPU
ecs_task_memory = 1024 # 1 GB

ecs_app_cpu    = 384  # 0.375 vCPU
ecs_app_memory = 768  # 768 MB

ecs_redis_cpu    = 128 # 0.125 vCPU
ecs_redis_memory = 256 # 256 MB

ecs_desired_count = 1  # Single task sufficient for internal use
ecs_min_capacity  = 1
ecs_max_capacity  = 1  # No auto scaling needed

# Notion Configuration
# Set these via environment variables or -var flags:
# notion_token       = "your-notion-token-here"
# notion_pbi_db_id   = "your-pbi-db-id-here"

# Domain Configuration (set if you have a domain)
domain_name     = "" # e.g., "firepoker.example.com"
certificate_arn = "" # e.g., "arn:aws:acm:ap-northeast-1:ACCOUNT_ID:certificate/xxx"

# Container Image (will use ECR repository URL by default)
container_image = "latest"
