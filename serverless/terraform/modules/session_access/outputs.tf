output "session_access_table_name" {
  value       = aws_dynamodb_table.session_access.name
  description = "Name of the DynamoDB table storing session access metadata"
}

output "notion_secret_arn" {
  value       = aws_secretsmanager_secret.notion.arn
  description = "ARN of the Notion configuration secret"
}
