resource "google_artifact_registry_repository" "repo" {
  depends_on    = [google_project_service.apis["artifactregistry.googleapis.com"]]
  project       = var.project_id
  location      = var.region
  repository_id = "${var.app_name}-repo"
  description   = "Docker container repository for ${var.app_name} web application"
  format        = "DOCKER"

  labels = {
    managed-by = "terraform"
    app        = var.app_name
  }
}
