output "dynamo_table_name" {
  value = aws_dynamodb_table.app.name
}

output "r2_bucket_data" {
  value = cloudflare_r2_bucket.data.name
}

output "backend_env" {
  value = {
    AWS_REGION        = var.aws_region
    DYNAMO_TABLE_NAME = aws_dynamodb_table.app.name
    R2_BUCKET_DATA    = cloudflare_r2_bucket.data.name
    R2_REGION         = "auto"
  }
}
