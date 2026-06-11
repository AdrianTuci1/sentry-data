output "backend_url" {
  description = "URL of the deployed backend service"
  value       = google_cloud_run_service.sentry_backend.status[0].url
}

output "gcs_bucket_name" {
  description = "Name of the GCS bucket"
  value       = google_storage_bucket.sentry_data.name
}

output "backend_service_account" {
  description = "Email of the backend service account"
  value       = google_service_account.sentry_backend.email
}

output "agent_service_account" {
  description = "Email of the agent service account"
  value       = google_service_account.sentry_agents.email
}
