variable "function_name" {
  type        = string
  description = "Name of the Lambda function"
}

variable "lambda_handler" {
  type        = string
  description = "Entry point handler"
  default     = "index.handler"
}

variable "lambda_runtime" {
  type        = string
  description = "Lambda runtime"
  default     = "nodejs18.x"
}

variable "lambda_timeout" {
  type        = number
  description = "Lambda timeout in seconds"
  default     = 15
}

variable "lambda_memory_size" {
  type        = number
  description = "Lambda memory size"
  default     = 256
}

variable "lambda_package" {
  type        = string
  description = "Path to the packaged Lambda zip file"
}

variable "environment" {
  type        = map(string)
  description = "Environment variables for the Lambda function"
  default     = {}
}

variable "stage_name" {
  type        = string
  description = "API Gateway stage name"
  default     = "prod"
}

variable "max_connections" {
  type        = number
  description = "Maximum concurrent connections enforced via throttling"
  default     = 10
}

variable "region" {
  type        = string
  description = "AWS region used for API Gateway invoke URLs"
}

variable "policy_statements" {
  type        = list(any)
  description = "Additional IAM policy statements to include in the Lambda role"
  default     = []
}

variable "enable_execution_logging" {
  type        = bool
  description = "Enable API Gateway execution logging"
  default     = false
}
