# TECH_DECISIONS.md

採用技術と「どのデータをどこに保存するか・なぜそれを選んだか」をまとめたドキュメント。

[CLAUDE.md](../CLAUDE.md) に簡略表があるが、本ファイルは **選定理由・却下した選択肢・トレードオフ** まで踏み込む。

---

## 1. 採用技術サマリ

| レイヤ | 採用技術 | バージョン目安 | 用途 |
|---|---|---|---|
| **FE フレームワーク** | Vite + React + TypeScript | React 19 / Vite 8 | SPA |
| **FE スタイル** | Tailwind CSS | v4 | ユーティリティクラス |
| **FE ホスティング** | Firebase Hosting | — | 静的配信 + CDN |
| **BE フレームワーク** | FastAPI (Python) | 0.115+ | REST + SSE |
| **BE ホスティング** | Cloud Run | — | サーバレスコンテナ |
| **エージェントフレームワーク** | ADK (Agent Development Kit) | 0.1+ | エージェント定義・連携 |
| **LLM** | Vertex AI Gemini 2.5 Flash | — | 推論・対話・Vision |
| **埋め込み** | Vertex AI text-multilingual-embedding-002 | — | レシピの 768 次元ベクトル化 |
| **ユーザ DB** | Firestore | — | 在庫・履歴・プロファイル |
| **検索エンジン** | Elasticsearch (Elastic Cloud) | 8.15+ | レシピ検索 (BM25 + kNN) |
| **認証** | Firebase Auth (Google sign-in) | — | OAuth |
| **シークレット管理** | Secret Manager | — | API キー等 |
| **コンテナレジストリ** | Artifact Registry | — | BE イメージ保管 |
| **IaC (任意)** | gcloud スクリプト | — | デプロイ自動化 |

---

## 2. データの保存先マッピング

データごとに「どこに、どんな形で保存するか」を明確化する。

### 2-1. Firestore に保存するデータ

| コレクション | 内容 | 主キー | アクセスパターン |
|---|---|---|---|
| `users/{user_id}` | ユーザプロファイル | user_id | 認証ごとに 1 回読み込み |
| `users/{user_id}/inventory/{item_id}` | 在庫食材 | item_id | 高頻度の CRUD |
| `users/{user_id}/meals/{meal_id}` | 食事履歴 | meal_id | 直近 7-30 日を読み出し |
| `chat_sessions/{session_id}` | 会話履歴 | session_id | 1 セッション 8 ターン程度 |

**なぜ Firestore か**:
- ドキュメント単位で書き込み完結 → 在庫アイテム 1 件追加が低レイテンシ
- リアルタイムリスナーで FE が自動更新できる (在庫タブ・栄養タブ)
- スキーマレス → ユーザの好み (アレルギー、嗜好) を後から拡張しやすい
- Firebase Auth との統合が一手で済む (security rules で user_id 一致を強制)
- 無料枠が厚い (読み 50k/日、書き 20k/日) → MVP/ハッカソン規模で課金リスクなし

### 2-2. Elasticsearch に保存するデータ

| インデックス | 内容 | 主キー | アクセスパターン |
|---|---|---|---|
| `recipes` | レシピマスタ (楽天 + 将来追加) | recipe_id | 高頻度の全文検索 + kNN |

**なぜ Elasticsearch か**:
- **BM25 (テキスト全文検索) と kNN (ベクトル類似検索) を 1 クエリで RRF 統合できる** (Elastic 8.8+)
- 日本語形態素解析 (kuromoji) が標準装備 → "鶏もも肉" が "鶏" や "もも" に正しく分割
- ハイブリッド検索が必須 (「鶏肉」のキーワード検索 + 「あっさり系」の意味検索)
- ハッカソンのスポンサー任意要件にも該当 → 加点
- Elastic Cloud の 14 日トライアルで MVP は完結

詳細スキーマ → [ELASTIC_SCHEMA.md](./ELASTIC_SCHEMA.md)

### 2-3. Cloud Storage / Vertex AI 一時利用

| 用途 | 場所 | 保存期間 |
|---|---|---|
| レシート画像 | Cloud Storage (一時) | 24 時間で削除 |
| Gemini Vision の入出力 | Vertex AI 内部 | 保存しない (in-flight) |

レシート画像は **永続保存しない方針** (プライバシー上のリスクと、再利用価値が低いため)。

### 2-4. メモリ内のみ保持

| データ | 場所 | 理由 |
|---|---|---|
| 会話途中のエージェント中間状態 | Cloud Run プロセス内 | 1 リクエスト内で完結 |
| Gemini への送信用 prompt | Cloud Run プロセス内 | API 呼び出し後は破棄 |

---

## 3. 主要な技術選定の理由と却下した選択肢

### 3-1. ユーザ DB: Firestore vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **Firestore** | ✓ | スキーマレス / リアルタイム / Firebase Auth 統合 / 無料枠 / Hosting と相性◎ |
| Cloud SQL (Postgres) | × | RDB が必要なほどの関係性なし。Cloud Run との接続管理が手間 |
| Cloud Spanner | × | 過剰 (グローバル分散不要) |
| Supabase / PlanetScale | × | GCP に統一したい (採点上 GCP 利用が必須要件) |
| AlloyDB | × | コスト高、ハッカソン規模では不要 |
| BigQuery | × | 分析用途。トランザクション処理に向かない |

