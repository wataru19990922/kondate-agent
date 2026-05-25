# SYSTEM_DESIGN.md

kondate-agent のシステム設計書 (図入り)。
図は Mermaid で書いてあるので、VSCode の Markdown Preview、GitHub、Notion 等でそのまま見られる。

関連ドキュメント:
- [CLAUDE.md](../CLAUDE.md) — 全体仕様 / 技術スタック
- [AGENT_DESIGN.md](./AGENT_DESIGN.md) — エージェント設計の哲学
- [AGENT_SCENARIOS.md](./AGENT_SCENARIOS.md) — 会話フロー例
- [API_CONTRACT.md](./API_CONTRACT.md) — API 契約・ツールシグネチャ
- [ELASTIC_SCHEMA.md](./ELASTIC_SCHEMA.md) — 検索インデックス

---

## 1. 全体アーキテクチャ

ユーザのブラウザから AI エージェントまでの構成。Cloud Run の中で 4 つのエージェントが協調する。

```mermaid
graph TB
    User([User Browser])

    subgraph Frontend["Frontend (Firebase Hosting)"]
        FE[React + Vite + Tailwind]
    end

    subgraph FB["Firebase"]
        Auth[Firebase Auth<br/>Google sign-in]
        FS[(Firestore<br/>users / inventory / meals)]
    end

    subgraph BE["Backend (Cloud Run / FastAPI)"]
        API[FastAPI Router]
        Coord[KondateCoordinator<br/>LlmAgent]
        RF[RecipeFinder<br/>Sub-agent]
        NA[NutritionAnalyst<br/>Sub-agent]
        HA[HistoryAnalyst<br/>Sub-agent]

        API --> Coord
        Coord -.->|invoke as tool| RF
        Coord -.->|invoke as tool| NA
        Coord -.->|invoke as tool| HA
    end

    subgraph GCP["Google Cloud"]
        Vertex[Vertex AI<br/>Gemini 2.5 Flash]
        Vision[Gemini Vision API<br/>レシート OCR]
        SM[Secret Manager]
    end

    subgraph Elastic["Elastic Cloud"]
        ES[(Elasticsearch<br/>recipes index<br/>BM25 + kNN)]
    end

    User -->|HTTPS| FE
    User -.->|OAuth| Auth
    FE -->|REST + SSE| API

    Coord -->|LLM| Vertex
    RF -->|LLM| Vertex
    NA -->|LLM| Vertex
    HA -->|aggregation only| FS

    RF -->|search| ES
    API -->|read/write| FS
    API -->|receipt OCR| Vision
    API -.->|inject| SM
```

**ポイント:**
- 4 エージェントが Cloud Run の 1 プロセス内で動く (Coordinator が他 3 つを「ツール」として呼ぶ)
- HistoryAnalyst は集計が主なので LLM 不要 (純関数 + 軽量 LLM のハイブリッド予定)
- レシピ検索だけ Elastic Cloud、それ以外の永続化は Firestore に集約

---

## 2. エージェント協調シーケンス (献立提案 1 ターン)

「今夜何食べる?」と聞かれてから、エージェントが思考プロセスを SSE で逐次返すまでの流れ。

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as FastAPI (SSE)
    participant Co as Coordinator
    participant HA as HistoryAnalyst
    participant RF as RecipeFinder
    participant NA as NutritionAnalyst
    participant FS as Firestore
    participant ES as Elasticsearch
    participant V as Vertex AI<br/>(Gemini)

    U->>FE: 「今夜何食べる?」
    FE->>API: POST /meals/chat (open SSE)

    API->>Co: invoke(message, context)
    API-->>FE: event:thinking {agent:"Coordinator", status:"start"}

    Co->>FS: get_inventory_summary()
    FS-->>Co: 在庫 10 品目 + 期限近 1 件

    Co->>HA: check_meal_variety(days=7)
    API-->>FE: event:thinking {agent:"HistoryAnalyst", status:"start"}
    HA->>FS: get_meal_history(7)
    FS-->>HA: 6 件
    HA->>HA: aggregate (純関数)
    HA-->>Co: 肉系 5/6 日, P 平均 26g
    API-->>FE: event:thinking {agent:"HistoryAnalyst", status:"done"}

    Co->>RF: find_recipes(query, filters)
    API-->>FE: event:thinking {agent:"RecipeFinder", status:"start"}
    RF->>ES: BM25 + kNN
    ES-->>RF: 5 候補
    RF->>RF: match_inventory()
    RF-->>Co: ランキング済み 3 件
    API-->>FE: event:thinking {agent:"RecipeFinder", status:"done"}

    Co->>NA: analyze_nutrition(top_3)
    API-->>FE: event:thinking {agent:"NutritionAnalyst", status:"start"}
    NA->>V: estimate PFC (Gemini)
    V-->>NA: 推定値
    NA-->>Co: 評価コメント付き
    API-->>FE: event:thinking {agent:"NutritionAnalyst", status:"done"}

    Co->>V: 応答生成 (Gemini)
    V-->>Co: text + proposals
    API-->>FE: event:message {text, proposals, reasoning_summary}
    API-->>FE: event:done {total_duration_ms}

    FE-->>U: 思考プロセス + 提案カード
