output "cloud_run_url" {
  description = "Public URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.app.uri
}

output "artifact_registry_repo" {
  description = "Docker repository path in Artifact Registry"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

output "container_image_tag" {
  description = "Full Docker image tag target"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.app_name}:latest"
}

output "docker_build_command" {
  description = "Run this command from the repository root to build and push the container using Cloud Build"
  value       = "gcloud builds submit --project=${var.project_id} --tag=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.app_name}:latest ."
}

output "verification_health_url" {
  description = "Health check endpoint for post-deployment verification"
  value       = "${google_cloud_run_v2_service.app.uri}/api/health"
}

output "firebase_web_app_config" {
  description = "Firebase Web App credentials (maps to firebase-applet-config.json)"
  value = {
    projectId           = var.project_id
    appId               = google_firebase_web_app.web_app.app_id
    apiKey              = data.google_firebase_web_app_config.web_app_config.api_key
    authDomain          = data.google_firebase_web_app_config.web_app_config.auth_domain
    firestoreDatabaseId = var.firestore_database_id
    storageBucket       = data.google_firebase_web_app_config.web_app_config.storage_bucket
  }
}
