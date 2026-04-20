locals {
  common_tags = merge(
    {
      Project     = "sentry-data"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

resource "aws_dynamodb_table" "app" {
  name         = var.dynamo_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

resource "cloudflare_r2_bucket" "data" {
  account_id = var.cloudflare_account_id
  name       = var.r2_bucket_data
}
