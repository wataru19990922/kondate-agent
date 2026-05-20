# CLAUDE.md

このプロジェクトで Claude Code が常時参照する開発ドキュメント。ハッカソンルール・プロダクト仕様・開発ガイドラインをここに集約する。

---

## プロジェクト概要

**献立提案エージェント** (仮称: `kondate-agent`)

冷蔵庫の在庫を把握し、その時点で「実際に作れる」献立を栄養バランス込みで提案する AI エージェント。Google Cloud + Gemini を中核とするハッカソン提出作品。

### 解決したい課題

1. 毎日の夜ご飯の献立を考えるのが面倒
2. Instagram 等でレシピを見つけても、家にある食材と頭の中で突合するのが大変
3. 食材が足りずに作れず断念することが多い
4. 栄養 (特にタンパク質) が十分摂取できているか不明なまま食べている

### 想定ユーザー体験 (MVP)

1. **在庫登録**: スーパーのレシートを撮影 → Gemini (Vision) が品目・数量を抽出 → 冷蔵庫の在庫 DB に追加
2. **献立提案**: 「今日の夜ご飯」とリクエスト → エージェントが在庫を参照 → 作れるメニュー + 栄養情報 (PFC・特にタンパク質) を提案
3. **採用フィードバック**: 「これにする」と回答 → 使用食材を在庫から減算
4. **栄養トラッキング** (Optional): 週次のタンパク質摂取量を可視化

---

## ハッカソンルール (絶対遵守)

### 必須要件 1: Google Cloud アプリケーション実行プロダクト (1つ以上)

- App Engine / Google Compute Engine
- Google Kubernetes Engine (GKE)
- **Cloud Run / Cloud Functions** ← 採用候補
- Cloud TPU / GPU

### 必須要件 2: Google Cloud AI 技術 (1つ以上)

- **Gemini Enterprise Agent Platform (旧 Vertex AI)** ← 採用候補
- **Gemini API** ← 採用候補 (Vertex AI 経由を推奨)
- Gemma / Imagen / Agent Builder
- **ADK (Agents Development Kit)** ← 採用検討
- Speech-to-Text / Text-to-Speech API
- Vision AI API / Natural Language AI API
- Translation AI API

### 任意要件

- Flutter / **Firebase** ← 採用候補 / Veo / Elasticsearch

---

## 技術スタック (確定)

サーバレス志向 (VM は可能な限り避ける) を前提とした FE/BE 分離構成。

| レイヤ | 採用 | 理由 |
|---|---|---|
| フロントエンド | **Vite + React + TypeScript + Tailwind CSS** | React 学習目的も兼ねる。Vite で雛形即生成、Tailwind で UI を素早く整える |
| ホスティング (FE) | **Firebase Hosting** | 静的配信・CDN・無料枠厚い。任意要件 (Firebase) もカバー |
| バックエンド | **Cloud Run + FastAPI (Python)** | **必須要件1**。サーバレス、ADK が Python 必須 |
| エージェント | **ADK (Agents Development Kit)** | **必須要件2** の追加加点。エージェント志向の看板になる |
| AI モデル | **Vertex AI 経由の Gemini 2.5 Flash (multimodal)** + Text Embeddings | **必須要件2**。レシート OCR・献立推論・埋め込み生成を Vertex AI で一気通貫 |
| ユーザーデータ DB | **Firestore** | 在庫・履歴・認証情報。書込頻度高くリアルタイム性必要 |
| レシピ検索基盤 | **Elastic Cloud (Elasticsearch)** | **任意要件 (スポンサー)**。BM25 + kNN ハイブリッド検索でレシピマスタを検索 |
| 認証 | **Firebase Auth (Google sign-in)** | 任意要件・実装コスト低 |
| 保険 (FE 切替) | Streamlit on Cloud Run | React で詰まったら即切替できるよう Python 一本道を確保 |

### 必須/任意要件の充足マップ

