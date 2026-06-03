"""献立提案エージェントが使う ADK ツール群。

ADK は Python 関数を直接 `Agent.tools=[...]` に渡せる。
型ヒントと docstring からスキーマが自動生成されるので、関数定義はその前提で書く
(引数名・docstring が LLM に提示される)。

注意 (2026-06-03): Elastic Cloud を廃止しスタックを Google Cloud に統一する方針に
ピボットしたため、`search_recipes` は一時的にスタブ実装になっている。
Phase 1a smoke test 用に固定データを返す。検索基盤確定後 (Vertex AI Search 候補)
に実装を差し替える。元の Elastic 実装は git 履歴を参照。
"""


def search_recipes(ingredient_names: list[str]) -> list[dict]:
    """在庫食材の名前から、作れそうな候補レシピを検索する。

    現在はスタブ実装で、入力に関わらず固定の 3 件を返す。
    検索基盤 (Vertex AI Search 等) 確定後に本実装へ差し替える。

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
            - cooking_time (str): 調理時間目安
            - cost (str): 費用目安
            - recipe_url (str): 楽天レシピの詳細ページ URL
            - image_url (str): サムネイル画像 URL
            - score (float): 関連度スコア
    """
    return [
        {
            "recipe_id": "1390000001",
            "title": "鶏むね肉と卵のふんわり炒め",
            "description": "高タンパク・短時間で作れる定番おかず",
            "ingredient_names": ["鶏むね肉", "卵", "玉ねぎ", "醤油", "酒"],
            "cooking_time": "約15分",
            "cost": "300円以下",
            "recipe_url": "https://recipe.rakuten.co.jp/recipe/1390000001/",
            "image_url": "",
            "score": 1.0,
        },
        {
            "recipe_id": "1390000002",
            "title": "鶏むね肉のオムレツ風包み焼き",
            "description": "卵で包んでふんわり仕上げ",
            "ingredient_names": ["鶏むね肉", "卵", "塩", "胡椒"],
            "cooking_time": "約20分",
            "cost": "300円以下",
            "recipe_url": "https://recipe.rakuten.co.jp/recipe/1390000002/",
            "image_url": "",
            "score": 0.85,
        },
        {
            "recipe_id": "1390000003",
            "title": "鶏むね肉の親子丼風",
            "description": "鶏むね肉・卵・玉ねぎで作る簡単丼",
            "ingredient_names": ["鶏むね肉", "卵", "玉ねぎ", "ご飯", "麺つゆ"],
            "cooking_time": "約15分",
            "cost": "300円以下",
            "recipe_url": "https://recipe.rakuten.co.jp/recipe/1390000003/",
            "image_url": "",
            "score": 0.72,
        },
    ]
