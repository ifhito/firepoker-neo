# Production Environment Configuration
aws_region  = "ap-northeast-1"
environment = "prod"
project_name = "firepoker"

# VPC Configuration
vpc_cidr           = "10.1.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# ECS Configuration (Production-sized)
ecs_task_cpu    = 1024 # 1 vCPU
ecs_task_memory = 2048 # 2 GB

ecs_app_cpu    = 768  # 0.75 vCPU
ecs_app_memory = 1536 # 1.5 GB

ecs_redis_cpu    = 256 # 0.25 vCPU
ecs_redis_memory = 512 # 512 MB

ecs_desired_count = 2
ecs_min_capacity  = 2
ecs_max_capacity  = 10

# Notion Configuration
# Set these via environment variables or -var flags:
# notion_token       = "your-notion-token-here"
# notion_pbi_db_id   = "your-pbi-db-id-here"

# Domain Configuration (set if you have a domain)
domain_name     = "" # e.g., "firepoker.example.com"
certificate_arn = "" # e.g., "arn:aws:acm:ap-northeast-1:ACCOUNT_ID:certificate/xxx"

# Container Image (will use ECR repository URL by default)
container_image = "latest"
