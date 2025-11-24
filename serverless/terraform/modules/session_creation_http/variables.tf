variable "function_name" {
  type        = string
  description = "Name of the Lambda function"
}

variable "lambda_package" {
  type        = string
  description = "Path to the zipped Lambda artifact"
}

variable "lambda_handler" {
  type        = string
  description = "Entry point handler"
  default     = "sessionCreationHandler.handler"
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

variable "stage_name" {
  type        = string
  description = "API Gateway stage name"
  default     = "prod"
}

variable "region" {
  type        = string
  description = "AWS region used for invoke URLs"
}

variable "environment" {
  type        = map(string)
  description = "Environment variables for the Lambda"
  default     = {}
}

variable "policy_statements" {
  type        = list(any)
  description = "Additional IAM policy statements"
  default     = []
}
