project_id = "kondate-agent-2026"
region     = "asia-northeast1"

# personal_account_email は環境変数 TF_VAR_personal_account_email で渡す。
# - ローカル: `export TF_VAR_personal_account_email="あなた@gmail.com"` の後に terraform apply
# - GHA:     GitHub の Repository Variable PERSONAL_ACCOUNT_EMAIL から workflow で注入
# git にコミットするとリポジトリ閲覧者に露出するため、ここには書かない。
