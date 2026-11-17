locals {
  required_services = [
    "run.googleapis.com",                # Cloud Run v2
    "artifactregistry.googleapis.com",   # Artifact Registry for Docker images
    "cloudbuild.googleapis.com",         # Cloud Build for container builds
    "secretmanager.googleapis.com",      # Secret Manager for secure API keys
    "firestore.googleapis.com",          # Cloud Firestore database
    "identitytoolkit.googleapis.com",    # Firebase Auth / Identity Platform
    "firebase.googleapis.com",           # Firebase Management API
    "firebaserules.googleapis.com",      # Firestore Security Rules deployment
    "generativelanguage.googleapis.com", # Gemini Generative Language API
  ]
}

resource "google_project_service" "apis" {
  for_each                   = toset(locals.required_services)
  project                    = var.project_id
  service                    = each.key
  disable_on_destroy         = false
  disable_dependent_services = false
}
