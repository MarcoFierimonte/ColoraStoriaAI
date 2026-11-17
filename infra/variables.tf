variable "project_id" {
  description = "The Google Cloud Project ID where all resources will be provisioned."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run and Artifact Registry (e.g. europe-west1, europe-west2)."
  type        = string
  default     = "europe-west1"
}

variable "firestore_region" {
  description = "Google Cloud region for Cloud Firestore (e.g. eur3 for multi-region Europe, europe-west1)."
  type        = string
  default     = "europe-west1"
}

variable "app_name" {
  description = "Base identifier used for naming resources (Cloud Run service, Artifact Registry repo, Service Account)."
  type        = string
  default     = "colorastoria"
}

variable "gemini_api_key" {
  description = "Google Gemini API key with access to Generative Language API."
  type        = string
  sensitive   = true
}

variable "gemini_model" {
  description = "Default Gemini model for line-art coloring pages (default: gemini-4-hydrogen, free-tier SVG line-art)."
  type        = string
  default     = "gemini-4-hydrogen"
}

variable "ai_provider" {
  description = "Default AI provider for coloring generation (gemini or openai)."
  type        = string
  default     = "gemini"
}

variable "admin_emails" {
  description = "Comma-separated verified Google email addresses granted Admin access (e.g. 'marco.fierimonte@gmail.com')."
  type        = string
  default     = ""
}

variable "turnstile_site_key" {
  description = "Cloudflare Turnstile public site key (optional, leave empty if not used)."
  type        = string
  default     = ""
}

variable "turnstile_secret_key" {
  description = "Cloudflare Turnstile secret key (optional, leave empty if not used)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "firestore_database_id" {
  description = "Firestore database ID. Defaults to (default) for standard projects."
  type        = string
  default     = "(default)"
}

variable "custom_domain" {
  description = "Optional custom domain name for the frontend (e.g. colorastoria.com) to allowlist in Firebase Auth."
  type        = string
  default     = ""
}

variable "container_image" {
  description = "Container image tag to deploy on Cloud Run. If empty, points to Artifact Registry :latest."
  type        = string
  default     = ""
}