- 必須1 (実行プロダクト): **Cloud Run** ✓
- 必須2 (AI 技術): **Vertex AI + Gemini API + ADK** ✓✓✓
- 任意: **Firebase (Hosting/Auth/Firestore)** + **Elasticsearch** ✓

### React 学習コスト軽減方針

- 詰まったら遠慮なく Claude Code に聞く (フレームワーク理解より「やりたいこと」の言語化を優先)
- コンポーネント分割は無理に頑張らず、最初は `App.tsx` に全部書いてから整理
- 3-4 時間進めて致命的に詰まったら、Streamlit (保険ルート) に切り替え可能

### レシピデータ調達方針 (確定: B-1 修正版 + 動的生成)

楽天レシピ API は分量を返さないことが判明したため、以下のハイブリッド構成で確定:

| データ | 取得元・タイミング |
|---|---|
| レシピ名・URL・画像・調理時間目安・費用目安 | 楽天 CategoryList + CategoryRanking API (バッチで一度) |
| **食材名のリスト** | 楽天 API (`recipeMaterial`) (バッチで一度) |
| **食材ごとの分量・単位** | **献立提案時に ADK エージェントが動的算出** (家族構成・在庫量・人数を考慮) |
| 栄養情報 (PFC) | 同上、献立提案時に動的算出 |
| 調理手順 | 楽天レシピのページ URL に飛ばす (生成しない) |

#### なぜ分量を「動的生成」にしたか

- 家族構成 (1人 / 2人 / 4人) が違うと最適な分量は変わる
- アレルギー、ダイエット、子供向け等の個別事情に応じて柔軟に変えたい
- 「静的データのルックアップだけならエージェント不要」なので、ADK 採用の意義が薄れる
- レシピマスタを「2 人分固定」で持つと、再生成バッチが必要になり運用が複雑

#### 役割分担

| レイヤ | 役割 |
|---|---|
| Elasticsearch (レシピマスタ) | 在庫の食材名から「作れそうな候補レシピ」を 10〜20 件に絞る (BM25 + kNN) |
| ADK エージェント (Gemini) | 候補レシピを受け取り、「家族構成 × 在庫量 × 栄養」を考慮した動的提案を組み立てる |

### 楽天 API 認証仕様 (2025 年以降の新仕様)

- エンドポイント: `https://openapi.rakuten.co.jp/recipems/api/Recipe/...` (旧 `app.rakuten.co.jp` ではない)
- 必須認証情報: **Application ID (UUID)** + **Access Key** の 2 つ
- 必須ヘッダ: `Referer` / `Origin` (登録した「許可されたウェブサイト」と一致するもの)
  - 現状の動作確認済み値: `https://kondate-agent.web.app/` (`*.web.app` ワイルドカードにマッチ)
- 環境変数: `RAKUTEN_APP_ID` / `RAKUTEN_ACCESS_KEY` (`backend/.env` で管理)

### 未決事項 (要相談)

- レシート OCR を Gemini Vision のみで済ませるか、精度不足なら Document AI を併用するか (実装後に検証)
- ADK の `LlmAgent` 単発か、`SequentialAgent` でレシート解析→在庫照合→献立提案を分けるか
- レシピ取得目標件数 (CategoryRanking は各カテゴリ TOP4 のみ。全カテゴリで集めて ~400 件想定)

---

## データモデル (暫定)

