// モック版の対話エージェント。
// ユーザ発話のキーワードからレシピを絞り、応答テキストと候補レシピを返す。
//
// BE 接続後は POST /meals/chat (ADK エージェント) で置き換える想定。
// このファイルは "エージェントがどう振る舞ってほしいか" のドラフト仕様も兼ねる。

import { mockRecipes } from './recipes'
import type { ChatMessage, InventoryItem, MealProposal, Recipe } from '../types'

function ingredientMatches(material: string, inventoryName: string): boolean {
  return material.includes(inventoryName) || inventoryName.includes(material)
}

type Ranked = {
  recipe: Recipe
  matchCount: number
  totalCount: number
  rate: number
}

function rankByInventory(inventory: InventoryItem[]): Ranked[] {
  return mockRecipes
    .map((recipe) => {
      const matched = recipe.recipeMaterial.filter((m) =>
        inventory.some((inv) => ingredientMatches(m, inv.ingredient))
      ).length
      const total = recipe.recipeMaterial.length
      return {
        recipe,
        matchCount: matched,
        totalCount: total,
        rate: total > 0 ? matched / total : 0,
      }
    })
    .filter((r) => r.matchCount > 0)
    .sort((a, b) => (b.rate !== a.rate ? b.rate - a.rate : b.matchCount - a.matchCount))
}

function toProposal(r: Ranked, inventory: InventoryItem[], householdSize: number): MealProposal {
  const used = r.recipe.recipeMaterial
    .map((m) => {
      const hit = inventory.find((i) => ingredientMatches(m, i.ingredient))
      return hit ? { ingredient: hit.ingredient, quantity: 1, unit: '適量' } : null
    })
    .filter((x): x is { ingredient: string; quantity: number; unit: string } => !!x)
  const missing = r.totalCount - r.matchCount
  const rationale =
    missing === 0
      ? `在庫だけで作れます (材料 ${r.totalCount} 個すべて在庫あり)`
      : `あと ${missing} 個の材料が必要です (${r.matchCount}/${r.totalCount} 在庫あり)`

  return {
    recipe: r.recipe,
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

/**
 * ユーザ発話に応じてアシスタントメッセージを生成する (モック)。
 */
export function generateAssistantReply(
  userText: string,
  inventory: InventoryItem[],
  householdSize: number
): ChatMessage {
  const ranked = rankByInventory(inventory)
  const t = userText.toLowerCase()

  let filtered = ranked
  let intro = '在庫から作れそうな候補を選びました。'

  if (t.match(/あっさり|さっぱり|軽め|野菜/)) {
    filtered = ranked.filter(
      (r) => !r.recipe.recipeMaterial.some((m) => /肉|豚|牛|鶏|ベーコン|ハム|ソーセージ/.test(m))
    )
    intro = 'あっさり系ですね。野菜中心の候補から選びました。'
  } else if (t.match(/がっつり|肉|スタミナ|ボリューム/)) {
    filtered = ranked.filter((r) =>
      r.recipe.recipeMaterial.some((m) => /肉|豚|牛|鶏|ベーコン|ハム/.test(m))
    )
    intro = 'がっつり系ですね。お肉を使うレシピから。'
  } else if (t.match(/\d+\s*分|時短|簡単|早く/)) {
    filtered = ranked.filter((r) =>
      /5分|10分|15分/.test(r.recipe.recipeIndication)
    )
    intro = '時短系で、15 分以内で作れそうなものから。'
  } else if (t.match(/タンパク|プロテイン|筋トレ/)) {
    filtered = ranked.filter((r) =>
      r.recipe.recipeMaterial.some((m) => /肉|豚|牛|鶏|卵|豆腐|魚/.test(m))
    )
    intro = 'タンパク質が摂れそうなレシピを優先して選びました。'
  } else if (t.match(/安く|節約|安め/)) {
    filtered = ranked.filter((r) => /100円|300円/.test(r.recipe.recipeCost))
    intro = '節約系で、コスト目安が低めのものから。'
  } else if (t.match(/別の|他の|もっと|違う/)) {
    intro = '別の候補もあります。次のグループから:'
    filtered = ranked.slice(3) // 上位 3 件はスキップ
  }

  const top = filtered.slice(0, 3)

  if (top.length === 0) {
    return {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: 'うーん、その条件にちょうど合う候補が見つかりませんでした。条件を緩めて、在庫が多く使えるものを 3 つ出しますね。',
      proposals: ranked.slice(0, 3).map((r) => toProposal(r, inventory, householdSize)),
    }
  }

  return {
    id: `a-${Date.now()}`,
    role: 'assistant',
    text: intro,
    proposals: top.map((r) => toProposal(r, inventory, householdSize)),
  }
}

export const INITIAL_GREETING: ChatMessage = {
  id: 'greeting',
  role: 'assistant',
  text: 'こんにちは！冷蔵庫の在庫から、今日の献立を一緒に考えましょう。\n何かリクエストはありますか？(例: 「あっさり系」「10分以内」「タンパク質多め」)',
}
