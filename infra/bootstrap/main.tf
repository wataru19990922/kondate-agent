/*
 * 一度きりの bootstrap。
 *
 * このディレクトリは Terraform 自身が動くために必要な土台を構築する。
 * 具体的には次の 3 つ:
 *   1. Terraform state を置く GCS バケット
 *   2. GitHub Actions が GCP に認証するための Workload Identity Federation
 *   3. GitHub Actions / ローカル運用者が impersonate する Terraform 用 SA
 *
 * state はローカルファイルに保存する (リポジトリには含めない)。
 * 失った場合は再 apply で同じリソースを取り戻せる (resource は idempotent)。
 *
 * 実行手順は infra/README.md を参照。
 */

terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 一度有効化しておかないと後続リソースで Permission Denied が出る基本 API
resource "google_project_service" "bootstrap_apis" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# 1. Terraform state バケット
# -----------------------------------------------------------------------------
resource "google_storage_bucket" "tf_state" {
  name     = var.state_bucket_name
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = false # state を誤って消さない安全装置

  versioning {
    enabled = true # state 履歴を残す (障害時のリカバリ用)
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 30 # 古いバージョンは 30 世代より前を削除
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.bootstrap_apis]
}

# -----------------------------------------------------------------------------
# 2. Workload Identity Federation (GitHub OIDC -> GCP)
# -----------------------------------------------------------------------------
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-pool"
  display_name              = "GitHub Actions Pool"
  description               = "GitHub Actions から GCP へ認証するための WIF プール"

  depends_on = [google_project_service.bootstrap_apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  # GitHub OIDC のクレームを GCP の属性にマッピング
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # 指定リポジトリ以外からのトークンを拒否
  attribute_condition = "assertion.repository == \"${var.github_repo}\""
}

# -----------------------------------------------------------------------------
# 3. Terraform 用 SA (GHA がインパーソネーションする対象)
# -----------------------------------------------------------------------------
resource "google_service_account" "terraform" {
  account_id   = "kondate-tf"
  display_name = "Terraform Runner"
  description  = "Terraform / GitHub Actions が impersonate して apply 実行に使う SA"

  depends_on = [google_project_service.bootstrap_apis]
}

# Terraform SA に必要なロール。
# 「広め」だがハッカソン範囲を考慮 (本番では更に絞る)。
resource "google_project_iam_member" "terraform_roles" {
  for_each = toset([
    "roles/serviceusage.serviceUsageAdmin",  # APIs の有効化/無効化
    "roles/iam.serviceAccountAdmin",         # SA 作成
    "roles/iam.serviceAccountUser",          # SA を別リソース (Cloud Run 等) に紐付け
    "roles/resourcemanager.projectIamAdmin", # IAM ポリシー編集
    "roles/storage.admin",                   # GCS (state + artifact registry 等)
    "roles/run.admin",                       # Cloud Run のデプロイ管理
    "roles/datastore.owner",                 # Firestore のスキーマ・データ管理
    "roles/aiplatform.admin",                # Vertex AI 関連リソース
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.terraform.email}"
}

# GHA のワークフローからこの SA を impersonate する権限を付与
resource "google_service_account_iam_member" "wif_terraform_binding" {
  service_account_id = google_service_account.terraform.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# 予算 (google_billing_budget) を管理するため、billing account 上で costsManager ロールを付与
# (プロジェクト IAM ロールでは billing account のリソースを扱えないため、別途必要)
# roles/billing.user は budgets.create 権限を含まないので注意。
# roles/billing.costsManager は budgets の CRUD と費用データ閲覧を含む最小権限ロール。
resource "google_billing_account_iam_member" "terraform_billing_costs_manager" {
  billing_account_id = var.billing_account_id
  role               = "roles/billing.costsManager"
  member             = "serviceAccount:${google_service_account.terraform.email}"
}
