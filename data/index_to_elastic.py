#!/usr/bin/env python3
"""data/recipes.json を Elasticsearch (Elastic Cloud) の `recipes` インデックスに投入する。

Phase 1: 埋め込みなしで投入し、BM25 検索ができる状態にする。
Phase 2 (Vertex AI 接続後): `ingredient_names_embedding` を生成して再投入 (別スクリプト予定)。

事前準備:
    1. Elastic Cloud の deployment を作成し ELASTIC_CLOUD_ID / ELASTIC_API_KEY を取得
       (docs/SETUP.md 参照)
    2. backend/.env に ELASTIC_CLOUD_ID と ELASTIC_API_KEY を設定
    3. pip install -r data/requirements.txt
       (もしくは backend の uv env: cd backend && uv run python ../data/index_to_elastic.py)

使い方:
    set -a; source backend/.env; set +a
    python3 data/index_to_elastic.py [--recreate]

オプション:
    --recreate  既存インデックスを削除してから作り直す (MVP 中は基本これを使う)
"""
import argparse
import json
import os
import sys

try:
    from elasticsearch import Elasticsearch, helpers
except ImportError:
    sys.exit(
        "elasticsearch ライブラリが未インストールです。"
        "`pip install -r data/requirements.txt` を実行してください。"
    )

RECIPES_PATH = os.path.join(os.path.dirname(__file__), "recipes.json")
INDEX_NAME = os.environ.get("ELASTIC_RECIPE_INDEX", "recipes")

# 食材名の埋め込み次元 (Vertex AI text-multilingual-embedding-002 が 768)
EMBEDDING_DIMS = 768

INDEX_SETTINGS = {
    "settings": {
        "analysis": {
            "analyzer": {
                "kuromoji_analyzer": {
                    "type": "custom",
                    "tokenizer": "kuromoji_tokenizer",
                    "filter": [
                        "kuromoji_baseform",
                        "kuromoji_part_of_speech",
                        "ja_stop",
                        "kuromoji_number",
                        "kuromoji_stemmer",
                        "lowercase",
                    ],
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "recipe_id": {"type": "keyword"},
            "title": {"type": "text", "analyzer": "kuromoji_analyzer"},
            "description": {"type": "text", "analyzer": "kuromoji_analyzer"},
            "ingredient_names": {
                "type": "text",
                "analyzer": "kuromoji_analyzer",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "ingredient_names_embedding": {
                "type": "dense_vector",
                "dims": EMBEDDING_DIMS,
                "index": True,
                "similarity": "cosine",
            },
            "cooking_time": {"type": "keyword"},
            "cost": {"type": "keyword"},
            "image_url": {"type": "keyword", "index": False},
            "recipe_url": {"type": "keyword", "index": False},
            "category_ids": {"type": "keyword"},
        }
    },
}


def get_client() -> Elasticsearch:
    cloud_id = os.environ.get("ELASTIC_CLOUD_ID")
    api_key = os.environ.get("ELASTIC_API_KEY")
    if not cloud_id or not api_key:
        sys.exit(
            "ELASTIC_CLOUD_ID / ELASTIC_API_KEY が未設定です。\n"
            "docs/SETUP.md の手順で Elastic Cloud をセットアップして backend/.env に追記してください。"
        )
    es = Elasticsearch(cloud_id=cloud_id, api_key=api_key, request_timeout=30)
    if not es.ping():
        sys.exit("Elastic Cloud への接続に失敗しました。CLOUD_ID / API_KEY を確認してください。")
    print(f"[OK] Elastic Cloud 接続成功 ({es.info()['version']['number']})")
    return es


def build_doc(recipe: dict) -> dict:
    """楽天 API のレシピ 1 件を ES ドキュメント形式に変換する。"""
    return {
        "_index": INDEX_NAME,
        "_id": str(recipe["recipeId"]),
        "_source": {
            "recipe_id": str(recipe["recipeId"]),
            "title": recipe.get("recipeTitle", ""),
            "description": recipe.get("recipeDescription", ""),
            "ingredient_names": recipe.get("recipeMaterial", []),
            "cooking_time": recipe.get("recipeIndication", ""),
            "cost": recipe.get("recipeCost", ""),
            "image_url": recipe.get("foodImageUrl", ""),
            "recipe_url": recipe.get("recipeUrl", ""),
            "category_ids": [str(recipe.get("sourceCategoryId", ""))],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="既存インデックスを削除してから作り直す",
    )
    args = parser.parse_args()

    es = get_client()

    if es.indices.exists(index=INDEX_NAME):
        if args.recreate:
            print(f"[INFO] 既存インデックス '{INDEX_NAME}' を削除")
            es.indices.delete(index=INDEX_NAME)
        else:
            sys.exit(
                f"インデックス '{INDEX_NAME}' が既に存在します。"
                " --recreate オプションで作り直してください。"
            )

    print(f"[INFO] インデックス '{INDEX_NAME}' を作成")
    es.indices.create(index=INDEX_NAME, body=INDEX_SETTINGS)

    with open(RECIPES_PATH, encoding="utf-8") as f:
        recipes = json.load(f)
    print(f"[INFO] 投入対象レシピ数: {len(recipes)}")

    actions = [build_doc(r) for r in recipes]
    success, errors = helpers.bulk(es, actions, raise_on_error=False)
    print(f"[OK] 投入成功: {success} 件")
    if errors:
        print(f"[WARN] 失敗: {len(errors)} 件")
        for e in errors[:3]:
            print(f"  {e}")

    es.indices.refresh(index=INDEX_NAME)
    count = es.count(index=INDEX_NAME)["count"]
    print(f"[OK] インデックス内ドキュメント数: {count}")


if __name__ == "__main__":
    main()
