/*
 * 本体 Terraform (GHA で apply される)。
 *
 * state は bootstrap で作成した GCS バケット上に置く。
 * backend.config は `terraform init` 時に -backend-config フラグ
 * (または backend.hcl ファイル) で渡す:
 *   terraform init -backend-config="bucket=kondate-agent-2026-tfstate"
 *
 * provider 認証は GHA から渡す Workload Identity Federation トークン
 * (ローカルでは個人 Gmail の ADC) で動く。
 */

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }

  backend "gcs" {
    prefix = "live"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
