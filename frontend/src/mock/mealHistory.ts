import type { AcceptedMeal } from '../types'

// 過去 6 日分のデモ用食事履歴。現在日 (起動時の today) を基準に相対日付で生成する。
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const mockMealHistory: AcceptedMeal[] = [
  {
    id: 'h-1',
    date: daysAgo(6),
    recipeId: 'demo-monday',
    recipeTitle: '鶏むね肉のチキン南蛮',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 32, fatG: 18, carbG: 22, kcal: 380 },
  },
  {
    id: 'h-2',
    date: daysAgo(5),
    recipeId: 'demo-tuesday',
    recipeTitle: '鮭のホイル焼き',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 26, fatG: 14, carbG: 12, kcal: 290 },
  },
  {
    id: 'h-3',
    date: daysAgo(4),
    recipeId: 'demo-wednesday',
    recipeTitle: '豚肉と野菜の生姜焼き',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 28, fatG: 22, carbG: 18, kcal: 410 },
  },
  {
    id: 'h-4',
    date: daysAgo(3),
    recipeId: 'demo-thursday',
    recipeTitle: '牛丼',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 35, fatG: 20, carbG: 80, kcal: 650 },
  },
  {
    id: 'h-5',
    date: daysAgo(2),
    recipeId: 'demo-friday',
    recipeTitle: '麻婆豆腐',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 22, fatG: 16, carbG: 14, kcal: 290 },
  },
  {
    id: 'h-6',
    date: daysAgo(1),
    recipeId: 'demo-saturday',
    recipeTitle: 'サラダうどん',
    recipeUrl: 'https://recipe.rakuten.co.jp/',
    foodImageUrl: '',
    householdSize: 2,
    nutritionPerPerson: { proteinG: 14, fatG: 6, carbG: 65, kcal: 380 },
  },
]