```

**ポイント:**
- 各サブエージェント呼び出し前後で `thinking` イベントが流れる → UI で「いま何を考えてるか」が見える
- HistoryAnalyst → RecipeFinder → NutritionAnalyst の **順序に意味がある** (履歴 = 提案方向の決定 → 検索 = 候補絞り → 栄養 = 最終選定)
- Coordinator は LLM 判断で「順序を変える」自由度を持つ (例: 食材指定型のシナリオ 5 では HistoryAnalyst をスキップ)

---

## 3. レシート登録フロー

レシート画像から Gemini Vision で食材を抽出し、在庫に追加するまで。

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as FastAPI
    participant V as Gemini Vision
    participant Cat as Categorize<br/>(local fn)
    participant FS as Firestore

    U->>FE: レシート画像を選択
    FE->>API: POST /receipts/parse<br/>(multipart, image bytes)

    API->>V: image + extraction prompt
    Note over V: 「商品名・数量・単位を JSON で抽出。<br/>食材以外 (洗剤・税等) は除外。」
    V-->>API: {ingredients: [{name, qty, unit}, ...]}

    API->>Cat: categorize each name
    Cat-->>API: with category field
    API-->>FE: extracted list (確認画面用)

    U->>FE: 「すべて在庫に追加」
    FE->>API: POST /inventory/bulk
    API->>FS: write multiple docs
    FS-->>API: created
    API-->>FE: 200 ok
    FE-->>U: 在庫タブに反映
```

**ポイント:**
- Gemini Vision を「商品名から食材だけ抽出」に特化させる (税・容器・割引等は無視)
- 自動カテゴリ判定 (categorize) は LLM 不要の純関数なので BE 側で完結
- ユーザが内容を確認してから一括追加 (誤抽出時の修正余地を残す)

---

## 4. データフロー (献立提案の Lifecycle)

ユーザが発話してから「これにする」で在庫が減って栄養に記録されるまで。

```mermaid
flowchart LR
    U([User]) --> Input[発話入力]
    Input --> API1[POST /meals/chat]
    API1 --> Stream{SSE Stream}

    Stream --> T[thinking events x N]
    Stream --> M[message event<br/>+ proposals]
    Stream --> D[done event]

    T --> UI1[FE: 思考プロセス UI<br/>折りたたみ可能]
    M --> UI2[FE: チャットバブル<br/>+ レシピカード]

    UI2 -->|これにする クリック| Accept[POST /meals/accept]
    Accept --> Inv[Firestore<br/>inventory 減算]
    Accept --> Hist[Firestore<br/>meals に追加]
    Accept --> Ack[応答: ack message]

    Hist -.->|reactive update| Nut[FE: 栄養タブ<br/>当日値更新]
    Inv -.->|reactive update| InvTab[FE: 在庫タブ]
```

**ポイント:**
- 提案 (POST /meals/chat) と採用 (POST /meals/accept) は別エンドポイント = 「提案が出ても採用するとは限らない」を素直に表現
- Firestore の Reactive リスナを使えば、栄養タブ・在庫タブはリアルタイム反映される

---

## 5. データモデル (ER 図)

Firestore コレクションと Elasticsearch インデックスの関係。

```mermaid
erDiagram
    User ||--o{ InventoryItem : owns
    User ||--o{ MealRecord : has
    User ||--o{ ChatSession : has
    ChatSession ||--o{ ChatMessage : contains
    MealRecord }o..|| Recipe : references

    User {
        string user_id PK
        string display_name
        number household_size
        string_array allergies
        string_array dietary_prefs
        number protein_target_per_day
        timestamp created_at
    }

    InventoryItem {
        string item_id PK
        string user_id FK
        string ingredient
        number quantity
        string unit
        string category
        string expires_at
        string source
        timestamp added_at
    }

    MealRecord {
        string meal_id PK
        string user_id FK
        string recipe_id FK
        date meal_date
        string recipe_title
        string recipe_url
        number household_size
        json nutrition_per_person
        boolean accepted
    }

    Recipe {
        string recipe_id PK
        string title
        string description
        string_array ingredient_names
        vector ingredient_embedding
        string cooking_time
        string cost
        string image_url
        string recipe_url
        string_array category_ids
    }

    ChatSession {
        string session_id PK
        string user_id FK
        timestamp created_at
        timestamp updated_at
        json context
    }

    ChatMessage {
        string message_id PK
        string session_id FK
        string role
        string text
        json proposals
        timestamp ts
    }
```

