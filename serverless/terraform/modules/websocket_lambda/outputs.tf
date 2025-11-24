output "ws_endpoint" {
  description = "WebSocket endpoint for clients"
  value       = aws_apigatewayv2_api.websocket.api_endpoint
}

output "ws_callback_endpoint" {
  description = "REST callback endpoint for API Gateway Management API"
  value       = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.region}.amazonaws.com/${aws_apigatewayv2_stage.default.name}"
}
