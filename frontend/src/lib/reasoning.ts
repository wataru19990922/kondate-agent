import type { AcceptedMeal, InventoryItem, Recipe } from '../types'

export type ReasonTag = 'expiring' | 'protein' | 'in-stock' | 'partial'

export type Reason = {
  tag: ReasonTag
  message: string
}

const EXPIRING_THRESHOLD_DAYS = 3
const PROTEIN_GAP_TARGET = 60

function daysUntil(iso: string, today: Date): number {
  const d = new Date(iso + 'T00:00:00')
  const diff = d.getTime() - today.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function ingredientMatches(material: string, inventoryName: string): boolean {
  return material.includes(inventoryName) || inventoryName.includes(material)
}

type Context = {
  recipe: Recipe
  inventory: InventoryItem[]
  mealHistory: AcceptedMeal[]
  today?: Date
}

/**
 * レシピに対して「なぜ今これを提案するか」の理由を 1 つ選ぶ。
 * 優先度: 賞味期限切れ間近 > タンパク質不足補完 > 完全在庫 > 部分在庫。
 */
export function reasonFor({
  recipe,
  inventory,
  mealHistory,
  today = new Date(),
}: Context): Reason {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  // 1. 賞味期限が近い在庫を活用できるか
  const expiringMatched = inventory
    .filter((i) => i.expiresAt)
    .map((i) => ({ item: i, days: daysUntil(i.expiresAt!, t) }))
    .filter(({ days }) => days >= 0 && days <= EXPIRING_THRESHOLD_DAYS)
    .filter(({ item }) =>
      recipe.recipeMaterial.some((m) => ingredientMatches(m, item.ingredient))
    )
    .sort((a, b) => a.days - b.days)

  if (expiringMatched.length > 0) {
    const { item, days } = expiringMatched[0]
    const when = days === 0 ? '今日まで' : days === 1 ? '明日まで' : `あと${days}日`
    return {
      tag: 'expiring',
      message: `${when}の${item.ingredient}を使い切れます`,
    }
  }

  // 2. 直近 3 日のタンパク質が目標下回り、かつこのレシピが補えるか
  const last3 = mealHistory.filter((m) => {
    const d = new Date(m.date + 'T00:00:00')
    const diff = Math.floor((t.getTime() - d.getTime()) / 86400000)
    return diff >= 0 && diff < 3
  })
  const avgProtein =
    last3.length > 0
      ? Math.round(
          last3.reduce((s, m) => s + m.nutritionPerPerson.proteinG, 0) / last3.length
        )
      : 0
  const proteinIngredient = recipe.recipeMaterial.find((m) =>
    /肉|豚|牛|鶏|卵|豆腐|魚|鮭|サバ|マグロ|ぶり|たら|エビ/.test(m)
  )
  if (
    last3.length >= 2 &&
    avgProtein < PROTEIN_GAP_TARGET * 0.7 &&
    proteinIngredient
  ) {
    return {
      tag: 'protein',
      message: `直近のタンパク質不足を${proteinIngredient}で補えます`,
    }
  }

  // 3. 完全在庫
  const matchCount = recipe.recipeMaterial.filter((m) =>
    inventory.some((i) => ingredientMatches(m, i.ingredient))
  ).length
  const total = recipe.recipeMaterial.length
  if (matchCount === total) {
    return { tag: 'in-stock', message: '在庫だけで作れます' }
  }

  // 4. 部分在庫 (フォールバック)
  return {
    tag: 'partial',
    message: `材料 ${matchCount}/${total} が在庫にあります`,
  }
}

export function getReasonAccent(tag: ReasonTag): {
  color: string
  bg: string
  icon: string
} {
  switch (tag) {
    case 'expiring':
      return { color: 'var(--color-clay)', bg: 'var(--color-clay-soft)', icon: '🕒' }
    case 'protein':
      return { color: 'var(--color-leaf)', bg: 'var(--color-leaf-soft)', icon: '💪' }
    case 'in-stock':
      return { color: 'var(--color-leaf)', bg: 'var(--color-leaf-soft)', icon: '✓' }
    case 'partial':
      return { color: 'var(--color-ink-soft)', bg: 'var(--color-bg-soft)', icon: '·' }
  }
}
