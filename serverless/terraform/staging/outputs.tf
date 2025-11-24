output "ws_endpoint" {
  description = "Deployed WebSocket endpoint"
  value       = module.websocket_lambda.ws_endpoint
}

output "ws_callback_endpoint" {
  description = "Callback endpoint for API Gateway Management API"
  value       = module.websocket_lambda.ws_callback_endpoint
}

output "static_site_domain" {
  description = "CloudFront domain serving the CSR app"
  value       = module.static_site.static_site_domain
}

output "session_access_table_name" {
  description = "DynamoDB table storing session access metadata"
  value       = module.session_access.session_access_table_name
}

output "alarm_names" {
  description = "List of CloudWatch alarms provisioned for staging"
  value       = module.monitoring.alarm_names
}

output "rest_endpoint" {
  description = "HTTP endpoint for session creation"
  value       = module.session_creation_http.rest_endpoint
}
