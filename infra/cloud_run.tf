locals {
  default_image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.app_name}:latest"
  image_to_deploy = var.container_image != "" ? var.container_image : local.default_image
}

resource "google_cloud_run_v2_service" "app" {
  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.gemini_api_key_version,
    google_secret_manager_secret_version.turnstile_secret_key_version,
    google_secret_manager_secret_iam_member.gemini_secret_access,
    google_secret_manager_secret_iam_member.turnstile_secret_access,
  ]

  project  = var.project_id
  location = var.region
  name     = var.app_name
  ingress  = "INGRESS_TRAFFIC_ALL"

  labels = {
    managed-by = "terraform"
    app        = var.app_name
  }

  template {
    service_account = google_service_account.cloud_run_sa.email

    scaling {
      min_instance_count = 0 # Scale-to-zero keeps idle costs at $0 (Free Tier)
      max_instance_count = 2 # Anti-overrun cap preventing unexpected scaling costs
    }

    max_instance_request_concurrency = 10

    containers {
      image = local.image_to_deploy

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      # Standard environment variables
      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "AI_PROVIDER"
        value = var.ai_provider
      }

      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }

      env {
        name  = "ADMIN_EMAILS"
        value = var.admin_emails
      }

      env {
        name  = "VITE_TURNSTILE_SITE_KEY"
        value = var.turnstile_site_key
      }

      env {
        name  = "BOT_PROTECTION_REQUIRED"
        value = var.turnstile_secret_key != "" ? "true" : "false"
      }

      # Secrets mounted securely from Secret Manager
      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "TURNSTILE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.turnstile_secret_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

# Allow public unauthenticated access to the web application
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
