# APIs
data "google_client_config" "default" {}

resource "google_project_service" "apis" {
  for_each = toset([
    "firestore.googleapis.com",
    "bigquery.googleapis.com",
    "storage.googleapis.com",
    "storage-component.googleapis.com",
    "secretmanager.googleapis.com",
    "run.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com",
    "cloudbuild.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "bigquerydatatransfer.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "serviceusage.googleapis.com",
  ])
  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# Service Accounts
resource "google_service_account" "backend" {
  account_id   = "sentry-backend"
  display_name = "Sentry Backend API"
  description  = "Main backend API service"
}

resource "google_service_account" "chat" {
  account_id   = "sentry-chat"
  display_name = "Sentry Chat AI"
  description  = "AI chat service"
}

resource "google_service_account" "harness" {
  account_id   = "sentry-harness"
  display_name = "Sentry Harness"
  description  = "BigQuery discovery and spec generation"
}

resource "google_service_account" "jobs" {
  account_id   = "sentry-jobs"
  display_name = "Sentry Sync Worker"
  description  = "Multi-tenant data sync worker"
}

resource "google_service_account" "compute" {
  account_id   = "sentry-compute"
  display_name = "Sentry Compute"
  description  = "Default compute for Cloud Run"
}

# IAM Roles
locals {
  backend_roles = [
    "roles/datastore.user",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/storage.objectAdmin",
    "roles/secretmanager.admin",
    "roles/run.admin",
    "roles/cloudscheduler.admin",
    "roles/pubsub.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ]
  chat_roles = [
    "roles/datastore.user",
    "roles/storage.objectAdmin",
    "roles/logging.logWriter",
  ]
  harness_roles = [
    "roles/bigquery.dataViewer",
    "roles/bigquery.jobUser",
    "roles/storage.objectAdmin",
    "roles/datastore.user",
    "roles/logging.logWriter",
  ]
  jobs_roles = [
    "roles/secretmanager.secretAccessor",
    "roles/bigquery.dataEditor",
    "roles/bigquery.jobUser",
    "roles/datastore.user",
    "roles/pubsub.publisher",
    "roles/logging.logWriter",
  ]
  compute_roles = [
    "roles/run.invoker",
    "roles/cloudscheduler.jobRunner",
  ]
}

resource "google_project_iam_member" "backend" {
  for_each = toset(local.backend_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_project_iam_member" "chat" {
  for_each = toset(local.chat_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.chat.email}"
}

resource "google_project_iam_member" "harness" {
  for_each = toset(local.harness_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.harness.email}"
}

resource "google_project_iam_member" "jobs" {
  for_each = toset(local.jobs_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.jobs.email}"
}

resource "google_project_iam_member" "compute" {
  for_each = toset(local.compute_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.compute.email}"
}

# Firestore Database
resource "google_firestore_database" "main" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  app_engine_integration_mode = "DISABLED"

  depends_on = [google_project_service.apis["firestore.googleapis.com"]]
}

# GCS Bucket
resource "google_storage_bucket" "main" {
  name          = "sentry-platform-data-${var.project_id}"
  location      = "EU"
  force_destroy = true
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  depends_on = [google_project_service.apis["storage.googleapis.com"]]
}

# BigQuery Dataset
resource "google_bigquery_dataset" "main" {
  dataset_id  = "sentry_dataset_${var.environment}"
  description   = "Sentry Data Platform main dataset"
  location      = "EU"
  project       = var.project_id

  depends_on = [google_project_service.apis["bigquery.googleapis.com"]]
}

# Pub/Sub Topics
resource "google_pubsub_topic" "sync_trigger" {
  name    = "sentry-sync-trigger"
  project = var.project_id

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

resource "google_pubsub_topic" "sync_complete" {
  name    = "connector-sync-complete"
  project = var.project_id

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

# Secrets
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "internal_token" {
  secret_id = "internal-token"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "internal_token" {
  secret      = google_secret_manager_secret.internal_token.id
  secret_data = var.internal_token
}

resource "google_secret_manager_secret" "llm_api_key" {
  secret_id = "llm-api-key"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "llm_api_key" {
  secret      = google_secret_manager_secret.llm_api_key.id
  secret_data = var.llm_api_key
}

# Cloud Run - Backend
resource "google_cloud_run_v2_service" "backend" {
  name     = "sentry-backend"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.backend.email

    scaling {
      min_instances = var.backend_min_instances
      max_instances = var.backend_max_instances
    }

    containers {
      image = "gcr.io/${var.project_id}/sentry-backend:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "GCP_REGION"
        value = var.region
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.main.name
      }
      env {
        name  = "BIGQUERY_DATASET_PREFIX"
        value = "sentry_dataset"
      }
      env {
        name  = "BIGQUERY_LOCATION"
        value = "EU"
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "INTERNAL_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.internal_token.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "CHAT_SERVICE_URL"
        value = google_cloud_run_v2_service.chat.uri
      }
      env {
        name  = "HARNESS_SERVICE_URL"
        value = google_cloud_run_v2_service.harness.uri
      }
      env {
        name  = "ENABLE_BIGQUERY_ANALYTICS"
        value = var.enable_bigquery_analytics ? "true" : "false"
      }
      env {
        name  = "CORS_ORIGIN"
        value = "https://app.${var.domain}"
      }
    }
  }

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Cloud Run - Chat
resource "google_cloud_run_v2_service" "chat" {
  name     = "sentry-chat"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.chat.email

    scaling {
      min_instances = 0
      max_instances = 5
    }

    containers {
      image = "gcr.io/${var.project_id}/sentry-chat:latest"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "LLM_PROVIDER"
        value = "gemini"
      }
      env {
        name = "LLM_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.llm_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "LLM_MODEL"
        value = "gemini-2.5-flash"
      }
      env {
        name = "INTERNAL_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.internal_token.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Cloud Run - Harness
resource "google_cloud_run_v2_service" "harness" {
  name     = "sentry-harness"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.harness.email

    scaling {
      min_instances = 0
      max_instances = 3
    }

    containers {
      image = "gcr.io/${var.project_id}/sentry-harness:latest"

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }

      env {
        name  = "PORT"
        value = "8081"
      }
      env {
        name  = "LLM_PROVIDER"
        value = "gemini"
      }
      env {
        name = "LLM_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.llm_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "LLM_MODEL"
        value = "gemini-2.5-flash"
      }
      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.main.name
      }
      env {
        name = "INTERNAL_TOKEN"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.internal_token.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Cloud Run - Allow unauthenticated for backend
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Scheduler - Sync Worker
resource "google_cloud_scheduler_job" "sync_worker" {
  name             = "sentry-sync-worker-trigger"
  description      = "Trigger sync worker every 5 minutes"
  schedule         = "*/5 * * * *"
  time_zone        = "UTC"
  project          = var.project_id
  region           = var.region
  attempt_deadline = "320s"

  http_target {
    http_method = "POST"
    uri         = "${google_cloud_run_v2_service.backend.uri}/api/v1/admin/jobs/trigger-sync"

    headers = {
      "Authorization" = "Bearer ${var.internal_token}"
    }

    oauth_token {
      service_account_email = google_service_account.compute.email
    }
  }

  depends_on = [google_project_service.apis["cloudscheduler.googleapis.com"]]
}

# Cloudflare DNS Records
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  type    = "CNAME"
  value   = replace(google_cloud_run_v2_service.backend.uri, "https://", "")
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "app" {
  zone_id = var.cloudflare_zone_id
  name    = "app"
  type    = "CNAME"
  value   = "sentry-frontend.pages.dev"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  value   = "sentry-frontend.pages.dev"
  proxied = true
  ttl     = 1
}

# Cloudflare Page Rule - HTTPS Redirect
resource "cloudflare_page_rule" "https_redirect" {
  zone_id = var.cloudflare_zone_id
  target  = "*${var.domain}/*"
  priority = 1

  actions {
    ssl = "strict"
    always_use_https = true
  }
}