### 3-2. レシピ検索: Elasticsearch vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **Elasticsearch (Elastic Cloud)** | ✓ | BM25 + kNN ハイブリッド / kuromoji / スポンサー要件 |
| Vertex AI Vector Search | × | kNN は強いが BM25 を持たない。日本語全文検索が弱い |
| Firestore + Algolia 連携 | × | Algolia は別ベンダ。スポンサー要件外 |
| pg_vector (Postgres) | × | RDB を採用しない方針 |
| Firestore 自前検索 | × | 全文検索が貧弱、ベクトル検索なし |
| Cloud SQL + FTS | × | RDB を採用しない方針 |
| OpenSearch on EC2 | × | サーバ運用したくない |

### 3-3. LLM: Vertex AI Gemini vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **Vertex AI Gemini 2.5 Flash** | ✓ | ハッカソン必須要件 (Vertex AI) / マルチモーダル (Vision) / 安価 |
| Vertex AI Gemini 2.5 Pro | △ | 精度高いが Flash で十分。コストと latency を考慮 |
| Gemini API (直叩き) | × | Vertex AI 経由が採点要件 |
| OpenAI GPT-4o | × | 採点要件外 |
| Anthropic Claude | × | 同上 |
| Gemma (オープン) | × | セルフホストの運用コスト |

### 3-4. エージェントフレームワーク: ADK vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **ADK (Agent Development Kit)** | ✓ | ハッカソン任意要件 / Vertex AI と統合 / Python ファースト |
| LangChain | × | 採点要件で ADK が優遇される / 重い |
| LlamaIndex | × | RAG 寄りで対話エージェントには不向き |
| AutoGen | × | Microsoft 系。GCP 統合性に欠ける |
| 自前実装 | × | エージェント間の状態管理を書く手間 |

### 3-5. BE 言語: Python vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **Python (FastAPI)** | ✓ | ADK が Python 必須 / Vertex AI SDK 充実 / 開発速度 |
| Node.js | × | ADK SDK が Python 中心 |
| Go | × | LLM エコシステムが弱い |

### 3-6. FE フレームワーク: React vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **React + Vite + TS** | ✓ | エコシステム / Firebase SDK 公式サポート / 学習用途も兼ねる |
| Next.js | × | SSR 不要 (Firebase Hosting で静的配信) / 学習コストが高い |
| Svelte / Solid | × | エコシステムが薄い |
| Streamlit (Python) | 保険 | React で詰まったときの避難先として準備 |
| Vue | × | React に統一 |

### 3-7. デプロイ先: Cloud Run vs ?

| 候補 | 採用 | 理由 |
|---|---|---|
| **Cloud Run** | ✓ | ハッカソン必須要件 / サーバレス / コンテナ移植性 |
| App Engine | × | コンテナベースでないと運用が硬直化 |
| GKE | × | Kubernetes は過剰 |
| Compute Engine | × | VM 運用したくない |
| Cloud Functions | × | エージェント実行に向かない (長時間処理) |

---

## 4. 1 リクエストあたりのコスト目安 (Gemini 中心)

献立提案 1 ターン (シナリオ 1 の流れ) のコストざっくり試算:

| サブエージェント | 入力 token 目安 | 出力 token 目安 | 呼び出し回数 |
|---|---|---|---|
| HistoryAnalyst | 300 | 100 | 1 |
| RecipeFinder | 500 | 200 | 1 |
| NutritionAnalyst | 800 | 300 | 1 (3 候補一括) |
| Coordinator (最終応答) | 1500 | 500 | 1 |
| **合計** | **3100 tokens** | **1100 tokens** | **4 calls** |

Gemini 2.5 Flash 料金 (2025 年時点想定): 入力 $0.075 / 1M tokens、出力 $0.30 / 1M tokens

→ 1 ターンあたり約 **$0.001 (約 0.15 円)**。ハッカソン規模なら無視できる。

レシート 1 枚処理: Gemini Vision で約 $0.005 (約 0.7 円)。

---

## 5. スケーラビリティと制限 (MVP 時点)

| リソース | 想定上限 (MVP) | 制限 |
|---|---|---|
| 同時ユーザ数 | 〜10 | Cloud Run max instances=10 |
| Firestore 読み書き | 〜50 ops/秒 | 無料枠の範囲 |
| Elastic Cloud | 1 ノード (1GB RAM) | トライアル構成 |
| Gemini QPS | 〜10 | デフォルトクォータ |
| レシピ件数 | 〜500 件 | Phase 3 で楽天から取得済 125 件、後で拡張 |

**ハッカソンの審査時の負荷想定**:
- 同時アクセスは数人程度 (審査員 + デモ実演者) → 十分対応可能

---

## 6. 今後の検討事項 (Post-MVP)

ハッカソン提出後に検討する技術:

- **レシピ追加**: 楽天以外のソース (DELISH KITCHEN API、自前生成) を統合
- **画像生成**: 提案レシピのイメージ画像を Imagen で生成
- **音声入出力**: Cloud Speech-to-Text / TTS で「冷蔵庫の前で話しかける」体験
- **Embedding の置き換え**: gemini-embedding-001 (3072 次元) で精度向上
- **キャッシュ層**: Memorystore Redis でセッション/プロファイルキャッシュ
- **オブザーバビリティ**: Cloud Trace で各エージェント呼び出しのレイテンシを可視化
