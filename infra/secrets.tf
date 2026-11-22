resource "google_secret_manager_secret" "gemini_api_key" {
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
  project    = var.project_id
  secret_id  = "GEMINI_API_KEY"

  labels = {
    managed-by = "terraform"
    app        = var.app_name
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "gemini_api_key_version" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

resource "google_secret_manager_secret" "turnstile_secret_key" {
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
  project    = var.project_id
  secret_id  = "TURNSTILE_SECRET_KEY"

  labels = {
    managed-by = "terraform"
    app        = var.app_name
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "turnstile_secret_key_version" {
  secret      = google_secret_manager_secret.turnstile_secret_key.id
  secret_data = var.turnstile_secret_key != "" ? var.turnstile_secret_key : "none"
}

resource "google_secret_manager_secret" "beta_session_secret" {
  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
  project    = var.project_id
  secret_id  = "BETA_SESSION_SECRET"

  labels = {
    managed-by = "terraform"
    app        = var.app_name
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "beta_session_secret_version" {
  secret      = google_secret_manager_secret.beta_session_secret.id
  secret_data = var.beta_session_secret != "" ? var.beta_session_secret : "dev-placeholder-change-before-prod"
}
