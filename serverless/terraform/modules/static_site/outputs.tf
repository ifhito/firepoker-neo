output "static_site_domain" {
  value       = aws_cloudfront_distribution.site.domain_name
  description = "CloudFront distribution domain name"
}

output "bucket_name" {
  value       = aws_s3_bucket.site.id
  description = "S3 bucket that stores the CSR build"
}
