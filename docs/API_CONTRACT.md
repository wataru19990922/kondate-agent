# API_CONTRACT.md

BE ↔ FE 間の API 契約。エージェントのツールシグネチャ、SSE イベント仕様、セッション管理を確定させる。

参照:
- アーキテクチャ: [AGENT_DESIGN.md](./AGENT_DESIGN.md)
- 会話例: [AGENT_SCENARIOS.md](./AGENT_SCENARIOS.md)

---

## 1. エンドポイント一覧

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/meals/chat` | 献立提案 (SSE ストリーミング) |
| GET | `/inventory` | 在庫一覧取得 |
| POST | `/inventory` | 在庫追加 |
| DELETE | `/inventory/{item_id}` | 在庫削除 |
| POST | `/inventory/decrement` | 採用に伴う在庫減算 |
| GET | `/meals/history?days=7` | 食事履歴 |
| POST | `/meals/accept` | 献立採用 (履歴に記録 + 在庫減) |
| POST | `/receipts/parse` | レシート画像解析 (Gemini Vision) |
| GET | `/healthz` | ヘルスチェック |

このドキュメントは主に `POST /meals/chat` の **SSE 仕様** と、エージェントが内部で呼ぶ **ツールシグネチャ** を扱う。
他のエンドポイントは OpenAPI で自動生成する想定。

---

## 2. POST /meals/chat (SSE)

### リクエスト

```http
POST /meals/chat
Content-Type: application/json
Authorization: Bearer <firebase_id_token>

{
  "session_id": "sess_abc123",
  "message": "今夜何食べる?",
  "household_size": 2
}
```

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `session_id` | string | ✓ | 会話セッション ID (FE 側で生成・保持) |
| `message` | string | ✓ | ユーザ発話 |
| `household_size` | int | ✓ | 人数 (毎回送信。プロファイル上書き) |

認証:
- `Authorization: Bearer <firebase_id_token>`
- Phase 1 (mock) では認証スキップ可。Phase 4 で必須化

### レスポンス: SSE (Server-Sent Events)

`Content-Type: text/event-stream`

イベント例:

```
event: thinking
data: {"agent":"Coordinator","status":"start","message":"考えています..."}

event: thinking
data: {"agent":"HistoryAnalyst","status":"start","message":"直近 7 日の食事傾向を確認中..."}

event: thinking
data: {"agent":"HistoryAnalyst","status":"done","insight":"肉系が 5/6 日続いてます","duration_ms":420}

event: thinking
data: {"agent":"RecipeFinder","status":"start","message":"魚系で 15 分以内のレシピを探索中..."}

event: thinking
data: {"agent":"RecipeFinder","status":"done","insight":"4 件発見","duration_ms":280}

event: thinking
data: {"agent":"NutritionAnalyst","status":"start","message":"候補 3 件の栄養を評価中..."}

event: thinking
data: {"agent":"NutritionAnalyst","status":"done","insight":"タンパク質バランス評価完了","duration_ms":650}

event: message
data: {
  "id":"msg_xyz789",
  "role":"assistant",
  "text":"今週お肉が続いてたので魚系で。タンパク質も補えます。",
  "proposals":[
    {"recipe_id":"...", "recipe_title":"...", ...},
    ...
  ],
  "reasoning_summary":["肉系 5/6 日 → 魚提案","タンパク質目標未達 → 高P候補優先"]
}

event: done
data: {"total_duration_ms":1620, "tokens_used":1840}
```

#### 3 種類のイベント

| event | 用途 | data フィールド |
|---|---|---|
| `thinking` | 思考プロセスの実況 (UI で「Agent が判断中...」表示) | `agent`, `status`, `message`, `insight?`, `duration_ms?` |
| `message` | 最終応答 (テキスト + レシピ提案) | `id`, `role`, `text`, `proposals?`, `reasoning_summary?` |
| `done` | ストリーム終了マーカー | `total_duration_ms`, `tokens_used?` |

#### thinking イベントの詳細

```typescript
type ThinkingEvent = {
  agent: 'Coordinator' | 'RecipeFinder' | 'NutritionAnalyst' | 'HistoryAnalyst'
  status: 'start' | 'done' | 'error'
  message: string         // 「魚系で 15 分以内のレシピを探索中...」
  insight?: string        // status=done のとき。判断結果サマリ
  duration_ms?: number    // status=done のとき
  error?: string          // status=error のとき
}
```

`message` フィールドはユーザに見せる前提で書く (動詞 + 目的語で短く)。

#### message イベントの詳細

```typescript
type AssistantMessageEvent = {
  id: string                  // メッセージ ID (採用ボタン押下時に参照)
  role: 'assistant'
  text: string                // メイン応答テキスト
  proposals?: MealProposal[]  // 候補レシピ (なくても OK)
  reasoning_summary?: string[] // 「肉系 5/6 日 → 魚提案」のような判断連鎖
}

