terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lambda_logging" {
  name   = "${var.function_name}-logging"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_logging.json
}

data "aws_iam_policy_document" "lambda_logging" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["*"]
  }

  dynamic "statement" {
    for_each = var.policy_statements
    content {
      actions   = lookup(statement.value, "actions", [])
      resources = lookup(statement.value, "resources", [])
    }
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 30
}

resource "aws_lambda_function" "handler" {
  function_name = var.function_name
  filename      = var.lambda_package
  handler       = var.lambda_handler
  runtime       = var.lambda_runtime
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size
  role          = aws_iam_role.lambda.arn
  source_code_hash = filebase64sha256(var.lambda_package)

  environment {
    variables = var.environment
  }
}

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.function_name}-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.handler.invoke_arn
  integration_method = "POST"
}

locals {
  routes = ["$default", "$connect", "$disconnect"]
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = toset(local.routes)

  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.stage_name
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit   = var.max_connections
    throttling_rate_limit    = var.max_connections
    logging_level            = var.enable_execution_logging ? "INFO" : null
    data_trace_enabled       = var.enable_execution_logging
    detailed_metrics_enabled = var.enable_execution_logging
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

output "api_id" {
  value       = aws_apigatewayv2_api.websocket.id
  description = "ID of the WebSocket API"
}

output "lambda_function_name" {
  value       = aws_lambda_function.handler.function_name
  description = "Deployed Lambda function name"
}
