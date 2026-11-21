# Enable Firebase Management on the Google Cloud project
resource "google_firebase_project" "default" {
  provider   = google-beta
  project    = var.project_id
  depends_on = [
    google_project_service.apis["firebase.googleapis.com"],
    google_project_service.apis["identitytoolkit.googleapis.com"]
  ]
}

# Provision Firestore Native Database
resource "google_firestore_database" "database" {
  depends_on                  = [google_project_service.apis["firestore.googleapis.com"]]
  project                     = var.project_id
  name                        = var.firestore_database_id
  location_id                 = var.firestore_region
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
  delete_protection_state     = "DELETE_PROTECTION_DISABLED"
  deletion_policy             = "DELETE"
}

# Deploy Firestore Security Rules from root firestore.rules
resource "google_firebaserules_ruleset" "firestore_ruleset" {
  depends_on = [
    google_firestore_database.database,
    google_project_service.apis["firebaserules.googleapis.com"]
  ]
  project = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../firestore.rules")
    }
  }
}

resource "google_firebaserules_release" "firestore_release" {
  depends_on   = [google_firebaserules_ruleset.firestore_ruleset]
  project      = var.project_id
  name         = "cloud.firestore/${var.firestore_database_id}"
  ruleset_name = google_firebaserules_ruleset.firestore_ruleset.name
}

# Register Firebase Web App
resource "google_firebase_web_app" "web_app" {
  provider     = google-beta
  project      = var.project_id
  display_name = var.app_name

  depends_on = [google_firebase_project.default]
}

# Fetch generated Firebase Web App configuration (API Key, AuthDomain, etc.)
data "google_firebase_web_app_config" "web_app_config" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.web_app.app_id

  depends_on = [google_firebase_web_app.web_app]
}

# Configure Identity Platform (Firebase Auth) with authorized domains
resource "google_identity_platform_config" "auth_config" {
  depends_on = [
    google_project_service.apis["identitytoolkit.googleapis.com"],
    google_firebase_project.default
  ]
  project = var.project_id

  authorized_domains = distinct(compact(concat([
    "localhost",
    "127.0.0.1",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
    trimprefix(google_cloud_run_v2_service.app.uri, "https://"),
    var.custom_domain != "" ? var.custom_domain : null,
  ], var.extra_authorized_domains)))
}

# Enable Google Identity Provider for popup login (optional via Terraform;
# if left empty, enable Google Sign-In in 1 click from Firebase Console)
resource "google_identity_platform_default_supported_idp_config" "google_idp" {
  count         = var.google_oauth_client_id != "" && var.google_oauth_client_secret != "" ? 1 : 0
  depends_on    = [google_identity_platform_config.auth_config]
  project       = var.project_id
  idp_id        = "google.com"
  enabled       = true
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret
}
