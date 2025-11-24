variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket used for static assets"
}

variable "domain_aliases" {
  type        = list(string)
  description = "Optional aliases for CloudFront"
  default     = []
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for HTTPS"
  default     = ""
}

variable "log_bucket_name" {
  type        = string
  description = "Optional logging bucket"
  default     = ""
}

variable "price_class" {
  type        = string
  description = "CloudFront price class"
  default     = "PriceClass_100"
}
