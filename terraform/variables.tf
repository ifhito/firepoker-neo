variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "firepoker"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones (ALB requires minimum 2)"
  type        = list(string)
  default     = ["ap-northeast-1a", "ap-northeast-1c"]
}

# ECS Configuration
variable "ecs_task_cpu" {
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "ecs_task_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 1024
}

variable "ecs_app_cpu" {
  description = "CPU units for app container"
  type        = number
  default     = 384
}

variable "ecs_app_memory" {
  description = "Memory for app container in MB"
  type        = number
  default     = 768
}

variable "ecs_redis_cpu" {
  description = "CPU units for Redis container"
  type        = number
  default     = 128
}

variable "ecs_redis_memory" {
  description = "Memory for Redis container in MB"
  type        = number
  default     = 256
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_min_capacity" {
  description = "Minimum number of tasks for auto scaling (not used if auto scaling disabled)"
  type        = number
  default     = 1
}

variable "ecs_max_capacity" {
  description = "Maximum number of tasks for auto scaling (not used if auto scaling disabled)"
  type        = number
  default     = 2
}

# Notion Configuration
variable "notion_token" {
  description = "Notion API token (sensitive)"
  type        = string
  sensitive   = true
}

variable "notion_pbi_db_id" {
  description = "Notion PBI Database ID (sensitive)"
  type        = string
  sensitive   = true
}

# Domain Configuration (optional)
variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (optional)"
  type        = string
  default     = ""
}

# Container Image
variable "container_image" {
  description = "Docker image for the application"
  type        = string
  default     = "latest" # Will be replaced with ECR repository URL
}

# IP Whitelist Configuration
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Allow all by default, override in tfvars
}
