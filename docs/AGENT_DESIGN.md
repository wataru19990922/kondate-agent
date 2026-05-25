# AGENT_DESIGN.md

献立提案エージェントの設計ドキュメント。

ハッカソン審査基準への対応:
- **エージェントが作品の中核** か (機能の一部ではない)
- **自律的な判断・タスク実行** があるか
- **AI エージェントである必然性** があるか

---

## 1. なぜ「エージェント」である必然性があるのか

献立提案を「単なる API」ではなく **マルチエージェント** で構築する理由を、想定ユースケースから逆算する。

### ユースケース: 「今夜何食べる?」
従来アプリだと:
- レシピ検索 → ユーザが食材一致を確認 → 自分で量を計算 → 自分で栄養確認 → 決定

このアプリの理想:
> ユーザ: 「今夜何食べる?」
> Agent: 「今週お肉が 4 日続いてるので、今日は魚系どうですか? 在庫の鮭で 15 分のホイル焼きが作れて、不足の今週分のタンパク質も補えます。」

ここに含まれる **5 つの自律判断**:
1. **履歴を見る** (週次の偏りに気づく)
2. **食材在庫を考慮**(作れるか判定)
3. **時間制約を推定**(平日 19:00 なら 15 分以内が嬉しい)
4. **栄養状況を補正**(今週のタンパク質不足を考慮)
5. **複数候補から「人に合うもの」を選定**(理由付きで提案)

これらを **シンプルなルールベース** や **単一の関数** で書こうとすると:
- 条件分岐が爆発する
- 「在庫足りないけど 1 品足せば作れる」など曖昧判断が苦手
- ユーザの曖昧な発話 (「軽めで」「ヘルシーに」) を解釈できない
- 履歴・在庫・栄養・嗜好の **多変数を総合判断** するのが苦手

→ **LLM ベースの自律エージェントである必然性** が立つ。

---

## 2. アーキテクチャ: 1 メイン + 3 専門サブエージェント

```
              ┌─────────────────────────────┐
   ユーザ ←→ │   KondateCoordinator (Main)  │  Gemini 2.5 Flash
              │   - 対話の主導                │
              │   - サブエージェントを呼び分け  │
              │   - 最終応答の組み立て         │
              └──────────┬──────────────────┘
                          │ as tools
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Recipe  │    │Nutrition │    │ History  │
  │  Finder  │    │ Analyst  │    │ Analyst  │
  └────┬─────┘    └────┬─────┘    └────┬─────┘
       │               │               │
       ▼               ▼               ▼
   Elastic        Gemini estimate   Firestore
   (BM25+kNN)     (PFC)             (meal logs)
       │
       ▼
   Inventory match (Firestore)
```

### なぜ「サブエージェントとして分ける」のか
1. **デモ映え**: ユーザに「いま RecipeFinder が検索中...」「いま NutritionAnalyst が判定中...」を見せられる (= 自律性の可視化)
2. **責任分離**: 各エージェントが「単一の意思決定」を担当 → デバッグしやすい
3. **再利用**: 例えば NutritionAnalyst は単独でも栄養相談 API として使える
4. **コンテキスト効率**: 全部 1 プロンプトに詰めると context が肥大化する。サブエージェントは小さい context で動ける

---

## 3. 各エージェントの責務とツール

### 3-1. KondateCoordinator (メイン)

**役割**: ユーザとの対話を主導。サブエージェントを呼び分けて応答を組み立てる。

**入力**:
- ユーザの発話 (例: 「あっさり系で」)
- 会話履歴 (直近 N ターン)
- ユーザプロファイル (人数、アレルギー、嗜好)

**ツール (= サブエージェントとしてアクセス)**:
- `find_recipes(query, filters)` → RecipeFinder を呼び出し
- `analyze_nutrition(recipes, household_size)` → NutritionAnalyst を呼び出し
- `check_meal_variety(days=7)` → HistoryAnalyst を呼び出し
- `get_user_profile()` → Firestore 直接取得 (軽量)
- `get_inventory_summary()` → Firestore 直接取得 (軽量)

**出力**:
- アシスタント返答テキスト
- (任意) 候補レシピリスト
- (任意) 「なぜこれを薦めたか」のラショナル

**システムプロンプト方針**:
> あなたは家庭の献立提案エージェントです。ユーザの曖昧な要望から、在庫・栄養・直近の食事傾向を総合判断して、最適な献立を 1〜3 提案します。
> 候補を選ぶ前に、必ず HistoryAnalyst で直近の偏りを確認し、必要に応じて栄養補正を意識した提案にしてください。
> 在庫だけで完結できる候補を優先し、不足食材は明示してください。

---

### 3-2. RecipeFinder (サブエージェント)

**役割**: ユーザの欲求 (自然言語) を解釈し、Elasticsearch から候補レシピを引き出す。

**判断要素**:
- ユーザの言葉から「食材」「調理時間」「カテゴリ」「気分」を抽出
- BM25 vs kNN のクエリ生成
- 在庫マッチングでフィルタ
- 在庫充足率で並び替え

**ツール**:
- `es_search(query, k=20)` — BM25 + kNN ハイブリッド検索
- `match_inventory(recipes, inventory)` — 各レシピの食材充足率を計算

**出力**: ランキング済み候補レシピ (最大 5 件) + 充足率

---

### 3-3. NutritionAnalyst (サブエージェント)

**役割**: 候補レシピ + 人数から栄養を推定し、不足栄養素を指摘する。

**判断要素**:
- 食材名から PFC・kcal を推定 (Gemini に「家庭用の標準的な分量で」と問う)
- 人数でスケール
- ユーザの目標値 (1 日 60g タンパク質等) と比較
- 候補レシピ間で「最も栄養バランスが良いもの」を選ぶ

