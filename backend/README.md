# backend/

献立提案エージェントの Cloud Run バックエンド (FastAPI + ADK + Vertex AI)。

## 構成

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py            # FastAPI エントリポイント
│   ├── config.py          # 環境変数 / 設定
│   └── routers/
│       ├── __init__.py
│       └── health.py      # /healthz
├── .env.example           # 環境変数テンプレート
├── Dockerfile             # Cloud Run デプロイ用
├── pyproject.toml         # 依存定義 (uv)
└── README.md
```

## ローカル起動

前提: Python 3.11+ と [uv](https://docs.astral.sh/uv/) がインストール済み。

```sh
cd backend
cp .env.example .env       # 必要な値を埋める
uv sync                    # 依存インストール
uv run uvicorn app.main:app --reload --port 8080
```

確認:

```sh
curl http://localhost:8080/healthz
# => {"status":"ok","env":"local","gcp_project_configured":false,...}
```

## Docker でのローカル動作確認

```sh
docker build -t kondate-be .
docker run --rm -p 8080:8080 --env-file .env kondate-be
```

## Cloud Run へのデプロイ (後の工程)

```sh
gcloud run deploy kondate-be \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

シークレットは Secret Manager 経由で注入する (詳細は後で追加)。

## 今後のスケルトン

- [ ] `app/services/vertex_ai.py` — Gemini クライアント (画像→食材抽出)
- [ ] `app/services/elastic.py` — Elasticsearch クライアント (レシピ検索)
- [ ] `app/services/firestore.py` — Firestore クライアント (在庫操作)
- [ ] `app/agents/` — ADK エージェント定義
- [ ] `app/routers/inventory.py` — 在庫 CRUD
- [ ] `app/routers/recipes.py` — レシピ検索
- [ ] `app/routers/meals.py` — 献立提案
