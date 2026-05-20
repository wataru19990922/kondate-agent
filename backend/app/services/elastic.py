"""Elasticsearch (Elastic Cloud) クライアント。

レシピマスタの BM25 検索を提供する。Phase 2 でハイブリッド検索 (BM25 + kNN) に拡張予定。
"""
from functools import lru_cache

from elasticsearch import Elasticsearch

from app.config import get_settings


@lru_cache
def get_es_client() -> Elasticsearch:
    """Elasticsearch クライアントをシングルトン的に返す。

    プロセス内で 1 度だけ接続を作る。設定が不足している場合はそのエラーが
    クライアント初期化時に発生する想定。
    """
    settings = get_settings()
    if not settings.elastic_cloud_id or not settings.elastic_api_key:
        raise RuntimeError(
            "ELASTIC_CLOUD_ID / ELASTIC_API_KEY が未設定です。backend/.env を確認してください。"
        )
    return Elasticsearch(
        cloud_id=settings.elastic_cloud_id,
        api_key=settings.elastic_api_key,
        request_timeout=30,
    )


def search_recipes_by_ingredients(ingredients: list[str], size: int = 20) -> list[dict]:
    """在庫食材から候補レシピを BM25 で検索する。

    Args:
        ingredients: 食材名のリスト (例: ["鶏もも肉", "玉ねぎ", "卵"])
        size: 返す候補件数の上限

    Returns:
        ES の `_source` を取り出したレシピ dict のリスト。スコアは `_score` に追加。
    """
    settings = get_settings()
    es = get_es_client()
    query_text = " ".join(ingredients)

    body = {
        "size": size,
        "query": {
            "match": {
                "ingredient_names": {
                    "query": query_text,
                    "operator": "or",
                }
            }
        },
    }
    res = es.search(index=settings.elastic_recipe_index, body=body)

    hits = []
    for h in res["hits"]["hits"]:
        doc = h["_source"]
        doc["_score"] = h["_score"]
        hits.append(doc)
    return hits


def ping() -> dict:
    """疎通確認。/healthz で利用。"""
    es = get_es_client()
    if not es.ping():
        return {"ok": False}
    info = es.info()
    return {"ok": True, "version": info["version"]["number"]}
