resource "google_service_account" "cloud_run_sa" {
  project      = var.project_id
  account_id   = "${var.app_name}-runner"
  display_name = "Cloud Run runtime Service Account for ${var.app_name}"
}

# Grant access to read secrets in Secret Manager
resource "google_secret_manager_secret_iam_member" "gemini_secret_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.gemini_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "turnstile_secret_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.turnstile_secret_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_secret_manager_secret_iam_member" "beta_session_secret_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.beta_session_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant access to Firestore (datastore.user)
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# Grant logging permissions
resource "google_project_iam_member" "logging_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}
