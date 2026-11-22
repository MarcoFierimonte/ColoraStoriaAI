locals {
  default_image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/${var.app_name}:latest"
  image_to_deploy = var.container_image != "" ? var.container_image : local.default_image
  effective_allowed_users = toset(
    length(var.allowed_users) > 0
      ? var.allowed_users
      : [for e in split(",", var.admin_emails) : trimspace(e) if trimspace(e) != ""]
  )
  use_iap = !var.allow_unauthenticated && var.enable_iap
}

resource "google_project_service_identity" "iap_sa" {
  count      = local.use_iap ? 1 : 0
  provider   = google-beta
  project    = var.project_id
  service    = "iap.googleapis.com"
  depends_on = [google_project_service.apis["iap.googleapis.com"]]
}

resource "google_cloud_run_v2_service" "app" {
  provider = google-beta

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_project_service.apis["iap.googleapis.com"],
    google_secret_manager_secret_version.gemini_api_key_version,
    google_secret_manager_secret_version.turnstile_secret_key_version,
    google_secret_manager_secret_version.beta_session_secret_version,
    google_secret_manager_secret_iam_member.gemini_secret_access,
    google_secret_manager_secret_iam_member.turnstile_secret_access,
    google_secret_manager_secret_iam_member.beta_session_secret_access,
  ]

  project     = var.project_id
  location    = var.region
  name        = var.app_name
  ingress     = "INGRESS_TRAFFIC_ALL"
  iap_enabled = local.use_iap

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

      env {
        name  = "BETA_INVITE_REQUIRED"
        value = var.beta_invite_required ? "true" : "false"
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

      env {
        name = "BETA_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.beta_session_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }
}

# Optional public access (disabled by default via allow_unauthenticated = false)
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  count    = var.allow_unauthenticated ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow Google IAP service agent to invoke the private Cloud Run service
resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  count      = local.use_iap ? 1 : 0
  depends_on = [google_project_service_identity.iap_sa]
  project    = var.project_id
  location   = var.region
  name       = google_cloud_run_v2_service.app.name
  role       = "roles/run.invoker"
  member     = "serviceAccount:${google_project_service_identity.iap_sa[0].email}"
}

# Allow authorized personal accounts to invoke via gcloud run services proxy / IAM token
resource "google_cloud_run_v2_service_iam_member" "private_invokers" {
  for_each = var.allow_unauthenticated ? toset([]) : local.effective_allowed_users
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "user:${each.value}"
}

# Allow ONLY authorized Google accounts through IAP browser sign-in
resource "google_iap_web_cloud_run_service_iam_member" "iap_accessors" {
  for_each               = local.use_iap ? local.effective_allowed_users : toset([])
  depends_on             = [google_project_service.apis["iap.googleapis.com"]]
  project                = var.project_id
  location               = var.region
  cloud_run_service_name = google_cloud_run_v2_service.app.name
  role                   = "roles/iap.httpsResourceAccessor"
  member                 = "user:${each.value}"
}
