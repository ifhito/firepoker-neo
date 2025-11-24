terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_secretsmanager_secret" "notion" {
  name        = var.secret_name
  description = var.secret_description
}

resource "aws_secretsmanager_secret_version" "notion" {
  secret_id     = aws_secretsmanager_secret.notion.id
  secret_string = var.secret_string_json
}

resource "aws_dynamodb_table" "session_access" {
  name          = var.dynamodb_table_name
  billing_mode  = var.billing_mode
  read_capacity  = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
  write_capacity = var.billing_mode == "PROVISIONED" ? var.write_capacity : null

  hash_key = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "joinTokenHash"
    type = "S"
  }

  global_secondary_index {
    name               = "by_join_token"
    hash_key           = "joinTokenHash"
    projection_type    = "KEYS_ONLY"
    read_capacity      = var.billing_mode == "PROVISIONED" ? var.read_capacity : null
    write_capacity     = var.billing_mode == "PROVISIONED" ? var.write_capacity : null
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = var.enable_ttl
  }
}
