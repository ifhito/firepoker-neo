variable "aws_region" {
  type        = string
  description = "AWS region for the staging deployment"
}

variable "stage_name" {
  type        = string
  description = "Stage identifier (e.g. staging)"
  default     = "staging"
}

variable "stack_name" {
  type        = string
  description = "Base stack name used for resource prefixes"
}

variable "lambda_package_path" {
  type        = string
  description = "Path to the zipped Lambda artifact"
}

variable "lambda_environment_overrides" {
  type        = map(string)
  description = "Optional extra environment variables for the Lambda function"
  default     = {}
}

variable "session_creation_lambda_package_path" {
  type        = string
  description = "Path to the zipped HTTP Lambda artifact"
}

variable "session_creation_max_connections" {
  type        = number
  description = "Default max connections for session creation API"
  default     = 10
}

variable "session_creation_allowed_origin" {
  type        = string
  description = "Allowed CORS origin for the session creation API"
  default     = "*"
}

variable "notion_secret_name" {
  type        = string
  description = "Secrets Manager name that stores Notion credentials"
}

variable "notion_secret_description" {
  type        = string
  description = "Description for the Notion secret"
  default     = "Notion configuration for serverless stack"
}

variable "notion_secret_json" {
  type        = string
  description = "JSON string containing Notion token/db IDs"
}

variable "static_site_bucket_name" {
  type        = string
  description = "S3 bucket name for the exported CSR assets"
}

variable "cloudfront_domain_aliases" {
  type        = list(string)
  description = "Custom domain aliases for CloudFront"
  default     = []
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN used by CloudFront"
  default     = ""
}

variable "log_bucket_name" {
  type        = string
  description = "Optional S3 bucket name for CloudFront logs"
  default     = ""
}

variable "cloudfront_price_class" {
  type        = string
  description = "CloudFront price class"
  default     = "PriceClass_100"
}

variable "connections_threshold" {
  type        = number
  description = "Alarm threshold for active connections"
  default     = 10
}

variable "sns_topic_arn" {
  type        = string
  description = "SNS topic ARN for alarm notifications"
  default     = ""
}