**保存場所:**
- `Recipe` (太線) → **Elasticsearch** (検索専用、楽天レシピを取り込んだもの)
- それ以外 → **Firestore**
- `MealRecord.recipe_id` は ES 側の主キーを参照する弱いリレーション (cross-store)

---

## 6. デプロイ構成

本番デプロイ時のリソース配置とトラフィックの流れ。

```mermaid
graph TB
    User([User Browser])

    subgraph FBHost["Firebase Hosting (CDN)"]
        Static[Static Files<br/>HTML / JS / CSS]
    end

    subgraph FBAuth["Firebase Auth"]
        OAuth[Google OAuth]
    end

    subgraph FBData["Firebase / Firestore"]
        FS[(Firestore<br/>asia-northeast1)]
    end

    subgraph GCP_Tokyo["Google Cloud (asia-northeast1)"]
        AR[Artifact Registry<br/>コンテナイメージ]
        CR[Cloud Run<br/>FastAPI + ADK<br/>min=0 max=10]
        VAI[Vertex AI<br/>Gemini 2.5 Flash<br/>Gemini Vision]
        SM[Secret Manager<br/>API keys / Elastic creds]
    end

    subgraph EC_Tokyo["Elastic Cloud (asia-northeast1)"]
        ES[(Elasticsearch<br/>recipes index)]
    end

    User -->|HTTPS<br/>1. ページ表示| Static
    User -.->|2. sign-in| OAuth
    User -->|3. API<br/>REST + SSE| CR

    CR -->|4. agent reasoning| VAI
    CR -->|5. read/write| FS
    CR -->|6. recipe search| ES
    CR -.->|env var inject| SM
    AR -.->|deploy| CR

    classDef gcp fill:#4285F4,color:#fff,stroke:#1A73E8
    classDef firebase fill:#FFA000,color:#fff,stroke:#FF6F00
    classDef elastic fill:#00BFB3,color:#fff,stroke:#00897B

    class CR,VAI,SM,AR gcp
    class Static,OAuth,FS firebase
    class ES elastic
```

**ポイント:**
- すべて東京リージョン (`asia-northeast1`) で統一 → レイテンシ最小化
- Cloud Run は `min=0` で課金抑制 (cold start はあるが MVP では許容)
- Secret Manager で API キーを管理 (環境変数として注入)
- ハッカソン提出後に料金が増えないよう、すべて無料枠 or 従量課金最小

---

## 7. Phase 別の構成変化

実装ステージごとに、上記アーキテクチャのどの部分が動いてるかを示す。

```mermaid
graph TB
    subgraph P1["Phase 1: ローカル + Mock LLM"]
        FE1[FE on localhost:5173]
        BE1[BE on localhost:8080]
        MockLLM[Mock LLM<br/>キーワード判定]
        MockData[(in-memory<br/>inventory + recipes 125 件)]
        FE1 --> BE1
        BE1 --> MockLLM
        BE1 --> MockData
    end

    subgraph P2["Phase 2: + Vertex AI"]
        FE2[FE on localhost]
        BE2[BE on localhost]
        Gemini[Vertex AI Gemini]
        MockData2[(in-memory)]
        FE2 --> BE2
        BE2 --> Gemini
        BE2 --> MockData2
    end

    subgraph P3["Phase 3: + Elastic Cloud"]
        FE3[FE on localhost]
        BE3[BE on localhost]
        Gemini3[Vertex AI Gemini]
        ES3[(Elasticsearch)]
        FS3[(in-memory inventory)]
        FE3 --> BE3
        BE3 --> Gemini3
        BE3 --> ES3
        BE3 --> FS3
    end

    subgraph P4["Phase 4: + Firestore + Hosting (本番)"]
        FE4[FE on Firebase Hosting]
        BE4[BE on Cloud Run]
        Gemini4[Vertex AI Gemini]
        ES4[(Elasticsearch)]
        FS4[(Firestore)]
        FE4 --> BE4
        BE4 --> Gemini4
        BE4 --> ES4
        BE4 --> FS4
    end

    P1 --> P2 --> P3 --> P4
```

各 Phase の達成基準:

| Phase | 達成基準 | 必要な準備 |
|---|---|---|
| **1** | 思考プロセス UI + チャット動作確認 (ローカル) | なし |
| **2** | 本物の Gemini で動的提案 | GCP プロジェクト + Vertex AI 有効化 |
| **3** | 125 件のレシピを実検索 (BM25) | Elastic Cloud デプロイ |
| **4** | デプロイ + 認証 + データ永続化 | Firebase / Cloud Run / Secret Manager |

---

## 付録: 凡例

```mermaid
graph LR
    A[四角: コンポーネント]
    B[(円柱: データストア)]
    C{菱形: 分岐}
    D([楕円: 外部アクター])

    A -->|実線: 同期呼び出し| B
    A -.->|点線: 非同期/参照| C
```
