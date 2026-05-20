#!/usr/bin/env python3
"""
楽天レシピ - カテゴリ別ランキング API のサンプルレスポンスを取得する。

このスクリプトの目的は、`recipeMaterial` フィールドが分量を含む形式かどうかを
1 リクエストで確認し、データ調達方針 (B-1 ハイブリッド / A 案切替) を決めること。

楽天 API は 2025 年頃に認証仕様が変更され、以下が必要になった:
  - applicationId (UUID 形式)
  - accessKey (新規追加)
  - エンドポイントは openapi.rakuten.co.jp に変更

使い方:
    RAKUTEN_APP_ID=<your_app_id> RAKUTEN_ACCESS_KEY=<your_key> \\
        python3 data/fetch_sample.py [category_id]

デフォルト category_id は "30"。
レスポンスは data/sample_rakuten_response.json に保存される。
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

APP_ID = os.environ.get("RAKUTEN_APP_ID")
ACCESS_KEY = os.environ.get("RAKUTEN_ACCESS_KEY")
if not APP_ID:
    sys.exit("環境変数 RAKUTEN_APP_ID が未設定です。楽天デベロッパーズで取得してください。")
if not ACCESS_KEY:
    sys.exit("環境変数 RAKUTEN_ACCESS_KEY が未設定です。楽天デベロッパーズで取得してください。")

CATEGORY_ID = sys.argv[1] if len(sys.argv) > 1 else "30"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "sample_rakuten_response.json")

# 楽天レシピ - カテゴリ別ランキング API (最新バージョン 20170426 / 新エンドポイント)
params = {
    "applicationId": APP_ID,
    "accessKey": ACCESS_KEY,
    "categoryId": CATEGORY_ID,
    "format": "json",
}
url = (
    "https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryRanking/20170426"
    f"?{urllib.parse.urlencode(params)}"
)

masked = url.replace(APP_ID, "***APP_ID***").replace(ACCESS_KEY, "***ACCESS_KEY***")
print(f"[GET] {masked}")

# 楽天 API は 2026 年以降、Referer / Origin ヘッダを必須化している。
# 登録した URL に関係なく https://www.rakuten.co.jp/ を渡せば通る (コミュニティ報告ベース)。
# https://qiita.com/yamayoshi7/items/991f82dd9af8d7379a89
REFERER = os.environ.get("RAKUTEN_REFERER", "https://kondate-agent.web.app/")
headers = {
    "Referer": REFERER,
    "Origin": REFERER.rstrip("/"),
    "User-Agent": "Mozilla/5.0 (kondate-agent-hackathon)",
}
req = urllib.request.Request(url, headers=headers)

try:
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    sys.exit(
        f"[ERROR] HTTP {e.code}: {e.reason}\n"
        f"レスポンス本文: {body}\n\n"
        "applicationId / accessKey の組み合わせが正しいか確認してください。"
    )

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"[OK] レスポンスを保存: {OUTPUT_PATH}")

# サマリ表示
recipes = data.get("result", [])
print(f"\n取得件数: {len(recipes)}")
if recipes:
    first = recipes[0]
    print("\n--- 1件目サンプル ---")
    print(f"タイトル        : {first.get('recipeTitle')}")
    print(f"調理時間目安    : {first.get('recipeIndication')}")
    print(f"費用目安        : {first.get('recipeCost')}")
    print(f"レシピURL       : {first.get('recipeUrl')}")
    print("recipeMaterial  :")
    for m in first.get("recipeMaterial", []):
        print(f"  - {m}")
