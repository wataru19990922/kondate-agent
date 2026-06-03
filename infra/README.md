# kondate-agent インフラ (Terraform + GHA)

GCP リソースを Terraform で宣言的に管理する。
変更は `main` ブランチへのマージで自動 apply される。

## ディレクトリ

| パス | 内容 | apply 経路 | state |
|---|---|---|---|
| [`bootstrap/`](./bootstrap/) | TF state バケット / Workload Identity Federation / Terraform 用 SA | 手元で 1 回だけ `terraform apply` | ローカル `terraform.tfstate` (.gitignore 済) |
| [`live/`](./live/) | API 有効化 / アプリ用 SA / (今後) Firestore・Cloud Run など | `main` ブランチ push で GHA が自動 apply | GCS バケット `kondate-agent-2026-tfstate` |

## なぜ 2 段構えか

GitHub Actions が GCP に apply するには、その前提となる
**state バケット** と **Workload Identity Federation** が必要。
これらは Terraform 自身に管理させようとすると鶏卵問題になるため、
bootstrap で一度だけ手元から作る。bootstrap 完了後はもう触らない。

## 認証アーキテクチャ (キーレス)

| 主体 | 認証経路 | 長寿命キー |
|---|---|---|
| ローカル開発者 (個人 Gmail) | `gcloud auth application-default login` | 無 |
| Cloud Run runtime | `kondate-dev` SA を runtime SA に指定 | 無 (ランタイムで自動付与) |
| GitHub Actions | Workload Identity Federation (OIDC) → `kondate-tf` SA を impersonate | 無 |

ファイルとして保存される長寿命の SA キーは **どこにも存在しない**。
すべて短寿命トークンで動く。

---

## Bootstrap 手順 (一度きり)

### 前提

- 個人 Gmail で `kondate-agent-2026` プロジェクトが Cloud Console で作成済み
- 同プロジェクトに請求アカウントが紐付き済み
- 操作者の個人 Gmail が同プロジェクトの Owner

### 1. gcloud を個人 Gmail に向ける

会社の `default` 設定を温存するため、別 configuration を切る。

```bash
gcloud config configurations create kondate
gcloud config configurations activate kondate
gcloud auth login                                  # ブラウザで個人 Gmail を選択
gcloud config set project kondate-agent-2026
gcloud config set compute/region asia-northeast1

# Terraform / GCP クライアントライブラリ用の ADC
gcloud auth application-default login              # 同じ個人 Gmail で認証
```

> 注: `gcloud auth application-default login` はグローバルな ADC ファイル
> (`~/.config/gcloud/application_default_credentials.json`) を上書きします。
> 会社業務でローカル ADC を使う場合は、bootstrap 完了後に会社アカウントで
> 再度 `gcloud auth application-default login` するか、上書き前に
> ファイルを退避してください。

### 2. bootstrap apply

```bash
cd infra/bootstrap
terraform init
terraform plan
terraform apply
```

成功すると以下が表示される (例):

```
state_bucket_name                  = "kondate-agent-2026-tfstate"
workload_identity_provider         = "projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
terraform_service_account_email    = "kondate-tf@kondate-agent-2026.iam.gserviceaccount.com"
```

この 3 つの値は次の手順で GitHub に登録する。

### 3. GitHub Repository Variables を登録

GitHub の Settings → Secrets and variables → Actions → Variables タブで以下を登録:

| Variable 名 | 値 |
|---|---|
| `TF_STATE_BUCKET` | (上の `state_bucket_name`) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (上の `workload_identity_provider`) |
| `GCP_TERRAFORM_SERVICE_ACCOUNT` | (上の `terraform_service_account_email`) |
| `PERSONAL_ACCOUNT_EMAIL` | あなたの個人 Gmail アドレス |

CLI でも登録可:

```bash
gh variable set TF_STATE_BUCKET --body "kondate-agent-2026-tfstate"
gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "<上記の値>"
gh variable set GCP_TERRAFORM_SERVICE_ACCOUNT --body "<上記の値>"
gh variable set PERSONAL_ACCOUNT_EMAIL --body "あなた@gmail.com"
```

### 4. main ブランチ作成 + デフォルト変更

```bash
# 現在のブランチ (feat/frontend-scaffold) から main を切る
git checkout -b main
git push -u origin main

# GitHub UI: Settings → Branches → Default branch → main に変更
# CLI でも可:
gh repo edit --default-branch main
```

(任意) `main` をブランチ保護: Settings → Rules → main に対し
"Require pull request" を有効化。

### 5. 動作確認

`infra/live/` を少し変更する PR を作成し、Terraform Plan ワークフローが
PR にコメントすることを確認。マージすると Terraform Apply が走り、
kondate-dev SA や API 有効化が完了する。

---

## ローカルで `infra/live/` を試す (任意)

GHA が apply するので通常は不要だが、開発中に手元で確認したい場合:

```bash
cd infra/live
terraform init -backend-config="bucket=kondate-agent-2026-tfstate"
export TF_VAR_personal_account_email="あなた@gmail.com"
terraform plan
```

---

## クリーンアップ (ハッカソン終了後)

```bash
# 1. live で作った全リソースを削除
cd infra/live
terraform init -backend-config="bucket=kondate-agent-2026-tfstate"
terraform destroy

# 2. bootstrap で作った土台を削除
cd ../bootstrap
terraform destroy

# 3. (任意) GCP プロジェクトごと削除
gcloud projects delete kondate-agent-2026
```

state バケットは `force_destroy = false` なので、
destroy 前に手動で空にする必要がある:

```bash
gcloud storage rm -r gs://kondate-agent-2026-tfstate/**
```

---

## トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| bootstrap apply で `403 PERMISSION_DENIED` | 操作者が Project Owner でない | Cloud Console で IAM を確認 |
| GHA apply で `Unable to acquire impersonation credentials` | WIF の `attribute_condition` がリポジトリ名と不一致 | `infra/bootstrap/main.tf` の `var.github_repo` を実リポジトリに合わせる |
| `terraform.tfvars` に個人メールを書き込みそうになる | このリポジトリは public | `TF_VAR_personal_account_email` で env 経由に統一 (現状の運用通り) |
| `Error: project XXX has no billing account` | 請求紐付け未完了 | Cloud Console の Billing で紐付け |
