import { useState, useMemo, useId } from 'react'
import type { Dispatch, SetStateAction, FormEvent } from 'react'
import type {
  AcceptedMeal,
  ChatMessage,
  InventoryItem,
  MealProposal,
  PlannedMeal,
  ShoppingItem,
} from '../types'
import { generateAssistantReply } from '../mock/replyAgent'
import { mockRecipes } from '../mock/recipes'
import { useToast } from '../lib/toast'
import { reasonFor, getReasonAccent } from '../lib/reasoning'
import { buildProposal } from '../lib/buildProposal'

type Props = {
  inventory: InventoryItem[]
  setInventory: Dispatch<SetStateAction<InventoryItem[]>>
  householdSize: number
  setHouseholdSize: Dispatch<SetStateAction<number>>
  mealHistory: AcceptedMeal[]
  setMealHistory: Dispatch<SetStateAction<AcceptedMeal[]>>
  plannedMeals: PlannedMeal[]
  setPlannedMeals: Dispatch<SetStateAction<PlannedMeal[]>>
  shoppingList: ShoppingItem[]
  setShoppingList: Dispatch<SetStateAction<ShoppingItem[]>>
}

const MOODS: { label: string; sub: string }[] = [
  { label: 'あっさり系', sub: '野菜中心' },
  { label: 'がっつり', sub: '肉メイン' },
  { label: '10分以内', sub: '時短' },
  { label: 'タンパク質多め', sub: '体づくり' },
]

