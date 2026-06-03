output "kondate_dev_sa_email" {
  value       = google_service_account.kondate_dev.email
  description = "アプリケーション用 SA のメール。Cloud Run runtime に指定する。"
}

output "enabled_apis" {
  value       = [for s in google_project_service.required : s.service]
  description = "有効化された API の一覧。"
}
