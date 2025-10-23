# ============================================
# Data Sources
# ============================================

# Zscaler公開IPリストの取得
# https://config.zscaler.com/api/zscaler.net/cenr/json
data "http" "zscaler_ips" {
  url = "https://config.zscaler.com/api/zscaler.net/cenr/json"

  request_headers = {
    Accept = "application/json"
  }
}

locals {
  # ZscalerのJSONレスポンスからIPアドレスを抽出
  zscaler_raw = jsondecode(data.http.zscaler_ips.response_body)

  # zscaler.netキーの下にある全データを取得
  zscaler_data = try(local.zscaler_raw["zscaler.net"], {})

  # 都市フィルタが指定されているかチェック
  has_city_filter = length(var.zscaler_city_filter) > 0

  # すべてのZscaler IPアドレスのCIDR範囲を抽出（都市フィルタ適用、IPv4のみ）
  zscaler_ips = flatten([
    for continent_key, continent_data in local.zscaler_data : [
      for city_key, city_ranges in continent_data : [
        for range_obj in city_ranges : range_obj.range
        # 都市フィルタが指定されている場合は、都市名でフィルタリング
        if(!local.has_city_filter || anytrue([
          for filter in var.zscaler_city_filter : strcontains(city_key, filter)
        ])) && !strcontains(range_obj.range, ":") # IPv6アドレス（":"を含む）を除外
      ]
    ]
  ])

  # ユーザー指定のCIDRブロックとZscaler IPsを結合
  all_allowed_cidrs = concat(
    var.allowed_cidr_blocks,
    var.enable_zscaler_ips ? local.zscaler_ips : []
  )
}

# ============================================
# VPC and Network Configuration (Minimal)
# ============================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Public Subnets (ALB requires minimum 2 AZs)
resource "aws_subnet" "public" {
  count             = 2 # ALB minimum requirement
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${var.availability_zones[count.index]}"
    Type = "public"
  }
}

# Route Table for Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

# Route Table Association for Public Subnets
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ============================================
# Security Groups
# ============================================

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from allowed IPs"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = local.all_allowed_cidrs
  }

  ingress {
    description = "HTTPS from allowed IPs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = local.all_allowed_cidrs
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

# ECS Tasks Security Group (for public subnet deployment)
resource "aws_security_group" "ecs" {
  name        = "${var.project_name}-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Allow traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Allow all outbound traffic (for Notion API access)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-ecs-sg"
  }
}

# ============================================
# Application Load Balancer
# ============================================

resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false
  enable_http2               = true

  tags = {
    Name = "${var.project_name}-alb"
  }
}

# Target Group
resource "aws_lb_target_group" "main" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 15
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 10
    unhealthy_threshold = 5
  }

  deregistration_delay = 30

  tags = {
    Name = "${var.project_name}-tg"
  }
}

# HTTP Listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main.arn
  }
}

# HTTPS Listener (optional, requires ACM certificate)
# resource "aws_lb_listener" "https" {
#   count             = var.certificate_arn != "" ? 1 : 0
#   load_balancer_arn = aws_lb.main.arn
#   port              = "443"
#   protocol          = "HTTPS"
#   ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
#   certificate_arn   = var.certificate_arn
#
#   default_action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.main.arn
#   }
# }

# ============================================
# ECR Repository
# ============================================

resource "aws_ecr_repository" "main" {
  name                 = var.project_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project_name}-ecr"
  }
}

# ECR Lifecycle Policy
resource "aws_ecr_lifecycle_policy" "main" {
  repository = aws_ecr_repository.main.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ============================================
# S3 Logs Bucket
# ============================================

resource "aws_s3_bucket" "logs" {
  bucket_prefix = "${var.project_name}-${var.environment}-logs-"

  tags = {
    Name = "${var.project_name}-logs"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# ============================================
# Secrets Manager
# ============================================

resource "aws_secretsmanager_secret" "notion_token" {
  name                    = "${var.project_name}/notion-token"
  description             = "Notion API token for FirePoker"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-notion-token"
  }
}

resource "aws_secretsmanager_secret_version" "notion_token" {
  secret_id     = aws_secretsmanager_secret.notion_token.id
  secret_string = var.notion_token
}

resource "aws_secretsmanager_secret" "notion_pbi_db_id" {
  name                    = "${var.project_name}/notion-pbi-db-id"
  description             = "Notion PBI Database ID for FirePoker"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-notion-pbi-db-id"
  }
}

resource "aws_secretsmanager_secret_version" "notion_pbi_db_id" {
  secret_id     = aws_secretsmanager_secret.notion_pbi_db_id.id
  secret_string = var.notion_pbi_db_id
}

# ============================================
# IAM Roles and Policies
# ============================================

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project_name}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-execution-role"
  }
}

