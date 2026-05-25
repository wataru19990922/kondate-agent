import type { InventoryItem, MealProposal, Recipe } from '../types'

function ingredientMatches(material: string, inventoryName: string): boolean {
  return material.includes(inventoryName) || inventoryName.includes(material)
}

/**
 * Recipe + 在庫 + 人数から、デフォルト UI 表示用の MealProposal を組み立てる。
 * 分量・栄養はモック値 (BE 接続後はエージェントが算出した値で置き換わる)。
 */
export function buildProposal(
  recipe: Recipe,
  inventory: InventoryItem[],
  householdSize: number
): MealProposal {
  const used = recipe.recipeMaterial
    .map((m) => {
      const hit = inventory.find((i) => ingredientMatches(m, i.ingredient))
      return hit ? { ingredient: hit.ingredient, quantity: 1, unit: '適量' } : null
    })
    .filter((x): x is { ingredient: string; quantity: number; unit: string } => !!x)

  const matchCount = used.length
  const total = recipe.recipeMaterial.length
  const missing = total - matchCount
  const rationale =
    missing === 0
      ? `在庫だけで作れます (材料 ${total} 個すべて在庫あり)`
      : `あと ${missing} 個の材料が必要です (${matchCount}/${total} 在庫あり)`

  return {
    recipe,
    ingredientsUsed: used,
    nutrition: {
      proteinG: 18 * householdSize,
      fatG: 12 * householdSize,
      carbG: 25 * householdSize,
      kcal: 280 * householdSize,
    },
    rationale,
  }
}
