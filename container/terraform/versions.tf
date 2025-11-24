terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.0"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure after creating S3 bucket
  # backend "s3" {
  #   bucket         = "firepoker-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-northeast-1"
  #   encrypt        = true
  #   dynamodb_table = "firepoker-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FirePoker"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