export function MealsSection({
  inventory,
  setInventory,
  householdSize,
  setHouseholdSize,
  mealHistory,
  setMealHistory,
  plannedMeals,
  setPlannedMeals,
  shoppingList,
  setShoppingList,
}: Props) {
  const { notify } = useToast()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState<ChatMessage | null>(null)
  const [activeMood, setActiveMood] = useState<string | null>(null)

  const plannedRecipeIds = useMemo(
    () => new Set(plannedMeals.map((p) => p.recipeId)),
    [plannedMeals]
  )

  const featured = useMemo(() => {
    return mockRecipes
      .map((r) => {
        const matched = r.recipeMaterial.filter((m) =>
          inventory.some((i) => m.includes(i.ingredient) || i.ingredient.includes(m))
        ).length
        return { recipe: r, matched, total: r.recipeMaterial.length }
      })
      .filter((r) => r.matched > 0)
      .sort((a, b) => b.matched / b.total - a.matched / a.total)
      .slice(0, 6)
      .map((f) => buildProposal(f.recipe, inventory, householdSize))
  }, [inventory, householdSize])

  function submitQuery(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setActiveMood(trimmed)
    setInput('')
    setTimeout(() => {
      const r = generateAssistantReply(trimmed, inventory, householdSize)
      setReply(r)
      setLoading(false)
    }, 600)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    submitQuery(input)
  }

  function clearReply() {
    setReply(null)
    setActiveMood(null)
  }

  function planProposal(proposal: MealProposal) {
    if (plannedRecipeIds.has(proposal.recipe.recipeId)) return
    const planned: PlannedMeal = {
      id: `plan-${Date.now()}`,
      plannedAt: new Date().toISOString(),
      recipeId: proposal.recipe.recipeId,
      recipeTitle: proposal.recipe.recipeTitle,
      recipeUrl: proposal.recipe.recipeUrl,
      foodImageUrl: proposal.recipe.foodImageUrl,
      householdSize,
      ingredientsUsed: proposal.ingredientsUsed,
      nutritionPerPerson: {
        proteinG: Math.round(proposal.nutrition.proteinG / householdSize),
        fatG: Math.round(proposal.nutrition.fatG / householdSize),
        carbG: Math.round(proposal.nutrition.carbG / householdSize),
        kcal: Math.round(proposal.nutrition.kcal / householdSize),
      },
    }
    setPlannedMeals((prev) => [...prev, planned])
    notify({
      message: `「${proposal.recipe.recipeTitle}」を今夜の予定にしました`,
      action: {
        label: '取り消す',
        onClick: () => {
          setPlannedMeals((prev) => prev.filter((p) => p.id !== planned.id))
        },
      },
    })
  }

  function eatPlanned(planned: PlannedMeal) {
    const usedNames = new Set(planned.ingredientsUsed.map((u) => u.ingredient))
    const removedInventory = inventory.filter((i) => usedNames.has(i.ingredient))
    setInventory((prev) => prev.filter((i) => !usedNames.has(i.ingredient)))

    const today = new Date().toISOString().slice(0, 10)
    const accepted: AcceptedMeal = {
      id: `m-${Date.now()}`,
      date: today,
      recipeId: planned.recipeId,
      recipeTitle: planned.recipeTitle,
      recipeUrl: planned.recipeUrl,
      foodImageUrl: planned.foodImageUrl,
      householdSize: planned.householdSize,
      nutritionPerPerson: planned.nutritionPerPerson,
    }
    setMealHistory((prev) => [...prev, accepted])
    setPlannedMeals((prev) => prev.filter((p) => p.id !== planned.id))

    notify({
      message: `「${planned.recipeTitle}」を記録しました`,
      action: {
        label: '元に戻す',
        onClick: () => {
          setInventory((prev) => [...prev, ...removedInventory])
          setMealHistory((prev) => prev.filter((m) => m.id !== accepted.id))
          setPlannedMeals((prev) => [...prev, planned])
        },
      },
    })
  }

  function cancelPlanned(planned: PlannedMeal) {
    setPlannedMeals((prev) => prev.filter((p) => p.id !== planned.id))
  }

  function addMissingToShopping(proposal: MealProposal, missing: string[]) {
    if (missing.length === 0) return
    const existing = new Set(shoppingList.map((s) => s.ingredient))
    const toAdd = missing.filter((m) => !existing.has(m))
    if (toAdd.length === 0) {
      notify({ message: 'すでに買い物リストに入っています' })
      return
    }
    const newItems: ShoppingItem[] = toAdd.map((ingredient, idx) => ({
      id: `s-${Date.now()}-${idx}`,
      ingredient,
      source: 'recipe',
      fromRecipeTitle: proposal.recipe.recipeTitle,
      checked: false,
      addedAt: new Date().toISOString(),
    }))
    setShoppingList((prev) => [...prev, ...newItems])
    notify({
      message: `${toAdd.length} 件を買い物リストへ追加しました`,
      action: {
        label: '元に戻す',
        onClick: () => {
          const ids = new Set(newItems.map((n) => n.id))
          setShoppingList((prev) => prev.filter((s) => !ids.has(s.id)))
        },
      },
    })
  }

  const showProposals = reply !== null
  const proposals = reply?.proposals ?? []

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-leaf-soft)] px-2.5 py-0.5">
              <span className="size-1.5 rounded-full bg-[var(--color-leaf)]" />
              <span className="text-xs font-semibold uppercase text-[var(--color-leaf)]">
                Today
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight text-balance text-[var(--color-ink)] sm:text-3xl lg:text-4xl">
              冷蔵庫の<span className="text-[var(--color-leaf)]">{inventory.length}品</span>から、
              <br />
              <span className="text-[var(--color-leaf)]">{householdSize}人分</span>の献立を編成。
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-pretty text-[var(--color-ink-soft)]">
              今日の気分を入力すると、在庫と最近の食事の傾向を踏まえて、献立候補をピックアップします。
            </p>
          </div>
        </div>

        <aside className="grid grid-cols-3 gap-2 self-end sm:gap-3">
          <KpiCard label="人数">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setHouseholdSize(n)}
                  aria-label={`${n}人分`}
                  className={`size-6 rounded text-xs font-medium tabular-nums transition-colors duration-150 ${
                    householdSize === n
                      ? 'bg-[var(--color-leaf)] text-white'
                      : 'text-[var(--color-ink-mute)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </KpiCard>
          <KpiCard label="在庫">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums">{inventory.length}</span>
              <span className="text-xs text-[var(--color-ink-mute)]">品目</span>
            </div>
          </KpiCard>
          <KpiCard label="候補">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold tabular-nums">{featured.length}</span>
              <span className="text-xs text-[var(--color-ink-mute)]">通り</span>
            </div>
          </KpiCard>
        </aside>
      </section>

      {plannedMeals.length > 0 && (
        <section aria-labelledby="planned-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2
              id="planned-heading"
              className="flex items-center gap-2 text-base font-semibold text-[var(--color-ink)]"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--color-leaf)]"
              />
              今夜の予定
            </h2>
            <span className="rounded-full bg-[var(--color-leaf-soft)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-leaf)]">
              {plannedMeals.length} 件
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plannedMeals.map((p) => (
              <PlannedCard
                key={p.id}
                planned={p}
                onEaten={() => eatPlanned(p)}
                onCancel={() => cancelPlanned(p)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-2.5 shadow-sm">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <SearchIcon />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="今日の気分を入力…"
            aria-label="今日の気分"
            disabled={loading}
            className="min-w-0 flex-1 rounded bg-transparent py-1 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-mute)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)] disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            候補を見る
          </button>
        </form>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line-soft)] pt-2.5">
          <span className="px-1 text-xs font-medium text-[var(--color-ink-soft)]">気分:</span>
          {MOODS.map((m) => {
            const active = activeMood === m.label
            return (
              <button
                key={m.label}
                onClick={() => submitQuery(m.label)}
                disabled={loading}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-40 ${
                  active
                    ? 'border-[var(--color-leaf)] bg-[var(--color-leaf)] text-white'
                    : 'border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-mute)] hover:text-[var(--color-ink)]'
                }`}
              >
                {m.label}
                <span
                  className={`ml-1 text-xs ${
                    active ? 'text-white/70' : 'text-[var(--color-ink-mute)]'
                  }`}
                >
                  {m.sub}
                </span>
              </button>
            )
          })}
          {(activeMood || reply) && (
            <button
              onClick={clearReply}
              className="ml-auto rounded-md px-2 py-1 text-xs text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]"
            >
              クリア
            </button>
          )}
        </div>
      </section>

      <div aria-live="polite" aria-busy={loading} className="contents">
      {loading && (
        <section className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-4 shadow-sm">
          <Spinner />
          <span className="text-sm text-[var(--color-ink-soft)]">在庫を照合しています…</span>
        </section>
      )}

      {showProposals && !loading && (
        <section className="animate-fade-rise space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="eyebrow-caps text-[var(--color-leaf)]">Curated</div>
              <p className="mt-1.5 max-w-2xl text-base font-medium leading-snug text-pretty text-[var(--color-ink)]">
                {reply?.text}
              </p>
            </div>
            <span className="rounded-full bg-[var(--color-bg-soft)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
              {proposals.length} 件
            </span>
          </div>

          {proposals.length === 0 ? (
            <EmptyState message="この条件で合うものが見つかりませんでした。" action={{ label: 'クリア', onClick: clearReply }} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {proposals.map((p) => (
                <RecipeCard
                  key={p.recipe.recipeId}
                  proposal={p}
                  inventory={inventory}
                  mealHistory={mealHistory}
                  planned={plannedRecipeIds.has(p.recipe.recipeId)}
                  onPlan={planProposal}
                  onAddToShopping={addMissingToShopping}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!showProposals && !loading && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="eyebrow-caps">In stock</div>
              <h2 className="mt-1.5 text-base font-semibold text-[var(--color-ink)]">
                今ある材料で作れそうな献立
              </h2>
            </div>
            <span className="rounded-full bg-[var(--color-bg-soft)] px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
              {featured.length} 件
            </span>
          </div>

          {featured.length === 0 ? (
            <EmptyState
              message="在庫が少ないようです。"
              action={{ label: '食材を追加 →', onClick: () => {} }}
              hint="「在庫」か「レシート」から材料を追加してください。"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <RecipeCard
                  key={p.recipe.recipeId}
                  proposal={p}
                  inventory={inventory}
                  mealHistory={mealHistory}
                  planned={plannedRecipeIds.has(p.recipe.recipeId)}
                  onPlan={planProposal}
                  onAddToShopping={addMissingToShopping}
                />
              ))}
            </div>
          )}
        </section>
      )}
      </div>
    </div>
  )
}

function KpiCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-card)] p-3 shadow-sm">
      <div className="eyebrow-caps">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function StatusPill({ ok, missing, id }: { ok: boolean; missing: number; id?: string }) {
  if (ok) {
    return (
      <span
        id={id}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-leaf-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-leaf)]"
      >
        <span className="size-1.5 rounded-full bg-[var(--color-leaf)]" />
        在庫OK
      </span>
    )
  }
  return (
    <span
      id={id}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-clay-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-clay)]"
    >
      <span className="size-1.5 rounded-full bg-[var(--color-clay)]" />
      不足 {missing} (採用不可)
    </span>
  )
}

function RecipeCard({
  proposal,
  inventory,
  mealHistory,
  planned,
  onPlan,
  onAddToShopping,
}: {
  proposal: MealProposal
  inventory: InventoryItem[]
  mealHistory: AcceptedMeal[]
  planned: boolean
  onPlan: (p: MealProposal) => void
  onAddToShopping: (p: MealProposal, missing: string[]) => void
}) {
  const statusId = useId()
  const materials = proposal.recipe.recipeMaterial
  const matchesArr = materials.map((m) => ({
    material: m,
    matched: inventory.some(
      (i) => m.includes(i.ingredient) || i.ingredient.includes(m)
    ),
  }))
  const missingArr = matchesArr.filter((m) => !m.matched)
  const missing = missingArr.length
  const allInStock = missing === 0
  const reason = reasonFor({ recipe: proposal.recipe, inventory, mealHistory })

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-card)] shadow-sm transition-shadow duration-150 ${
        planned
          ? 'border-[var(--color-leaf)]/30 opacity-70'
          : 'border-[var(--color-line)] hover:shadow-md'
      }`}
    >
      <a
        href={proposal.recipe.recipeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[4/3] overflow-hidden bg-[var(--color-bg-soft)]"
      >
        {proposal.recipe.foodImageUrl && (
          <img
            src={proposal.recipe.foodImageUrl}
            alt={proposal.recipe.recipeTitle}
            width={400}
            height={300}
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute left-2.5 top-2.5">
          <StatusPill ok={allInStock} missing={missing} id={statusId} />
        </div>
      </a>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <a
          href={proposal.recipe.recipeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-base font-semibold leading-snug text-balance text-[var(--color-ink)] hover:text-[var(--color-leaf)]"
        >
          {proposal.recipe.recipeTitle}
        </a>

        <ReasonBadge reason={reason} />

        <div className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          <span>{proposal.recipe.recipeIndication}</span>
          <span className="text-[var(--color-ink-mute)]">·</span>
          <span>{proposal.recipe.recipeCost}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {matchesArr.slice(0, 6).map((m) => (
            <span
              key={m.material}
              className={`truncate rounded px-1.5 py-0.5 text-xs font-medium ${
                m.matched
                  ? 'bg-[var(--color-bg-soft)] text-[var(--color-ink-soft)]'
                  : 'bg-[var(--color-clay-soft)] text-[var(--color-clay)] line-through decoration-[var(--color-clay)]/40'
              }`}
            >
              {m.material}
            </span>
          ))}
          {matchesArr.length > 6 && (
            <span className="rounded px-1.5 py-0.5 text-xs text-[var(--color-ink-mute)]">
              +{matchesArr.length - 6}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {!allInStock && !planned && (
            <button
              onClick={() => onAddToShopping(proposal, missingArr.map((m) => m.material))}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] transition-colors duration-150 hover:border-[var(--color-ink-mute)] hover:text-[var(--color-ink)]"
            >
              <span aria-hidden="true">🛒</span>
              不足を買う
            </button>
          )}
          <div className="ml-auto">
            {planned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-leaf)]">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--color-leaf)]" />
                今夜の予定
              </span>
            ) : (
              <button
                onClick={() => onPlan(proposal)}
                disabled={!allInStock}
                aria-describedby={!allInStock ? statusId : undefined}
                className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-soft)] disabled:text-[var(--color-ink-mute)]"
              >
                今夜の予定にする
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function PlannedCard({
  planned,
  onEaten,
  onCancel,
}: {
  planned: PlannedMeal
  onEaten: () => void
  onCancel: () => void
}) {
  return (
    <article className="flex items-center gap-3 rounded-xl border border-[var(--color-leaf)]/30 bg-[var(--color-leaf-soft)]/40 p-3 shadow-sm">
      <a
        href={planned.recipeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block size-16 shrink-0 overflow-hidden rounded-md bg-[var(--color-bg-soft)]"
      >
        {planned.foodImageUrl && (
          <img
            src={planned.foodImageUrl}
            alt={planned.recipeTitle}
            width={64}
            height={64}
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </a>
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <a
          href={planned.recipeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-1 text-sm font-semibold text-[var(--color-ink)] hover:text-[var(--color-leaf)]"
        >
          {planned.recipeTitle}
        </a>
        <div className="text-xs text-[var(--color-ink-soft)] tabular-nums">
          P {planned.nutritionPerPerson.proteinG}g · {planned.householdSize}人分
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          onClick={onEaten}
          className="rounded-md bg-[var(--color-leaf)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
        >
          食べた
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1 text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
        >
          取り消す
        </button>
      </div>
    </article>
  )
}

function ReasonBadge({ reason }: { reason: ReturnType<typeof reasonFor> }) {
  const accent = getReasonAccent(reason.tag)
  return (
    <div
      className="inline-flex max-w-full items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium"
      style={{ background: accent.bg, color: accent.color }}
    >
      <span aria-hidden="true" className="text-[11px]">
        {accent.icon}
      </span>
      <span className="truncate">{reason.message}</span>
    </div>
  )
}

function EmptyState({
  message,
  hint,
  action,
}: {
  message: string
  hint?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-card)] p-8 text-center">
      <p className="text-sm font-medium text-pretty text-[var(--color-ink)]">{message}</p>
      {hint && <p className="text-xs text-pretty text-[var(--color-ink-soft)]">{hint}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-1.5 size-4 text-[var(--color-ink-mute)]"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-ink)]"
    />
  )
}
