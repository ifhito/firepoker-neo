# Development Environment Configuration
aws_region  = "ap-northeast-1"
environment = "dev"
project_name = "firepoker-dev"

# VPC Configuration
vpc_cidr           = "10.0.0.0/16"
availability_zones = ["ap-northeast-1a", "ap-northeast-1c"]

# ECS Configuration (Smaller for development)
ecs_task_cpu    = 512  # 0.5 vCPU
ecs_task_memory = 1024 # 1 GB

ecs_app_cpu    = 384  # 0.375 vCPU
ecs_app_memory = 768  # 768 MB

ecs_redis_cpu    = 128 # 0.125 vCPU
ecs_redis_memory = 256 # 256 MB

ecs_desired_count = 1
ecs_min_capacity  = 1
ecs_max_capacity  = 2

# Notion Configuration
# Set these via environment variables or -var flags:
# notion_token       = "your-notion-token-here"
# notion_pbi_db_id   = "your-pbi-db-id-here"

# Domain Configuration (optional for dev)
domain_name     = ""
certificate_arn = ""

# Container Image (will use ECR repository URL by default)
container_image = "latest"
