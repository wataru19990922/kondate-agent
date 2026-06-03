output "state_bucket_name" {
  value       = google_storage_bucket.tf_state.name
  description = "infra/live の backend.config に渡すバケット名。"
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "GHA ワークフローの workload_identity_provider に貼る値。"
}

output "terraform_service_account_email" {
  value       = google_service_account.terraform.email
  description = "GHA ワークフローの service_account に貼る値。"
}
