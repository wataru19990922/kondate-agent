import { useState } from 'react'
import { mockInventory } from '../mock/inventory'
import { mockRecipes } from '../mock/recipes'
import type { MealProposal } from '../types'

/**
 * 献立提案セクション。BE 接続後は POST /meals/propose を呼ぶ想定。
 * 今は在庫食材とレシピ食材名のオーバーラップ件数で雑にランキングしている。
 */
export function MealsSection() {
  const [proposals, setProposals] = useState<MealProposal[]>([])
  const [loading, setLoading] = useState(false)

  function generateProposals() {
    setLoading(true)
    // BE 接続前のモック: 在庫食材とレシピ食材のオーバーラップでスコア
    const inventoryNames = new Set(mockInventory.map((i) => i.ingredient))
    const ranked = mockRecipes
      .map((recipe) => {
        const used = recipe.recipeMaterial.filter((m) =>
          Array.from(inventoryNames).some((inv) => m.includes(inv) || inv.includes(m))
        )
        return { recipe, matchCount: used.length, used }
      })
      .filter((r) => r.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 3)

    // ダミーの分量・栄養 (将来は Gemini で動的算出)
    const mockProposals: MealProposal[] = ranked.map((r) => ({
      recipe: r.recipe,
      ingredientsUsed: r.used.map((ing) => ({ ingredient: ing, quantity: 1, unit: '適量' })),
      nutrition: { proteinG: 18, fatG: 12, carbG: 25, kcal: 280 },
      rationale: `在庫の食材が ${r.matchCount} 個マッチしました (デモ用ダミー判定)`,
    }))

    setTimeout(() => {
      setProposals(mockProposals)
      setLoading(false)
    }, 600)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">今日の献立を提案</h2>
        <button
          onClick={generateProposals}
          disabled={loading}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? '考え中...' : '献立を提案'}
        </button>
      </div>

      {proposals.length === 0 && !loading && (
        <p className="text-sm text-gray-500">
          ボタンを押すと、在庫から作れる候補が表示されます。
        </p>
      )}

      <ul className="space-y-3">
        {proposals.map((p) => (
          <li
            key={p.recipe.recipeId}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <div className="flex gap-4 p-4">
              {p.recipe.foodImageUrl && (
                <img
                  src={p.recipe.foodImageUrl}
                  alt=""
                  className="h-24 w-24 flex-none rounded-md object-cover"
                />
              )}
              <div className="flex-1 space-y-1">
                <a
                  href={p.recipe.recipeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-medium text-gray-900 hover:text-emerald-700"
                >
                  {p.recipe.recipeTitle}
                </a>
                <p className="text-xs text-gray-500">
                  {p.recipe.recipeIndication} / {p.recipe.recipeCost}
                </p>
                <p className="text-xs text-emerald-700">{p.rationale}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {p.recipe.recipeMaterial.map((m) => (
                    <span
                      key={m}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div className="pt-2 text-xs text-gray-600">
                  栄養 (1 人分・推定): タンパク質 {p.nutrition.proteinG}g / 脂質{' '}
                  {p.nutrition.fatG}g / 炭水化物 {p.nutrition.carbG}g /{' '}
                  {p.nutrition.kcal}kcal
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        モック実装です。BE 接続後は <code>POST /meals/propose</code> 経由で ADK
        エージェントが家族構成・在庫量を考慮して動的に提案を生成します。
      </div>
    </div>
  )
}