type MealProposal = {
  recipe_id: string
  recipe_title: string
  recipe_url: string
  food_image_url: string
  recipe_indication: string        // "約10分"
  recipe_cost: string              // "100円以下"
  ingredient_match: {
    available: string[]            // 在庫にある食材名
    missing: string[]              // 不足食材名
  }
  estimated_nutrition: {           // 全員分 (世帯人数で乗算済み)
    protein_g: number
    fat_g: number
    carb_g: number
    kcal: number
  }
  rationale: string                // この候補を選んだ理由 1 文
}
```

#### エラー時

```
event: error
data: {"code":"AGENT_TIMEOUT","message":"応答生成がタイムアウトしました"}
```

エラーコード一覧:

| code | 意味 |
|---|---|
| `AGENT_TIMEOUT` | 30 秒以内に応答が出なかった |
| `LLM_RATE_LIMITED` | Vertex AI クォータ超過 |
| `INVALID_SESSION` | session_id がサーバ側に存在しない |
| `INTERNAL` | その他 |

---

## 3. ツールシグネチャ (Python / BE 内部)

各サブエージェントが使うツール関数の型と振る舞いを確定させる。
ADK では `@FunctionTool` デコレータで関数を直接エージェントに渡せる想定。

### 3-1. Inventory ツール (直接 Firestore)

```python
def get_inventory_summary(user_id: str) -> InventorySummary:
    """ユーザの在庫を要約形式で返す。"""

class InventorySummary(TypedDict):
    items: list[InventoryItem]
    total_count: int
    by_category: dict[Category, list[InventoryItem]]  # 例 {"meat_fish": [...]}
    expiring_soon: list[InventoryItem]                # 期限 2 日以内
    last_updated: str  # ISO datetime


class InventoryItem(TypedDict):
    item_id: str
    ingredient: str
    quantity: float
    unit: str
    category: Category
    expires_at: str | None
    source: Literal["receipt", "manual"]


Category = Literal[
    "meat_fish", "vegetable", "dairy_egg", "staple",
    "processed", "seasoning", "dry_goods", "other"
]
```

### 3-2. HistoryAnalyst (サブエージェント or 純関数)

最終的にはサブエージェントとして実装するが、内部は次のツールを利用:

```python
def get_meal_history(user_id: str, days: int = 7) -> list[MealRecord]:
    """過去 N 日分の採用済み献立を返す。"""

class MealRecord(TypedDict):
    meal_id: str
    date: str
    recipe_id: str
    recipe_title: str
    household_size: int
    nutrition_per_person: NutritionInfo


def aggregate_history(
    meals: list[MealRecord], days: int
) -> HistoryInsight:
    """履歴を集計して傾向を出す。LLM 不要の純関数。"""

class HistoryInsight(TypedDict):
    # サマリ統計
    days_with_meal: int
    avg_protein_per_day: float
    total_protein: float
    protein_target_per_day: float
    protein_deficit: float          # 目標との差分 (負なら未達)

    # カテゴリ傾向
    category_distribution: dict[str, int]
    # 例 {"meat": 5, "fish": 1, "vegetarian": 0}

    # 補正提案 (HistoryAnalyst のサブエージェントが付与)
    recent_pattern: str             # "肉中心 (5/6 日)"
    suggest_balance: str | None     # "fish" / "vegetable" / null
    underused_ingredients: list[str]  # ["長ナス", "木綿豆腐"]
```

### 3-3. RecipeFinder (サブエージェント)

```python
def es_search(
    query: str,
    filters: SearchFilters | None = None,
    k: int = 20,
) -> list[RecipeCandidate]:
    """Elasticsearch BM25 + kNN ハイブリッド検索。
    Phase 1 では mock recipes 125 件をローカルで検索。"""

class SearchFilters(TypedDict, total=False):
    exclude_ingredients: list[str]   # ["魚", "鮭"]
    include_ingredients: list[str]   # ["長ナス"]
    max_cooking_minutes: int         # 30
    categories: list[str]            # ["和食"]
    in_stock_only: bool              # true なら 100% 在庫充足のみ

class RecipeCandidate(TypedDict):
    recipe_id: str
    recipe_title: str
    recipe_description: str
    recipe_material: list[str]
    recipe_indication: str
    recipe_cost: str
    food_image_url: str
    recipe_url: str
    bm25_score: float
    knn_score: float | None  # Phase 2 で kNN 有効化


def match_inventory(
    recipes: list[RecipeCandidate],
    inventory: list[InventoryItem],
) -> list[RecipeWithMatch]:
    """各レシピの在庫充足率を計算。LLM 不要の純関数。"""

class RecipeWithMatch(TypedDict):
    recipe: RecipeCandidate
    matched_count: int
    total_count: int
    match_rate: float       # 0.0 ~ 1.0
    matched_materials: list[str]
    missing_materials: list[str]
```

### 3-4. NutritionAnalyst (サブエージェント)

```python
def estimate_nutrition(
    recipe: RecipeCandidate,
    household_size: int,
) -> NutritionEstimate:
    """Gemini で 1 食分の栄養を推定する。
    Phase 1 mock では「肉系なら高 P、野菜系なら低 P」程度の簡易推定。"""

class NutritionEstimate(TypedDict):
    per_person: NutritionInfo
    total_for_household: NutritionInfo
    confidence: float       # 0.0 ~ 1.0 (推定信頼度)

