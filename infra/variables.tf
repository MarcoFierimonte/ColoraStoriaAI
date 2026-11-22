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
  description = "Default Gemini model for line-art coloring pages (default: gemini-nano-banana-2.1, high-quality raster line-art)."
  type        = string
  default     = "gemini-nano-banana-2.1"
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

variable "google_oauth_client_id" {
  description = "Optional Google OAuth 2.0 Web Client ID for Firebase Google Sign-In. Leave empty to enable Google Sign-In directly from Firebase Console."
  type        = string
  default     = ""
}

variable "google_oauth_client_secret" {
  description = "Optional Google OAuth 2.0 Web Client Secret for Firebase Google Sign-In."
  type        = string
  default     = ""
  sensitive   = true
}

variable "extra_authorized_domains" {
  description = "Optional extra domains to keep authorized in Firebase Auth (e.g. existing AI Studio preview hosts)."
  type        = list(string)
  default     = []
}

variable "allow_unauthenticated" {
  description = "If true, exposes Cloud Run publicly (allUsers). If false (default), restricts access via Cloud Run IAP + IAM to allowed_users / admin_emails."
  type        = bool
  default     = false
}

variable "allowed_users" {
  description = "Optional list of Google email addresses allowed to access the private Cloud Run service. Defaults to parsed admin_emails when empty."
  type        = list(string)
  default     = []
}

variable "enable_iap" {
  description = "Optional: enable Cloud Run direct IAP browser sign-in (requires Google Workspace Organization or custom IAP OAuth client). Only used when allow_unauthenticated = false."
  type        = bool
  default     = false
}

variable "beta_invite_required" {
  description = "If true, requires a valid personal invite code (or Google Admin session) to generate pages or export PDFs while keeping the landing page public."
  type        = bool
  default     = true
}

variable "beta_session_secret" {
  description = "HMAC signing secret (>= 16 chars) for beta invite session cookies stored in Secret Manager."
  type        = string
  default     = ""
  sensitive   = true
}
