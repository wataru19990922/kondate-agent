"""アプリケーション設定。環境変数 (.env) を pydantic-settings で読む。"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """環境変数で注入される設定値。

    Cloud Run 上では Secret Manager から環境変数として注入する想定。
    ローカル開発では backend/.env を参照する。
    """

    # GCP / Vertex AI
    google_cloud_project: str = ""
    google_cloud_location: str = "asia-northeast1"
    gemini_model: str = "gemini-2.5-flash"

    # Elastic Cloud
    elastic_cloud_id: str = ""
    elastic_api_key: str = ""
    elastic_recipe_index: str = "recipes"

    # 楽天レシピ API (バッチで使う想定。本番リクエスト経路では使わない)
    rakuten_app_id: str = ""

    # アプリ設定
    env: str = "local"  # local | staging | prod
    cors_allow_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """設定をキャッシュして返す (起動時 1 回だけ読み込む)。"""
    return Settings()
