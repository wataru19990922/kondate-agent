"""FastAPI アプリのエントリポイント。

Cloud Run では `PORT` 環境変数で待受ポートが渡される。
ローカル起動: `uvicorn app.main:app --reload --port 8080`
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, recipes

settings = get_settings()

app = FastAPI(
    title="献立提案エージェント API",
    version="0.1.0",
    description="冷蔵庫の在庫から栄養バランス込みの献立を提案するエージェント API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(recipes.router)