**ツール**:
- `estimate_nutrition(recipe, household_size)` — Gemini で 1 食分の栄養を推定
- `get_nutrition_targets(user_profile)` — Firestore からユーザの目標値取得
- `compare_to_target(estimate, target)` — 不足/過剰を判定

**出力**: 各候補の栄養 + 評価コメント ("タンパク質が今週の目標達成に貢献")

---

### 3-4. HistoryAnalyst (サブエージェント)

**役割**: 直近 N 日の食事履歴を分析し、「偏り」や「ヘルシーな提案の方向性」を導出。

**判断要素**:
- 過去 7 日のメニュー傾向 (肉魚比率、調理ジャンル、平均タンパク質)
- 在庫の中で「賞味期限が近いもの」「最近使っていない食材」
- 補正提案 ("魚を 3 日食べていない", "野菜が偏ってる")

**ツール**:
- `get_meal_history(days=7)` — Firestore からメニュー履歴
- `aggregate_nutrition(meals)` — 期間内合計
- `find_underused_inventory(inventory, history)` — 「最近使ってないけど在庫にある食材」

**出力**: 構造化インサイト (例: `{"recent_pattern": "肉中心", "suggest_balance": "fish", "expiring_soon": ["長ナス"]}`)

---

## 4. 自律性が「見える」UI 設計

審査員に "agent thinking" を見せるための工夫。

### サーバ → クライアント間は SSE (Server-Sent Events) でストリーミング

各サブエージェントの呼び出しをイベントとしてフロントに送る:

```
event: thinking
data: {"agent": "HistoryAnalyst", "status": "running", "message": "直近 7 日の食事傾向を確認中..."}

event: thinking
data: {"agent": "HistoryAnalyst", "status": "done", "insight": "今週肉系が 5 日続いてます"}

event: thinking
data: {"agent": "RecipeFinder", "status": "running", "message": "魚系で 15 分以内のレシピを探索中..."}

event: thinking
data: {"agent": "RecipeFinder", "status": "done", "found": 4}

event: thinking
data: {"agent": "NutritionAnalyst", "status": "running", "message": "候補 4 件の栄養バランスを評価中..."}

event: thinking
data: {"agent": "NutritionAnalyst", "status": "done"}

event: message
data: {"text": "今週お肉が多かったので魚系を提案します...", "proposals": [...]}
```

FE では「思考プロセス」を折りたたみ表示:

```
┌─ Agent の判断プロセス ─────────────────────┐
│ ✓ HistoryAnalyst   今週肉系が 5 日続いてます  │
│ ✓ RecipeFinder     魚系候補 4 件発見          │
│ ✓ NutritionAnalyst タンパク質バランス評価済   │
└──────────────────────────────────────────┘
今週お肉が多かったので魚系を提案します。
[レシピカード × 3]
```

これが **「自律的な判断・タスク実行」の可視化** になる。

---

## 5. データの流れ (1 リクエストの例)

```
[1] FE: POST /meals/chat
    { "session_id": "...", "message": "あっさり系で" }

[2] BE: KondateCoordinator.run(message, session)
    
[3] Coordinator がツールを呼び分け:
    (a) get_inventory_summary()
        → {"chicken": 300g, "tomato": 2, ...}
    
    (b) check_meal_variety(days=7)
        → HistoryAnalyst が直近を分析
        → "肉中心、魚 0 日"
    
    (c) find_recipes(query="あっさり系 野菜中心 魚を含む")
        → RecipeFinder が ES 検索
        → 5 件候補
    
    (d) analyze_nutrition(top_3, household_size=2)
        → NutritionAnalyst が PFC 推定
        → 「候補 A はタンパク質 32g/人 で目標達成」
    
    (e) Coordinator がこれらを統合して応答生成

[4] FE: SSE で逐次表示
    思考過程 + 最終応答
```

---

## 6. 段階的実装計画

GCP セットアップが未完なので、段階的に進める。

### Phase 1 (GCP 不要): エージェント骨格を mock LLM で作る
- ADK のサブエージェント定義
- ツール関数の interface 定義
- mock LLM (キーワードベースで応答返す) で動作する状態
- POST /meals/chat (SSE) で FE と結線
- FE: 思考プロセス UI 追加

### Phase 2 (GCP セットアップ後): 本物の Gemini に差し替え
- mock LLM → Vertex AI Gemini 2.5 Flash
- ADK の LlmAgent 設定
- プロンプトチューニング

### Phase 3 (Elastic Cloud 接続後): RecipeFinder を本物の ES に
- 現在 mock recipes 125 件
- Elasticsearch に投入 → BM25 + kNN

### Phase 4: HistoryAnalyst を Firestore に
- 食事履歴を実 DB へ
- 嗜好・アレルギーも Firestore

---

## 7. 評価軸へのマッピング

| 審査軸 | 本設計の対応 |
|---|---|
| **エージェントが中核か** | 単なる検索 API ではなく、4 エージェントの協調がプロダクトの本体。各エージェントなしには動かない |
| **自律的な判断** | Coordinator がどのツールを呼ぶかを LLM が動的に決定。HistoryAnalyst が「偏り」を自律的に発見 |
| **タスク実行** | 検索 / 栄養計算 / 履歴分析 を能動的に実行。ユーザは指示せずとも栄養補正が走る |
| **必然性** | 「在庫 × 栄養 × 履歴 × 曖昧な発話」の総合判断はルールベースでは書けない。LLM である必然性が明確 |
| **デモ映え** | SSE で「思考プロセス」をリアルタイム表示。判断の連鎖がユーザに見える |
