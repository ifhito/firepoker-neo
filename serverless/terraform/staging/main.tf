terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "apigw_logs" {
  name = "${var.stack_name}-apigw-logs-${var.stage_name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "apigateway.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "apigw_logs" {
  name = "${var.stack_name}-apigw-logs-${var.stage_name}"
  role = aws_iam_role.apigw_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apigw_logs_managed" {
  role       = aws_iam_role.apigw_logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_api_gateway_account" "logging" {
  cloudwatch_role_arn = aws_iam_role.apigw_logs.arn
}

locals {
  session_access_table_name = "${var.stack_name}-session-access-${var.stage_name}"
  session_access_table_arn  = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${local.session_access_table_name}"
  session_metadata_table_name = "${var.stack_name}-session-metadata-${var.stage_name}"
}

module "session_access" {
  source               = "../modules/session_access"
  secret_name          = var.notion_secret_name
  secret_description   = var.notion_secret_description
  secret_string_json   = var.notion_secret_json
  dynamodb_table_name  = local.session_access_table_name
  billing_mode         = "PAY_PER_REQUEST"
  enable_ttl           = true
}

resource "aws_dynamodb_table" "session_metadata" {
  name         = local.session_metadata_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

module "websocket_lambda" {
  source            = "../modules/websocket_lambda"
  function_name     = "${var.stack_name}-websocket-${var.stage_name}"
  lambda_package    = var.lambda_package_path
  stage_name        = var.stage_name
  region            = var.aws_region
  lambda_handler    = "websocketHandler.handler"
  enable_execution_logging = true
  environment = merge({
    NODE_ENV                  = "production",
    SESSION_ACCESS_TABLE_NAME = module.session_access.session_access_table_name,
    NOTION_SECRET_ARN         = module.session_access.notion_secret_arn,
  }, var.lambda_environment_overrides)

  policy_statements = [
    {
      actions   = ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem"]
      resources = [local.session_access_table_arn]
    },
    {
      actions   = ["secretsmanager:GetSecretValue"]
      resources = [module.session_access.notion_secret_arn]
    }
  ]
}

module "static_site" {
  source             = "../modules/static_site"
  bucket_name        = var.static_site_bucket_name
  domain_aliases     = var.cloudfront_domain_aliases
  certificate_arn    = var.certificate_arn
  log_bucket_name    = var.log_bucket_name
  price_class        = var.cloudfront_price_class
}

module "monitoring" {
  source                = "../modules/monitoring"
  alarm_prefix          = "${var.stack_name}-${var.stage_name}"
  stage_name            = var.stage_name
  connections_threshold = var.connections_threshold
  lambda_function_name  = module.websocket_lambda.lambda_function_name
  api_gateway_api_id    = module.websocket_lambda.api_id
  sns_topic_arn         = var.sns_topic_arn
}

module "session_creation_http" {
  source         = "../modules/session_creation_http"
  function_name  = "${var.stack_name}-session-http-${var.stage_name}"
  lambda_package = var.session_creation_lambda_package_path
  lambda_handler = "sessionCreationHandler.handler"
  region         = var.aws_region
  stage_name     = var.stage_name
  environment = {
    NODE_ENV                       = "production"
    SESSION_METADATA_TABLE_NAME    = aws_dynamodb_table.session_metadata.name
    SESSION_ACCESS_TABLE_NAME      = module.session_access.session_access_table_name
    SESSION_ACCESS_MAX_CONNECTIONS = var.session_creation_max_connections
    CORS_ALLOWED_ORIGIN            = var.session_creation_allowed_origin
  }

  policy_statements = [
    {
      actions   = ["dynamodb:PutItem"]
      resources = [aws_dynamodb_table.session_metadata.arn]
    },
    {
      actions   = ["dynamodb:PutItem", "dynamodb:UpdateItem"]
      resources = [local.session_access_table_arn]
    }
  ]
}
