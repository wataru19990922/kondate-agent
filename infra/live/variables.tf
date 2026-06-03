variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID。"
}

variable "region" {
  type        = string
  description = "リソースの既定リージョン。"
  default     = "asia-northeast1"
}

variable "personal_account_email" {
  type        = string
  description = <<-EOT
    ローカル開発者の個人 Gmail アドレス。
    kondate-dev SA を impersonate する権限を付与するために必要。
    本番運用の SA 利用 (Cloud Run runtime) には影響しない。
  EOT
}

variable "billing_account_id" {
  type        = string
  description = <<-EOT
    プロジェクトに紐付いている請求アカウント ID (例: "017859-87C32C-5DA293")。
    google_billing_budget リソースが billing account 単位で管理されるため必要。
    GitHub Repository Variable BILLING_ACCOUNT_ID から TF_VAR 経由で渡す。
  EOT
}