# Attach AWS managed policy for ECS task execution
resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy for Secrets Manager access
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "${var.project_name}-ecs-secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.notion_token.arn,
          aws_secretsmanager_secret.notion_pbi_db_id.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_logs_to_s3" {
  name = "${var.project_name}-ecs-logs-to-s3"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.logs.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          "${aws_s3_bucket.logs.arn}/*"
        ]
      }
    ]
  })
}

# ECS Task Role (for application to access AWS services)
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ecs-task-role"
  }
}

# ============================================
# ECS Cluster
# ============================================

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  tags = {
    Name = "${var.project_name}-cluster"
  }
}

# ============================================
# ECS Task Definition
# ============================================

resource "aws_ecs_task_definition" "main" {
  family                   = "${var.project_name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_task_cpu
  memory                   = var.ecs_task_memory
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([
    {
      name      = "log_router"
      image     = "public.ecr.aws/aws-observability/aws-for-fluent-bit:latest"
      essential = true

      firelensConfiguration = {
        type = "fluentbit"
        options = {
          "enable-ecs-log-metadata" = "true"
        }
      }

      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          "Name"            = "s3"
          "region"          = var.aws_region
          "bucket"          = aws_s3_bucket.logs.bucket
          "total_file_size" = "5m"
          "upload_timeout"  = "60s"
          "use_put_object"  = "true"
          "store_dir"       = "/var/log/firelens"
          "s3_key_format"   = "/${var.project_name}/${var.environment}/firelens/%Y/%m/%d/%H/%M/%S"
        }
      }
    },
    {
      name      = "app"
      image     = var.container_image != "latest" ? var.container_image : "${aws_ecr_repository.main.repository_url}:latest"
      cpu       = var.ecs_app_cpu
      memory    = var.ecs_app_memory
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "REDIS_HOST"
          value = "localhost"
        },
        {
          name  = "REDIS_PORT"
          value = "6379"
        }
      ]

      secrets = [
        {
          name      = "NOTION_TOKEN"
          valueFrom = aws_secretsmanager_secret.notion_token.arn
        },
        {
          name      = "NOTION_PBI_DB_ID"
          valueFrom = aws_secretsmanager_secret.notion_pbi_db_id.arn
        }
      ]

      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          "Name"            = "s3"
          "region"          = var.aws_region
          "bucket"          = aws_s3_bucket.logs.bucket
          "total_file_size" = "5m"
          "upload_timeout"  = "60s"
          "use_put_object"  = "true"
          "store_dir"       = "/var/log/firelens"
          "s3_key_format"   = "/${var.project_name}/${var.environment}/app/%Y/%m/%d/%H/%M/%S"
        }
      }
    },
    {
      name      = "redis"
      image     = "redis:7-alpine"
      cpu       = var.ecs_redis_cpu
      memory    = var.ecs_redis_memory
      essential = true

      command = [
        "redis-server",
        "--save",
        "",
        "--appendonly",
        "no"
      ]

      portMappings = [
        {
          containerPort = 6379
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          "Name"            = "s3"
          "region"          = var.aws_region
          "bucket"          = aws_s3_bucket.logs.bucket
          "total_file_size" = "5m"
          "upload_timeout"  = "60s"
          "use_put_object"  = "true"
          "store_dir"       = "/var/log/firelens"
          "s3_key_format"   = "/${var.project_name}/${var.environment}/redis/%Y/%m/%d/%H/%M/%S"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "redis-cli ping || exit 1"]
        interval    = 30
        timeout     = 10
        retries     = 5
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project_name}-task"
  }
}

# ============================================
# ECS Service
# ============================================

resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true # Required for public subnet without NAT Gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.main.arn
    container_name   = "app"
    container_port   = 3000
  }

  enable_execute_command = true

  tags = {
    Name = "${var.project_name}-service"
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.ecs_task_execution
  ]
}

# ============================================
# Auto Scaling (Optional for internal tools)
# ============================================

# Uncomment if you need auto scaling for peak usage
# resource "aws_appautoscaling_target" "ecs" {
#   max_capacity       = var.ecs_max_capacity
#   min_capacity       = var.ecs_min_capacity
#   resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
#   scalable_dimension = "ecs:service:DesiredCount"
#   service_namespace  = "ecs"
# }
#
# # CPU-based auto scaling
# resource "aws_appautoscaling_policy" "ecs_cpu" {
#   name               = "${var.project_name}-cpu-autoscaling"
#   policy_type        = "TargetTrackingScaling"
#   resource_id        = aws_appautoscaling_target.ecs.resource_id
#   scalable_dimension = aws_appautoscaling_target.ecs.scalable_dimension
#   service_namespace  = aws_appautoscaling_target.ecs.service_namespace
#
#   target_tracking_scaling_policy_configuration {
#     predefined_metric_specification {
#       predefined_metric_type = "ECSServiceAverageCPUUtilization"
#     }
#     target_value       = 70.0
#     scale_in_cooldown  = 300
#     scale_out_cooldown = 60
#   }
# }
