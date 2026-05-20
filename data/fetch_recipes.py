#!/usr/bin/env python3
"""楽天レシピ カテゴリ別ランキング API を全カテゴリで叩いてレシピを集める。

CategoryRanking は各カテゴリ TOP 4 のレシピを返すため、複数カテゴリでループして
件数を稼ぐ。重複は recipeId でデデュプ。

使い方:
    set -a; source backend/.env; set +a
    python3 data/fetch_recipes.py              # 大カテゴリ (43) のみ
    python3 data/fetch_recipes.py --medium     # 大 + 中カテゴリ (587)
    python3 data/fetch_recipes.py --all        # 全階層 (2161)

入力:
    data/categories.json  (fetch_categories.py の出力)

出力:
    data/recipes.json  - 重複除去済みレシピ一覧
"""
import argparse
import json
import os

from rakuten_client import request

CATEGORIES_PATH = os.path.join(os.path.dirname(__file__), "categories.json")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "recipes.json")


def collect_target_category_ids(levels: set[str]) -> list[str]:
    """指定した階層 (large/medium/small) のカテゴリ ID を収集する。

    medium/small は parentCategoryId と組み合わせた階層付き ID
    (例 "10-275", "10-67-1492") を使う必要がある (CategoryRanking API の仕様)。
    """
    with open(CATEGORIES_PATH, encoding="utf-8") as f:
        cats = json.load(f)["result"]

    ids: list[str] = []

    # large は単独 ID (例 "30")
    if "large" in levels:
        for c in cats.get("large", []):
            ids.append(str(c["categoryId"]))

    # medium は "{parent}-{id}" (例 "10-275")
    if "medium" in levels:
        for c in cats.get("medium", []):
            ids.append(f"{c['parentCategoryId']}-{c['categoryId']}")

    # small は "{grand}-{parent}-{id}" だが、parentCategoryId は medium の id を指す。
    # categoryUrl から階層 ID を抽出する (例: ".../category/10-66-50/" → "10-66-50")
    if "small" in levels:
        for c in cats.get("small", []):
            url = c.get("categoryUrl", "")
            # ".../category/10-66-50/?..." から "10-66-50" を抽出
            segs = url.split("/category/")
            if len(segs) >= 2:
                hier_id = segs[1].split("/")[0].split("?")[0]
                ids.append(hier_id)
    return ids


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--medium", action="store_true", help="大 + 中カテゴリで取得")
    parser.add_argument("--all", action="store_true", help="全階層で取得")
    args = parser.parse_args()

    if args.all:
        levels = {"large", "medium", "small"}
    elif args.medium:
        levels = {"large", "medium"}
    else:
        levels = {"large"}

    category_ids = collect_target_category_ids(levels)
    print(f"対象カテゴリ数: {len(category_ids)} (階層: {sorted(levels)})")
    print(f"推定所要時間: 約 {len(category_ids)} 秒 (1 秒/req sleep)\n")

    seen: dict[int, dict] = {}
    for i, cid in enumerate(category_ids, start=1):
        try:
            data = request(
                "/recipems/api/Recipe/CategoryRanking/20170426",
                params={"categoryId": cid},
                sleep_after=1.0,
            )
        except SystemExit as e:
            # 個別カテゴリの失敗で全体停止しないようスキップ
            print(f"  [SKIP] categoryId={cid}: {e}")
            continue

        recipes = data.get("result", [])
        new_count = 0
        for r in recipes:
            rid = r.get("recipeId")
            if rid is None:
                continue
            if rid in seen:
                continue
            r["sourceCategoryId"] = cid
            seen[rid] = r
            new_count += 1
        print(f"  [{i:4d}/{len(category_ids)}] cid={cid:>12s} +{new_count} (累計 {len(seen)})")

    print(f"\n[OK] 重複除去後の総レシピ数: {len(seen)}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(list(seen.values()), f, ensure_ascii=False, indent=2)
    print(f"[OK] 保存: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
