// BE (FastAPI) のレスポンス型に対応する TypeScript 型定義。
// /openapi.json から自動生成する仕組みは後で導入予定。今は手動で同期する。

export type IngredientCategory =
  | 'meat_fish'
  | 'vegetable'
  | 'dairy_egg'
  | 'staple'
  | 'processed'
  | 'seasoning'
  | 'dry_goods'
  | 'other'

export type InventoryItem = {
  id: string
  ingredient: string
  quantity: number
  unit: string
  category: IngredientCategory
  expiresAt?: string // ISO date
  source: 'receipt' | 'manual'
}

// レシピマスタ (Elasticsearch 投入対象) と同じ形
export type Recipe = {
  recipeId: string
  recipeTitle: string
  recipeDescription: string
  recipeMaterial: string[]
  recipeIndication: string
  recipeCost: string
  foodImageUrl: string
  recipeUrl: string
}

// 献立提案 (エージェント出力) — 候補レシピに対して動的算出された分量と栄養を含む
export type MealProposal = {
  recipe: Recipe
  ingredientsUsed: { ingredient: string; quantity: number; unit: string }[]
  nutrition: { proteinG: number; fatG: number; carbG: number; kcal: number }
  rationale: string // エージェントの選定理由 (デモ映え用)
}

// 献立提案チャットのメッセージ
export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  proposals?: MealProposal[] // assistant メッセージ内に候補レシピを埋め込む
}

// 採用した献立 (栄養トラッキング履歴)
export type AcceptedMeal = {
  id: string
  date: string // YYYY-MM-DD
  recipeId: string
  recipeTitle: string
  recipeUrl: string
  foodImageUrl: string
  householdSize: number
  // 1 人分換算の栄養 (履歴は人分で割って保存しておくと比較しやすい)
  nutritionPerPerson: { proteinG: number; fatG: number; carbG: number; kcal: number }
}

// 買い物リスト項目。レシピの不足食材を蓄積する、または手動追加。
// 将来: レシート読み取り時に名前マッチで自動チェックする想定。
export type ShoppingItem = {
  id: string
  ingredient: string
  source: 'manual' | 'recipe'
  fromRecipeTitle?: string // recipe 由来の場合の出典
  checked: boolean
  addedAt: string // ISO datetime
}

// 今夜の予定 (まだ作って食べていない、計画段階の献立)
// 食べたら decrement + AcceptedMeal に昇格する。
export type PlannedMeal = {
  id: string
  plannedAt: string // ISO datetime
  recipeId: string
  recipeTitle: string
  recipeUrl: string
  foodImageUrl: string
  householdSize: number
  ingredientsUsed: { ingredient: string; quantity: number; unit: string }[]
  nutritionPerPerson: { proteinG: number; fatG: number; carbG: number; kcal: number }
}
