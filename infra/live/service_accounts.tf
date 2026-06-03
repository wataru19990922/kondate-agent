/*
 * アプリケーション用のサービスアカウント。
 *
 * `kondate-dev`:
 *   - Cloud Run の runtime SA として使う想定 (本番デプロイ時)
 *   - ローカル開発者は impersonate して同じ権限でテスト可能
 *   - 長寿命キーは作らない (キーレス運用)
 */

resource "google_service_account" "kondate_dev" {
  account_id   = "kondate-dev"
  display_name = "Kondate Agent Runtime"
  description  = "Cloud Run runtime / ローカル impersonation 用の最小権限 SA"

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

# kondate-dev SA に必要なロール (最小権限)
resource "google_project_iam_member" "kondate_dev_roles" {
  for_each = toset([
    "roles/aiplatform.user", # Gemini API 呼び出し
    "roles/datastore.user",  # Firestore 読み書き
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.kondate_dev.email}"
}

# ローカル開発者が kondate-dev SA を impersonate できるようにする
# (個人 Gmail ADC で直接 Vertex AI を呼ぶ運用なら不要だが、
#  「本番と同じ権限でテストしたい」シナリオへの備え)
resource "google_service_account_iam_member" "kondate_dev_impersonation" {
  service_account_id = google_service_account.kondate_dev.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "user:${var.personal_account_email}"
}
