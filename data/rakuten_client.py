"""楽天ウェブサービス (openapi.rakuten.co.jp) への薄いクライアント。

2025 年以降の認証仕様:
  - applicationId (UUID) と accessKey の 2 つを query parameter で渡す
  - 登録した「許可されたウェブサイト」と一致する Referer / Origin ヘッダが必須

このモジュールはレシピ系の複数スクリプト (`fetch_sample.py`, `fetch_categories.py`,
`fetch_recipes.py` 等) から共通利用する。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://openapi.rakuten.co.jp"


def _load_credentials() -> tuple[str, str, str]:
    app_id = os.environ.get("RAKUTEN_APP_ID")
    access_key = os.environ.get("RAKUTEN_ACCESS_KEY")
    referer = os.environ.get("RAKUTEN_REFERER", "https://kondate-agent.web.app/")
    if not app_id:
        sys.exit("環境変数 RAKUTEN_APP_ID が未設定です。backend/.env を確認してください。")
    if not access_key:
        sys.exit("環境変数 RAKUTEN_ACCESS_KEY が未設定です。backend/.env を確認してください。")
    return app_id, access_key, referer


def request(path: str, params: dict | None = None, sleep_after: float = 1.0) -> dict:
    """楽天 API に GET リクエストを送り JSON を返す。

    Args:
        path: ベース URL からの相対パス (例 "/recipems/api/Recipe/CategoryList/20170426")
        params: 追加クエリパラメータ。applicationId / accessKey / format は自動で付与。
        sleep_after: レート制限対策。リクエスト後にスリープする秒数。

    Returns:
        パースした JSON (dict)
    """
    app_id, access_key, referer = _load_credentials()

    query: dict[str, str | int] = {
        "applicationId": app_id,
        "accessKey": access_key,
        "format": "json",
    }
    if params:
        query.update(params)

    url = f"{BASE_URL}{path}?{urllib.parse.urlencode(query)}"
    headers = {
        "Referer": referer,
        "Origin": referer.rstrip("/"),
        "User-Agent": "Mozilla/5.0 (kondate-agent-hackathon)",
    }
    req = urllib.request.Request(url, headers=headers)

    masked = url.replace(app_id, "***APP_ID***").replace(access_key, "***ACCESS_KEY***")
    print(f"[GET] {masked}")

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.exit(f"[ERROR] HTTP {e.code}: {e.reason}\nレスポンス本文: {body}")

    if sleep_after > 0:
        time.sleep(sleep_after)
    return data
