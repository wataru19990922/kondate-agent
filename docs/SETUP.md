# SETUP.md

外部サービス (GCP / Firebase / Elastic Cloud) のセットアップ手順。
**ユーザー側で実施する作業** をまとめている (Claude では代行できない部分)。

サンプル取得を待つ間に並行で進めて OK。

最終更新: 2026-05-20

---

## 全体像

本プロジェクトで必要な外部アカウント:

| サービス | 用途 | 無料枠 | 必須度 |
|---|---|---|---|
| Google Cloud Platform | Cloud Run, Vertex AI (Gemini) | $300 トライアル | **必須** |
| Firebase | Hosting, Auth, Firestore | Spark プラン無料枠 | **必須** |
| Elastic Cloud | レシピ検索 (BM25 + kNN) | 14 日トライアル | **必須** (任意要件加点) |
| 楽天デベロッパーズ | レシピ API | 無料 | **必須** (取得済み想定) |

---

## 1. Google Cloud Platform

### 1-1. プロジェクト作成

1. https://console.cloud.google.com にアクセス (Google アカウントでログイン)
2. 右上のプロジェクトセレクタ → 「新しいプロジェクト」
3. プロジェクト名: `kondate-agent` (任意、後で変更不可なので注意)
4. 課金アカウントを作成 (初回 $300 / 90 日のトライアルが付く)

### 1-2. 必要 API の有効化

Cloud Console の「API とサービス」→「ライブラリ」で以下を検索 → 有効化:

- **Vertex AI API** (Gemini 用)
- **Cloud Run API**
- **Cloud Build API** (デプロイ時に必要)
- **Artifact Registry API** (コンテナイメージ保存)
- **Cloud Storage API** (画像アップロード用、後で使う可能性)

または `gcloud` で一括:

```sh
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com
```

### 1-3. ローカル認証

```sh
# gcloud CLI インストール (まだなら)
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud auth application-default login
gcloud config set project <PROJECT_ID>
```

`application-default login` で生成された認証情報は Python SDK (Vertex AI クライアント等) が自動で参照する。

### 1-4. Vertex AI のリージョン

本プロジェクトでは **`asia-northeast1` (東京)** を採用予定。
Gemini 2.5 Flash が東京リージョンで利用可能かを以下で確認:

```sh
gcloud ai models list --region=asia-northeast1
```

利用不可なら `us-central1` を使う (レイテンシは増えるが安定)。

---

## 2. Firebase

### 2-1. プロジェクトリンク

1. https://console.firebase.google.com にアクセス
2. 「プロジェクトを追加」→ **GCP で作成済みの `kondate-agent` を選択** (新規作成しない)
3. Google Analytics は今回不要なのでオフ

### 2-2. 必要機能の有効化

Firebase Console で以下を有効化:

- **Authentication** → 「Sign-in method」→ Google プロバイダを有効化
- **Firestore Database** → 「データベースの作成」→ 本番モード → リージョン `asia-northeast1`
- **Hosting** → 「使ってみる」 (FE デプロイ時に使う)

### 2-3. Firebase CLI

```sh
npm install -g firebase-tools
firebase login
cd ~/Desktop/kondate-agent
firebase init
# 選択: Hosting, Firestore
# Public directory: frontend/dist
# Single-page app: Yes
```

`firebase.json` と `.firebaserc` が生成される (git にコミット OK)。

### 2-4. Web App 登録 (FE 用)

Firebase Console → プロジェクト設定 (歯車) → 「マイアプリ」→ Web (`</>`) を選択
→ アプリ名 `kondate-agent-web` → 登録
→ 表示される設定オブジェクトをコピー (FE の `.env.local` に入れる)

```js
// 例
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "kondate-agent.firebaseapp.com",
  projectId: "kondate-agent",
  // ...
};
```

---

## 3. Elastic Cloud

### 3-1. アカウント作成

1. https://cloud.elastic.co/registration にアクセス
2. メールアドレスで登録 (14 日トライアル、クレカ不要)
3. デプロイ作成
   - **Deployment name**: `kondate-recipes`
   - **Cloud provider**: Google Cloud
   - **Region**: `Tokyo (asia-northeast1)`
   - **Hardware profile**: Storage optimized (最小構成で OK)
   - **Version**: 最新の Elasticsearch
4. 表示される **`elastic` ユーザのパスワード** を必ず控える (二度と表示されない)

### 3-2. 接続情報の取得

デプロイ完了後:

- **Cloud ID**: デプロイ画面の「Manage this deployment」→「Endpoints」から取得
- **Elasticsearch endpoint URL**: 同上
- **API キー** (推奨、パスワード認証より安全):
  - Kibana → Stack Management → API keys → Create API key
  - 名前: `kondate-agent-be`
  - 権限: 一旦 superuser (MVP の間。後で絞る)

### 3-3. ローカルから疎通確認

```sh
curl -X GET "<ELASTIC_ENDPOINT>/_cluster/health" \
  -H "Authorization: ApiKey <API_KEY>"
```

`status: green` または `yellow` なら OK。

---

## 4. シークレット管理

ローカル開発では `backend/.env` に集約:

```env
# backend/.env (git にコミットしない)
GOOGLE_CLOUD_PROJECT=kondate-agent
GOOGLE_CLOUD_LOCATION=asia-northeast1
RAKUTEN_APP_ID=1234567890123456789
ELASTIC_CLOUD_ID=kondate-recipes:...
ELASTIC_API_KEY=...
```

Cloud Run デプロイ時は **Secret Manager** に登録 → サービス側で参照 (後の工程で対応)。

---

## 5. セットアップ完了チェックリスト

- [ ] GCP プロジェクト作成 + 課金有効化
- [ ] Vertex AI / Cloud Run / Cloud Build / Artifact Registry / Cloud Storage の API 有効化
- [ ] `gcloud auth application-default login` 完了
- [ ] Firebase プロジェクトを GCP プロジェクトにリンク
- [ ] Firebase Auth (Google) / Firestore / Hosting 有効化
- [ ] `firebase init` 実行
- [ ] Firebase Web App 登録 + 設定オブジェクト取得
- [ ] Elastic Cloud デプロイ作成 + 接続情報取得
- [ ] `backend/.env` に全シークレットを記入

すべて完了したら、PROGRESS.md の TODO 該当項目にチェックを付けて報告してほしい。
