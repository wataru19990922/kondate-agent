# PROGRESS.md

別ウィンドウ・別セッションで作業を引き継ぐための **進捗スナップショット**。
プロジェクト全体の仕様や技術スタックは [../CLAUDE.md](../CLAUDE.md) を参照。本ファイルは「いま何をしている最中か」のみを記録する。

最終更新: 2026-05-20

---

## 現在のフェーズ

**フェーズ**: 初期設計 → セットアップ準備 → BE 雛形作成済み → サンプル取得・分析完了 → **B-1 修正版に方針確定**
**ブロッカー**: なし (次工程に進める)
**並行で進行中**: GCP / Firebase / Elastic Cloud のアカウント準備 (ユーザー作業、[docs/SETUP.md](./SETUP.md) 参照)

---

## 直近の決定事項

1. **技術スタック確定** (CLAUDE.md 参照)
   - FE: Vite + React + TypeScript + Tailwind on Firebase Hosting
   - BE: Cloud Run + FastAPI + ADK (Python)
   - AI: Vertex AI - Gemini 2.5 Flash + Text Embeddings
   - DB: Firestore (ユーザーデータ) + Elastic Cloud (レシピ検索)
   - 認証: Firebase Auth
   - 保険ルート: Streamlit (React で詰まったら切替)

2. **レシピデータ調達方針: B-1 修正版 + 動的生成 (確定)**
   - 楽天レシピ API でレシピ名・食材**名のみ**・調理時間・URL・画像を取得 (バッチで一度)
   - **重要な発見**: `recipeMaterial` は分量を含まず食材名の配列のみ (`["長ナス", "ピーマン", ...]`)
   - 楽天の公開 API には Recipe Detail 系のエンドポイントが存在せず、API 経由で分量取得は不可能
   - レシピページ HTML のスクレイピングは規約リスクのため不採用
   - **分量・栄養情報の生成タイミングを「献立提案時」に変更** (動的生成):
     - 家族構成 (1人 / 2人 / 4人) によって最適な分量が変わるため、固定値で持たない方が筋がいい
     - レシピマスタを 2 人分固定にすると、再生成バッチが必要になり運用が複雑
     - 「静的データのルックアップ」だけでは ADK エージェント採用の意義が薄れる
   - 役割分担:
     - **Elasticsearch (レシピマスタ)**: 食材名で候補レシピを 10〜20 件に絞る (BM25 + kNN)
     - **ADK エージェント**: 候補レシピを受け取り、家族構成 × 在庫量 × 栄養を考慮して動的に提案を組み立て
   - データパイプライン簡素化: `enrich_quantities.py` は不要に

3. **認証仕様 (重要・新規)**
   - 楽天 API は 2025 年頃に認証仕様を大幅変更
   - エンドポイント: `https://openapi.rakuten.co.jp/recipems/api/Recipe/...`
   - 必須認証: **Application ID (UUID)** + **Access Key** (`.env` の `RAKUTEN_APP_ID` / `RAKUTEN_ACCESS_KEY`)
   - 必須ヘッダ: `Referer` / `Origin` (登録した「許可されたウェブサイト」と一致が必要)
   - 現状の動作確認済み Referer: `https://kondate-agent.web.app/` (`*.web.app` ワイルドカードにマッチ)

---

## TODO リスト (snapshot)

- [x] ディレクトリ構成の枠を作成 (`frontend/`, `backend/`, `infra/`, `data/`, `docs/`)
- [x] 楽天 API サンプルスクリプト作成 + applicationId 取得手順ドキュメント
- [x] サンプル取得実行 (新認証仕様 + Referer ヘッダ対応済み)
- [x] `sample_rakuten_response.json` を分析 → **B-1 修正版で進めると決定** (分量は Gemini 補完)
- [ ] Vite + React + TypeScript + Tailwind の FE 雛形を `frontend/` に生成 (後回し)
- [x] FastAPI 最小雛形を `backend/` に生成 (`/`, `/healthz` のみ)
- [ ] **(ユーザー並行作業中)** GCP プロジェクト / Firebase / Elastic Cloud のアカウント準備 ([docs/SETUP.md](./SETUP.md))
- [x] `data/fetch_categories.py` で CategoryList を取得しカテゴリ構造を把握 (large 43 / medium 544 / small 1574 / 合計 2161)
- [x] `data/fetch_recipes.py` で大カテゴリ 43 × CategoryRanking → **125 件取得** (`data/recipes.json` に保存)
- [x] ES インデックススキーマ設計 ([docs/ELASTIC_SCHEMA.md](./ELASTIC_SCHEMA.md))
- [x] `data/index_to_elastic.py` 作成 (Elastic Cloud 準備が完了次第すぐ動かせる状態)
- [x] BE に Elasticsearch クライアント (`app/services/elastic.py`) と検索エンドポイント (`POST /recipes/search`) 実装
- [x] BE の `/healthz/elastic` で Elastic 疎通確認可能に
- [ ] **(ユーザー作業待ち)** Elastic Cloud セットアップ + `backend/.env` に `ELASTIC_CLOUD_ID` / `ELASTIC_API_KEY` 設定
- [ ] **(セットアップ完了後)** `index_to_elastic.py --recreate` で 125 件投入
- [ ] BE に Vertex AI / Firestore クライアント実装
- [ ] レシート解析 PoC (Gemini Vision で画像 → 食材リスト)
- [ ] 献立提案エージェント (ADK + ハイブリッド検索 + 動的分量算出)
- [ ] Phase 2: ingredient_names_embedding を Vertex AI で生成し再投入 (kNN ハイブリッド)
- [ ] FE と BE を結線 (API 呼び出し + 認証)
- [ ] Cloud Run / Firebase Hosting にデプロイ

---

## 未決事項

- レシート OCR を Gemini Vision のみで済ませるか、精度不足なら Document AI を併用するか
- レシピ取得目標件数 (現時点では 300〜500 件想定)
- ADK の `LlmAgent` 単発か `SequentialAgent` でレシート解析→在庫照合→献立提案を分けるか

---

## 次に進めるアクション (Claude への指示候補)

ユーザーがサンプル取得を完了している場合:

> `data/sample_rakuten_response.json` を読んで `recipeMaterial` の構造を分析してください。B-1 続行可否を判断し、結果を PROGRESS.md と CLAUDE.md に反映してください。

ユーザーがまだ取得していない場合:

> `data/README.md` の手順で applicationId を取得後、サンプル取得を実行する案内をしてください。

GCP / Firebase / Elastic セットアップ完了後の作業候補:

> `backend/.env` をユーザーが埋めたら、Vertex AI / Firestore / Elasticsearch クライアントを `app/services/` に実装してください。
> `/healthz` で各サービスへの疎通確認も追加してください。

FE に着手する場合 (要相談):

> `frontend/` に Vite + React + TS + Tailwind の雛形を生成したい。`npm create vite@latest` で大量のファイルが生成されるので、進める前に内容を確認したい。

---

## 引き継ぎ手順 (別ウィンドウから)

1. 別ウィンドウで `cd ~/Desktop/kondate-agent`
2. `claude` を起動 (新規セッション)
3. 最初のメッセージで「[CLAUDE.md](../CLAUDE.md) と [docs/PROGRESS.md](./PROGRESS.md) を読んで現状を把握して」と伝える
4. 続行
