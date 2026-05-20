# data/

レシピマスタデータの取得・前処理スクリプトを置く場所。

## ファイル一覧

- `fetch_sample.py` — 楽天レシピ API のサンプルレスポンス 1 件取得 (構造確認用)
- `sample_rakuten_response.json` — 上記スクリプトの出力 (実行後に生成される)

## 楽天レシピ API の認証情報取得手順

楽天 Web Service は 2025 年頃に認証仕様が変更され、以下 2 つが必要になった:

- **Application ID** (UUID 形式 / 公開しても比較的安全だが扱いは秘匿同等)
- **Access Key** (秘匿情報 / 絶対に公開しない)

エンドポイントも `openapi.rakuten.co.jp` 配下に変更されている。

### 取得手順

1. https://webservice.rakuten.co.jp/app/create にアクセス
2. 楽天 ID でログイン (無ければ無料で作成)
3. 以下を入力して登録
   - Application name: `kondate_agent` 等 (記号 NG)
   - Application URL: `http://localhost`
   - 応募タイプ: ウェブアプリケーション
   - 許可されたウェブサイト: `*.web.app` / `*.run.app` 等
   - データ使用目的を記入、QPS は `1` を指定
4. 発行された **Application ID** (UUID) と **Access Key** をコピー
5. `backend/.env` の以下に貼り付け:
   ```
   RAKUTEN_APP_ID=<Application ID>
   RAKUTEN_ACCESS_KEY=<Access Key>
   ```

## サンプル取得の実行

```sh
cd ~/Desktop/kondate-agent
set -a; source backend/.env; set +a
python3 data/fetch_sample.py
```

レスポンスが `data/sample_rakuten_response.json` に保存される。

## ⚠️ 注意

- **Access Key は秘匿情報**。チャット / git / Slack 等に絶対に貼らない。漏洩したら楽天デベロッパーズで再発行する。
- 短時間に大量リクエストを送ると一時的にブロックされる可能性あり (利用規約参照)。
- `sample_rakuten_response.json` 自体は秘匿性のないレスポンスなので git にコミットして OK (構造確認の参考データ)。
