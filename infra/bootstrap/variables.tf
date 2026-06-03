variable "project_id" {
  type        = string
  description = "GCP プロジェクト ID。Cloud Console で手動作成済みのものを指定する。"
  default     = "kondate-agent-2026"
}

variable "region" {
  type        = string
  description = "リソースの既定リージョン。"
  default     = "asia-northeast1"
}

variable "state_bucket_name" {
  type        = string
  description = "Terraform state を置く GCS バケット名 (グローバル一意)。"
  default     = "kondate-agent-2026-tfstate"
}

variable "github_repo" {
  type        = string
  description = "GitHub リポジトリ (OWNER/REPO 形式)。WIF の identity binding に使う。"
  default     = "wataru19990922/kondate-agent"
}