class NutritionInfo(TypedDict):
    protein_g: float
    fat_g: float
    carb_g: float
    kcal: float


def get_nutrition_targets(user_id: str) -> NutritionTargets:
    """ユーザの栄養目標値を取得。Firestore から。"""

class NutritionTargets(TypedDict):
    protein_per_day_g: float    # 60
    kcal_per_day: float         # 2000
    # 他は MVP では扱わない


def compare_to_target(
    estimate: NutritionEstimate,
    target: NutritionTargets,
    history_insight: HistoryInsight,
) -> NutritionAssessment:
    """推定栄養と目標・履歴を比較し評価コメントを返す。"""

class NutritionAssessment(TypedDict):
    rating: Literal["excellent", "good", "acceptable", "poor"]
    protein_contribution_pct: float   # 例 47 (= +47%)
    comment: str                      # "タンパク質目標達成に貢献"
    flags: list[str]                  # ["high_protein", "low_calorie"]
```

### 3-5. Coordinator (メインエージェント)

Coordinator 自体は ADK の `LlmAgent` として動き、上記のサブエージェントを **ツール** として持つ。

```python
from google.adk.agents import LlmAgent, FunctionTool

coordinator = LlmAgent(
    name="KondateCoordinator",
    model="gemini-2.5-flash",
    instruction=COORDINATOR_PROMPT,  # AGENT_SCENARIOS.md のシステムプロンプト草稿
    tools=[
        FunctionTool(get_inventory_summary),
        FunctionTool(get_user_profile),
        recipe_finder_agent,            # サブエージェントを tool として登録
        nutrition_analyst_agent,
        history_analyst_agent,
    ],
)
```

Coordinator の出力は **JSON モード** で構造化:

```python
class CoordinatorOutput(TypedDict):
    text: str                     # 応答テキスト
    proposals: list[MealProposal] # 候補 (なくても OK)
    reasoning_summary: list[str]  # 判断の連鎖
```

---

## 4. セッション管理

### 4-1. session_id の生成と寿命

- FE 側で UUID v4 生成 (`crypto.randomUUID()`)
- 初回 `/meals/chat` 時にサーバ側に作成される
- 24 時間 idle で自動破棄
- 「会話リセット」ボタンで新 session_id を発番

### 4-2. サーバ側保存内容 (Firestore)

```
chat_sessions/{session_id}
  user_id: string
  created_at: timestamp
  updated_at: timestamp
  messages: [
    { role: "user" | "assistant", text: string, timestamp, proposals?: [...] }
  ]
  context: {
    household_size: number
    last_inventory_snapshot: [...]  # 直近の在庫スナップショット
  }
```

Phase 1 (mock) では in-memory dict で代用。

### 4-3. 会話コンテキストの渡し方

Coordinator には毎回:
- 直近 8 ターン (user + assistant)
- 最新の在庫サマリ
- ユーザプロファイル

を渡す。長い履歴は **要約** して `context_summary` として渡す (Gemini で別途要約)。

---

## 5. FE 側の SSE 受信実装方針

```typescript
type ThinkingState = {
  agent: string
  status: 'running' | 'done'
  message: string
  insight?: string
  duration_ms?: number
}

async function streamChat(message: string): Promise<void> {
  const res = await fetch('/meals/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message, household_size }),
  })
  if (!res.body) throw new Error('No stream')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE フォーマットをパース (event: ... \n data: ... \n\n の繰り返し)
    const events = parseSSE(buffer)
    for (const evt of events) {
      handleEvent(evt)
    }
  }
}
```

UI 側では:
- `thinking` イベントを順に「思考プロセス」リストに積む
- `message` イベントでチャットバブルを表示
- `done` イベントで「思考プロセス」を折りたたみ可能にする

---

## 6. Phase 1 (mock) で動かす範囲

| 機能 | Phase 1 で実装するか |
|---|---|
| POST /meals/chat (SSE) | ✓ 実装 |
| 3 サブエージェントの mock 実装 | ✓ 実装 (キーワードベース) |
| Coordinator の mock 実装 | ✓ 実装 |
| ツールシグネチャ (純関数部分) | ✓ 実装 |
| Firestore (在庫・履歴) | ✗ in-memory で代用 |
| Vertex AI (本物 Gemini) | ✗ mock 応答 |
| Elastic Cloud | ✗ ローカル recipes.json で検索 |
| Firebase Auth | ✗ user_id は固定値 |

これで **エンドツーエンドの動作** + **思考プロセス UI** が動く状態にする。
Phase 2 以降で各 mock を本物に差し替えていく。

---

## 7. オープン課題

実装に入る前に決めたい:

- [ ] 「会話履歴の要約」は別 LLM 呼び出しにする? それとも単純な truncate?
- [ ] エラー時の FE 表示 (リトライ UI、エラーメッセージのトーン)
- [ ] SSE のタイムアウト: 全体 30 秒で OK?
- [ ] `proposals` 0 件のとき (在庫不足等) の UI 表示

これらは Phase 1 実装中に決まる想定。
