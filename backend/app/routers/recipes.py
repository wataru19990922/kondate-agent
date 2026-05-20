"""レシピ検索エンドポイント。

POST /recipes/search を提供し、在庫食材リストから候補レシピを返す。
献立提案 (=ADK エージェントを通したもの) は別のエンドポイントで扱う。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services import elastic

router = APIRouter(prefix="/recipes", tags=["recipes"])


class SearchRequest(BaseModel):
    ingredients: list[str] = Field(
        ..., min_length=1, description="在庫食材名のリスト (例: ['鶏もも肉', '玉ねぎ'])"
    )
    size: int = Field(20, ge=1, le=100, description="返す候補件数")


class RecipeHit(BaseModel):
    recipe_id: str
    title: str
    description: str
    ingredient_names: list[str]
    cooking_time: str
    cost: str
    image_url: str
    recipe_url: str
    score: float


class SearchResponse(BaseModel):
    hits: list[RecipeHit]
    total: int


@router.post("/search", response_model=SearchResponse)
def search(req: SearchRequest) -> SearchResponse:
    try:
        raw_hits = elastic.search_recipes_by_ingredients(req.ingredients, size=req.size)
    except RuntimeError as e:
        # 設定不足等
        raise HTTPException(status_code=503, detail=str(e)) from e

    hits = [
        RecipeHit(
            recipe_id=h["recipe_id"],
            title=h["title"],
            description=h.get("description", ""),
            ingredient_names=h.get("ingredient_names", []),
            cooking_time=h.get("cooking_time", ""),
            cost=h.get("cost", ""),
            image_url=h.get("image_url", ""),
            recipe_url=h.get("recipe_url", ""),
            score=h["_score"],
        )
        for h in raw_hits
    ]
    return SearchResponse(hits=hits, total=len(hits))
