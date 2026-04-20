variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for DynamoDB."
  type        = string
  default     = "eu-central-1"
}

variable "dynamo_table_name" {
  description = "Single-table DynamoDB table used by sentry-backend."
  type        = string
  default     = "SentryAppTable"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with R2 bucket permissions."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account id that owns R2."
  type        = string
}

variable "r2_bucket_data" {
  description = "R2 bucket for source data, projections, runtime artifacts, query cache, feedback, and widget catalog."
  type        = string
  default     = "statsparrot-data"
}

variable "tags" {
  description = "Common tags."
  type        = map(string)
  default     = {}
}
