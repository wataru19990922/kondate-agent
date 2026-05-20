# Cloud Run へデプロイするための Dockerfile
# ローカルでビルドして動作確認: docker build -t kondate-be . && docker run -p 8080:8080 kondate-be

FROM python:3.11-slim

WORKDIR /app

# uv をインストールして依存解決を高速化
RUN pip install --no-cache-dir uv

# 依存だけ先にコピーしてキャッシュを効かせる
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev || uv sync --no-dev

COPY app ./app

# Cloud Run は PORT 環境変数で待受ポートを指定する
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
