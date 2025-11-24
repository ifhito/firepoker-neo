variable "alarm_prefix" {
  type        = string
  description = "Prefix applied to all monitoring alarm names"
}

variable "stage_name" {
  type        = string
  description = "Deployment stage name for metric dimensions"
}

variable "connections_threshold" {
  type        = number
  description = "Threshold for ConnectionsActive alarm"
  default     = 10
}

variable "lambda_function_name" {
  type        = string
  description = "Lambda function name monitored for throttles"
}

variable "api_gateway_api_id" {
  type        = string
  description = "API Gateway WebSocket API ID monitored for 5XX errors"
}

variable "sns_topic_arn" {
  type        = string
  description = "SNS topic ARN for alarm notifications"
  default     = ""
}
