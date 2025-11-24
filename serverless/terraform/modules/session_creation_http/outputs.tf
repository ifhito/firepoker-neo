output "rest_endpoint" {
  description = "HTTP endpoint for session creation"
  value       = aws_apigatewayv2_api.http.api_endpoint
}

output "lambda_function_name" {
  value       = aws_lambda_function.handler.function_name
  description = "Session creation Lambda name"
}

output "api_id" {
  value       = aws_apigatewayv2_api.http.id
  description = "HTTP API ID"
}
