import type { Dispatch, SetStateAction } from 'react'
import { formatMonthDay, formatWeekdayNarrow } from '../lib/format'
import { useToast } from '../lib/toast'
import { mockRecipes } from '../mock/recipes'
import type { AcceptedMeal, InventoryItem, PlannedMeal, ShoppingItem } from '../types'

type Tab = 'meals' | 'inventory' | 'shopping' | 'receipt' | 'nutrition'

type Props = {
  mealHistory: AcceptedMeal[]
  inventory: InventoryItem[]
  householdSize: number
  setPlannedMeals: Dispatch<SetStateAction<PlannedMeal[]>>
  shoppingList: ShoppingItem[]
  setShoppingList: Dispatch<SetStateAction<ShoppingItem[]>>
  onNavigate: (tab: Tab) => void
}

function ingredientMatches(material: string, inventoryName: string): boolean {
  return material.includes(inventoryName) || inventoryName.includes(material)
}

const PROTEIN_DAILY_TARGET_G = 60

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function NutritionSection({
  mealHistory,
  inventory,
  householdSize,
  setPlannedMeals,
  shoppingList,
  setShoppingList,
  onNavigate,
}: Props) {
  const { notify } = useToast()

  function recook(meal: AcceptedMeal) {
    const recipe = mockRecipes.find((r) => r.recipeId === meal.recipeId)
    if (!recipe) {
      notify({ message: 'レシピが見つかりませんでした' })
      return
    }
    const matched = recipe.recipeMaterial.map((m) => ({
      material: m,
      hit: inventory.find((i) => ingredientMatches(m, i.ingredient)),
    }))
    const missing = matched.filter((m) => !m.hit).map((m) => m.material)

    if (missing.length === 0) {
      const planned: PlannedMeal = {
        id: `plan-${Date.now()}`,
        plannedAt: new Date().toISOString(),
        recipeId: meal.recipeId,
        recipeTitle: meal.recipeTitle,
        recipeUrl: meal.recipeUrl,
        foodImageUrl: meal.foodImageUrl,
        householdSize,
        ingredientsUsed: matched
          .filter((m) => m.hit)
          .map((m) => ({ ingredient: m.hit!.ingredient, quantity: 1, unit: '適量' })),
        nutritionPerPerson: meal.nutritionPerPerson,
      }
      setPlannedMeals((prev) => [...prev, planned])
      notify({
        message: `「${meal.recipeTitle}」を今夜の予定にしました`,
        action: { label: '見る', onClick: () => onNavigate('meals') },
      })
    } else {
      const existing = new Set(shoppingList.map((s) => s.ingredient))
      const toAdd = missing.filter((m) => !existing.has(m))
      const newItems: ShoppingItem[] = toAdd.map((ingredient, idx) => ({
        id: `s-${Date.now()}-${idx}`,
        ingredient,
        source: 'recipe',
        fromRecipeTitle: meal.recipeTitle,
        checked: false,
        addedAt: new Date().toISOString(),
      }))
      setShoppingList((prev) => [...prev, ...newItems])
      notify({
        message:
          toAdd.length > 0
            ? `不足 ${toAdd.length} 件を買い物リストへ`
            : 'すでに買い物リストに入っています',
        action:
          toAdd.length > 0
            ? { label: '見る', onClick: () => onNavigate('shopping') }
            : undefined,
      })
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))

  const dailyTotals = days.map((date) => {
    const meals = mealHistory.filter((m) => m.date === date)
    const protein = meals.reduce(
      (sum, m) => sum + m.nutritionPerPerson.proteinG,
      0
    )
    const fat = meals.reduce((sum, m) => sum + m.nutritionPerPerson.fatG, 0)
    const carb = meals.reduce((sum, m) => sum + m.nutritionPerPerson.carbG, 0)
    const kcal = meals.reduce((sum, m) => sum + m.nutritionPerPerson.kcal, 0)
    return { date, protein, fat, carb, kcal, count: meals.length }
  })

  const maxProtein = Math.max(
    PROTEIN_DAILY_TARGET_G,
    ...dailyTotals.map((d) => d.protein)
  )

  const weeklyProtein = dailyTotals.reduce((sum, d) => sum + d.protein, 0)
  const avgProtein = Math.round(weeklyProtein / 7)
  const todayTotal = dailyTotals[dailyTotals.length - 1]
  const today = days[days.length - 1]
  const todayProgress = Math.min(100, (todayTotal.protein / PROTEIN_DAILY_TARGET_G) * 100)

  const sortedHistory = [...mealHistory].sort((a, b) => (a.date < b.date ? 1 : -1))

  // 月次サマリー: 今月分の集計
  const now = new Date()
  const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthMeals = mealHistory.filter((m) => m.date.startsWith(currentMonthPrefix))
  const monthCount = thisMonthMeals.length
  const monthAvg = monthCount > 0
    ? {
        proteinG: Math.round(
          thisMonthMeals.reduce((s, m) => s + m.nutritionPerPerson.proteinG, 0) / monthCount
        ),
        fatG: Math.round(
          thisMonthMeals.reduce((s, m) => s + m.nutritionPerPerson.fatG, 0) / monthCount
        ),
        carbG: Math.round(
          thisMonthMeals.reduce((s, m) => s + m.nutritionPerPerson.carbG, 0) / monthCount
        ),
        kcal: Math.round(
          thisMonthMeals.reduce((s, m) => s + m.nutritionPerPerson.kcal, 0) / monthCount
        ),
      }
    : { proteinG: 0, fatG: 0, carbG: 0, kcal: 0 }
  // 頻出レシピ TOP3
  const recipeCounts = new Map<string, { title: string; count: number; foodImageUrl: string }>()
  for (const m of thisMonthMeals) {
    const existing = recipeCounts.get(m.recipeId)
    if (existing) existing.count += 1
    else recipeCounts.set(m.recipeId, { title: m.recipeTitle, count: 1, foodImageUrl: m.foodImageUrl })
  }
  const topRecipes = Array.from(recipeCounts.values())
    .filter((r) => r.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  const monthLabel = `${now.getMonth() + 1}月`

  return (
    <div className="space-y-6">
      <section className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow-caps">Nutrition</div>
          <h1 className="mt-1.5 text-2xl font-semibold text-balance text-[var(--color-ink)]">
            この 7 日の栄養
          </h1>
        </div>
        <time
          dateTime={today}
          className="text-xs tabular-nums text-[var(--color-ink-soft)]"
        >
          {formatMonthDay(today)}
        </time>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-5 shadow-sm">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow-caps">今日のタンパク質</span>
            <span className="text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
              目標 {PROTEIN_DAILY_TARGET_G}g
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-5xl font-semibold leading-none tabular-nums text-[var(--color-leaf)]">
              {todayTotal.protein}
            </span>
            <span className="text-lg font-medium text-[var(--color-leaf)]/70">g</span>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-leaf-soft)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-leaf)]">
              {Math.round(todayProgress)}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={todayTotal.protein}
            aria-valuemin={0}
            aria-valuemax={PROTEIN_DAILY_TARGET_G}
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-soft)]"
          >
            <div
              className="h-full rounded-full bg-[var(--color-leaf)] transition-[width] duration-150 ease-out"
              style={{ width: `${todayProgress}%` }}
            />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--color-line-soft)] pt-4">
            <Stat label="脂質" value={todayTotal.fat} unit="g" color="var(--color-saffron)" />
            <Stat label="炭水化物" value={todayTotal.carb} unit="g" color="var(--color-sky)" />
            <Stat label="エネルギー" value={todayTotal.kcal} unit="kcal" color="var(--color-tomato)" />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-5 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="eyebrow-caps">タンパク質 · 7日</span>
            <span className="text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
              平均 {avgProtein}g/日
            </span>
          </div>
          <ul className="space-y-2">
            {dailyTotals.map((d) => {
              const widthPct = maxProtein > 0 ? (d.protein / maxProtein) * 100 : 0
              const targetPct =
                maxProtein > 0 ? (PROTEIN_DAILY_TARGET_G / maxProtein) * 100 : 0
              const isToday = d.date === today
              const metTarget = d.protein >= PROTEIN_DAILY_TARGET_G
              return (
                <li key={d.date} className="flex items-center gap-3">
                  <span
                    className={`w-5 text-center text-xs font-medium tabular-nums ${
                      isToday ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-mute)]'
                    }`}
                  >
                    {formatWeekdayNarrow(d.date)}
                  </span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-soft)]">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${
                        metTarget ? 'bg-[var(--color-leaf)]' : 'bg-[var(--color-ink-mute)]'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                    <div
                      className="absolute inset-y-[-2px] w-px bg-[var(--color-ink-mute)]/60"
                      style={{ left: `${targetPct}%` }}
                    />
                  </div>
                  <span
                    className={`w-12 text-right text-xs tabular-nums ${
                      metTarget ? 'font-semibold text-[var(--color-leaf)]' : 'text-[var(--color-ink-soft)]'
                    }`}
                  >
                    {d.protein}g
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-[var(--color-ink-mute)]">
            細線が目標 ({PROTEIN_DAILY_TARGET_G}g)。緑が達成日。
          </p>
        </div>
      </section>

      <section
        aria-labelledby="monthly-summary"
        className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-5 shadow-sm"
      >
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow-caps">This Month</div>
            <h2
              id="monthly-summary"
              className="mt-1.5 text-base font-semibold text-[var(--color-ink)]"
            >
              {monthLabel}の振り返り
            </h2>
          </div>
          <span className="rounded-full bg-[var(--color-bg-soft)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
            {monthCount} 食
          </span>
        </div>

        {monthCount === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
            今月はまだ記録がありません。
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-4 gap-3 border-y border-[var(--color-line-soft)] py-4">
              <SummaryStat label="平均P" value={monthAvg.proteinG} unit="g" color="var(--color-leaf)" />
              <SummaryStat label="平均F" value={monthAvg.fatG} unit="g" color="var(--color-saffron)" />
              <SummaryStat label="平均C" value={monthAvg.carbG} unit="g" color="var(--color-sky)" />
              <SummaryStat label="平均kcal" value={monthAvg.kcal} unit="" color="var(--color-tomato)" />
            </div>
            {topRecipes.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow-caps mb-2">よく作ったもの</div>
                <ul className="space-y-1.5">
                  {topRecipes.map((r, idx) => (
                    <li key={r.title} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
                        {idx + 1}
                      </span>
                      {r.foodImageUrl && (
                        <img
                          src={r.foodImageUrl}
                          alt=""
                          width={32}
                          height={32}
                          loading="lazy"
                          className="size-8 shrink-0 rounded object-cover"
                        />
                      )}
                      <span className="truncate flex-1 text-sm text-[var(--color-ink)]">
                        {r.title}
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--color-bg-soft)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
                        × {r.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] shadow-sm">
        <div className="flex items-baseline justify-between border-b border-[var(--color-line-soft)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">食事の記録</h2>
          <span className="text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
            {sortedHistory.length} 食
          </span>
        </div>
        {sortedHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">まだ記録がありません</p>
            <p className="text-xs text-pretty text-[var(--color-ink-soft)]">
              「献立」タブで「これにする」を選ぶと、ここに残ります。
            </p>
          </div>
        ) : (
          <ul>
            {sortedHistory.map((m, idx) => (
              <li
                key={m.id}
                className={`group flex items-baseline justify-between gap-4 px-5 py-3 ${
                  idx > 0 ? 'border-t border-[var(--color-line-soft)]' : ''
                }`}
              >
                <div className="flex items-baseline gap-4">
                  <time
                    dateTime={m.date}
                    className="w-12 text-xs font-medium tabular-nums text-[var(--color-ink-mute)]"
                  >
                    {formatMonthDay(m.date)}
                  </time>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-ink)]">
                      {m.recipeTitle}
                    </div>
                    <div className="text-xs text-[var(--color-ink-mute)]">
                      {m.householdSize}人分
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden items-baseline gap-2.5 text-xs tabular-nums sm:flex">
                    <span className="text-[var(--color-leaf)]">
                      <span className="font-semibold">P</span> {m.nutritionPerPerson.proteinG}g
                    </span>
                    <span className="text-[var(--color-saffron)]">
                      <span className="font-semibold">F</span> {m.nutritionPerPerson.fatG}g
                    </span>
                    <span className="text-[var(--color-sky)]">
                      <span className="font-semibold">C</span> {m.nutritionPerPerson.carbG}g
                    </span>
                  </div>
                  <button
                    onClick={() => recook(m)}
                    aria-label={`${m.recipeTitle}をもう一度作る`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] transition-colors duration-150 hover:border-[var(--color-ink-mute)] hover:text-[var(--color-ink)] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <span aria-hidden="true">↻</span>
                    もう一度
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div>
      <div className="eyebrow-caps">{label}</div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="text-xl font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-[var(--color-ink-mute)]">{unit}</span>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div className="border-l-2 pl-2.5" style={{ borderColor: color }}>
      <div className="eyebrow-caps">{label}</div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="text-lg font-semibold tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-xs font-medium text-[var(--color-ink-mute)]">{unit}</span>
      </div>
    </div>
  )
}
