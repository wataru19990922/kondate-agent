#!/usr/bin/env python3
"""楽天レシピ カテゴリ一覧 API を叩いて全カテゴリ構造を保存する。

楽天レシピのカテゴリは 3 階層 (large / medium / small) で構成される。
このスクリプトは 1 リクエストで 3 階層分まとめて取得し、件数サマリを表示する。

使い方:
    set -a; source backend/.env; set +a
    python3 data/fetch_categories.py

出力:
    data/categories.json  - カテゴリ一覧のフル JSON (後段の fetch_recipes.py で使用)
"""
import json
import os

from rakuten_client import request

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "categories.json")


def main() -> None:
    data = request("/recipems/api/Recipe/CategoryList/20170426")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"[OK] カテゴリ一覧を保存: {OUTPUT_PATH}")

    result = data.get("result", {})
    large = result.get("large", [])
    medium = result.get("medium", [])
    small = result.get("small", [])

    print()
    print(f"  large  カテゴリ数: {len(large)}")
    print(f"  medium カテゴリ数: {len(medium)}")
    print(f"  small  カテゴリ数: {len(small)}")
    print(f"  合計             : {len(large) + len(medium) + len(small)}")

    # 階層別に最初の 3 件をサンプル表示
    for level_name, items in [("large", large), ("medium", medium), ("small", small)]:
        print(f"\n--- {level_name} (先頭 3 件) ---")
        for item in items[:3]:
            print(f"  {json.dumps(item, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
