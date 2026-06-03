"""献立提案エージェントが使う ADK ツール群。

ADK は Python 関数を直接 `Agent.tools=[...]` に渡せる。
型ヒントと docstring からスキーマが自動生成されるので、関数定義はその前提で書く
(引数名・docstring が LLM に提示される)。
"""
from app.services import elastic


def search_recipes(ingredient_names: list[str]) -> list[dict]:
    """在庫食材の名前から、作れそうな候補レシピを検索する。

    Elasticsearch 上のレシピマスタを BM25 で検索し、上位 20 件を返す。
    各レシピは食材名のリストのみを持ち、分量・栄養は別途エージェントが算出する。

    Args:
        ingredient_names: 検索に使う食材名のリスト。在庫の食材名から
            主要なものを 3〜8 個程度抽出して渡すと精度が出やすい。
            (例: ["鶏むね肉", "卵", "玉ねぎ"])

    Returns:
        レシピ候補のリスト。各要素は以下のキーを持つ:
            - recipe_id (str): 楽天 recipeId
            - title (str): レシピ名
            - description (str): 短い説明
            - ingredient_names (list[str]): レシピが要求する食材名
            - cooking_time (str): 調理時間目安 (例: "約10分")
            - cost (str): 費用目安
            - recipe_url (str): 楽天レシピの詳細ページ URL
            - image_url (str): サムネイル画像 URL
            - score (float): BM25 スコア
    """
    raw_hits = elastic.search_recipes_by_ingredients(ingredient_names, size=20)
    return [
        {
            "recipe_id": h["recipe_id"],
            "title": h["title"],
            "description": h.get("description", ""),
            "ingredient_names": h.get("ingredient_names", []),
            "cooking_time": h.get("cooking_time", ""),
            "cost": h.get("cost", ""),
            "recipe_url": h.get("recipe_url", ""),
            "image_url": h.get("image_url", ""),
            "score": h.get("_score", 0.0),
        }
        for h in raw_hits
    ]
