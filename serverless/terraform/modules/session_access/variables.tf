variable "secret_name" {
  type        = string
  description = "Name of the Notion integration secret"
}

variable "secret_description" {
  type        = string
  description = "Description for the secret"
  default     = "Serverless Notion configuration"
}

variable "secret_string_json" {
  type        = string
  description = "JSON string stored as the secret value"
  default     = "{}"
}

variable "dynamodb_table_name" {
  type        = string
  description = "Session access DynamoDB table name"
}

variable "billing_mode" {
  type        = string
  description = "DynamoDB billing mode"
  default     = "PAY_PER_REQUEST"
}

variable "read_capacity" {
  type        = number
  description = "Provisioned read capacity (when using PROVISIONED mode)"
  default     = 5
}

variable "write_capacity" {
  type        = number
  description = "Provisioned write capacity (when using PROVISIONED mode)"
  default     = 5
}

variable "enable_ttl" {
  type        = bool
  description = "Enable TTL on the Dynamo table"
  default     = true
}