```ts
// === Firestore (ユーザーデータ) ===

users/{user_id}
  display_name: string
  household_size: number     // 家族構成 (1 / 2 / 4 etc.) — 分量算出で利用
  dietary_prefs: string[]?   // 任意: "ダイエット中" "子供向け" 等 — エージェントが考慮
  allergies: string[]?       // 任意: "卵" "そば" 等 — エージェントが除外判定
  created_at: timestamp

users/{user_id}/inventory/{item_id}
  ingredient: string         // 例: "鶏むね肉"
  quantity: number
  unit: string               // "g" | "個" | "本" etc.
  expires_at: timestamp?
  added_at: timestamp
  source: "receipt" | "manual"

users/{user_id}/meals/{meal_id}
  date: timestamp
  recipe_id: string          // Elasticsearch のレシピ ID と紐付け
  menu_name: string
  ingredients_used: [{ ingredient, quantity, unit }]   // 提案時にエージェントが算出した値
  nutrition: { protein_g, fat_g, carb_g, kcal }        // 同上
  accepted: boolean

// === Elasticsearch (レシピマスタ) ===

recipes (index)
  recipe_id: string                  // 楽天 recipeId
  title: string                      // recipeTitle
  description: string                // recipeDescription
  ingredient_names: string[]         // recipeMaterial (分量なし、食材名のみ)
  ingredient_names_embedding: dense_vector  // 食材名連結を embeddings 化 (kNN 検索用)
  cooking_time: string               // recipeIndication "約10分"
  cost: string                       // recipeCost "100円以下"
  image_url: string
  recipe_url: string                 // 楽天レシピの詳細ページ
  category_ids: string[]             // カテゴリ階層 (検索フィルタ用)
```

レシピマスタは「食材名のみ」を持ち、分量・栄養はエージェントが提案時に動的算出する (静的に持たない)。

---

## ディレクトリ構成 (構築後に更新)

```
kondate-agent/
├── CLAUDE.md           # 本ファイル
├── README.md           # プロジェクト概要 (公開用)
├── SPEC.md             # 詳細仕様
├── frontend/           # Next.js
├── backend/            # Cloud Run (FastAPI)
└── infra/              # IaC (Terraform or gcloud スクリプト)
```

---

## 開発ガイドラインとワークフロー

### Plan モードを基本とする
- 3 ステップ以上 / アーキテクチャに関わる変更は必ず Plan モードで開始
- 途中でうまくいかなくなったら無理に進めず、立ち止まって再計画
- 構築だけでなく検証ステップにも Plan モードを使う
- 実装前に詳細な仕様を書いて曖昧さを減らす

### エレガントさを追求する (バランスよく)
- 重要な変更前に「もっとエレガントな方法はないか?」と一度立ち止まる
- ハック的な修正と感じたら「今知っていることをすべて踏まえてエレガントな解決策を実装する」
- シンプルで明白な修正にはこのプロセスをスキップ (過剰設計しない)

### コア原則
- **シンプル第一**: 影響するコードを最小限にする
- **手を抜かない**: 根本原因を見つける。一時的な修正は避ける
- **影響を最小化する**: バグを新たに引き込まない

### コーディング規約
- Python: PEP8
- TypeScript: Prettier + ESLint (Next.js デフォルト準拠)
- コメントは日本語で記述
- 複雑なロジックには JSDoc/docstring で意図を説明

### Claude への指示事項
- **回答は必ず日本語で行う**
- **不明点があればユーザーへ確認** (推測で進めない)
- 変更量が **200 行を超える可能性** がある場合は実行前に確認を取る:
  > 「この指示では変更量が 200 行を超える可能性がありますが、実行しますか?」
- 大きい変更は **まず計画を提案** してから着手:
  > 「このような計画で進めようと思います。」

### Git 運用
- `main` ブランチには直接コミットしない方針 (PR 経由)
- 変更ごとに新ブランチを切る
- マージ済みブランチには後追い commit しない

---

## セットアップ手順 (構築中)

```sh
# TODO: 依存導入手順を確定したら更新
# 例:
#   gcloud auth application-default login
#   firebase init
#   cd frontend && npm install
#   cd backend && uv sync
```

---

## 参考リンク (随時追加)

- Vertex AI Gemini: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models
- ADK: https://google.github.io/adk-docs/
- Firebase Auth + Next.js: https://firebase.google.com/docs/auth/web/start
