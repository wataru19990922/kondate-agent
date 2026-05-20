"""ヘルスチェックエンドポイント。Cloud Run のデプロイ確認用。"""
from fastapi import APIRouter

from app.config import get_settings
from app.services import elastic

router = APIRouter(tags=["health"])


@router.get("/")
def root() -> dict:
    return {"service": "kondate-agent-backend", "status": "ok"}


@router.get("/healthz")
def healthz() -> dict:
    """稼働確認 (依存サービスの疎通はチェックしない軽量版)。"""
    settings = get_settings()
    return {
        "status": "ok",
        "env": settings.env,
        "gcp_project_configured": bool(settings.google_cloud_project),
        "elastic_configured": bool(settings.elastic_cloud_id),
    }


@router.get("/healthz/elastic")
def healthz_elastic() -> dict:
    """Elastic Cloud への接続疎通を確認する (重め)。"""
    try:
        return elastic.ping()
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": str(e)}
