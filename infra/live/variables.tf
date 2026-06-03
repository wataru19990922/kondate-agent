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
