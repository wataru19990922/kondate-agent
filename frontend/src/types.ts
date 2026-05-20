// BE (FastAPI) のレスポンス型に対応する TypeScript 型定義。
// /openapi.json から自動生成する仕組みは後で導入予定。今は手動で同期する。

export type InventoryItem = {
  id: string
  ingredient: string
  quantity: number
  unit: string
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
