/*
 * GCP API の有効化。
 *
 * kondate-agent が必要とする全 API を宣言的に列挙する。
 * 新しいサービスを使うときはこの集合に追加して terraform apply。
 */

locals {
  required_services = [
    # AI / モデル
    "aiplatform.googleapis.com",         # Vertex AI Gemini
    "generativelanguage.googleapis.com", # 念のため (AI Studio 系のフォールバック)

    # データ
    "firestore.googleapis.com", # Firestore (在庫・履歴)

    # ランタイム
    "run.googleapis.com",              # Cloud Run (バックエンド)
    "artifactregistry.googleapis.com", # コンテナイメージ

    # 認証・IAM (bootstrap でも有効化済みだが宣言として持っておく)
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",

    # 観測
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]
}

resource "google_project_service" "required" {
  for_each = toset(local.required_services)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false # destroy 時に API を無効化しない (他リソースへの巻き添えを避ける)
}
