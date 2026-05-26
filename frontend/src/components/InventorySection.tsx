import { useMemo, useState, useEffect, useId, cloneElement } from 'react'
import type { Dispatch, FormEvent, SetStateAction, ReactElement } from 'react'
import { CATEGORY_ORDER, categorizeIngredient, getCategoryMeta } from '../lib/categorize'
import { formatMonthDay } from '../lib/format'
import { useUrlState } from '../lib/useUrlState'
import { useToast } from '../lib/toast'
import { useCounter } from '../lib/useCounter'
import type { IngredientCategory, InventoryItem } from '../types'

type Props = {
  inventory: InventoryItem[]
  setInventory: Dispatch<SetStateAction<InventoryItem[]>>
}

const COMMON_UNITS = ['g', 'kg', 'ml', 'l', '個', '本', '袋', '玉', '丁', '枚', 'パック']

const FILTER_VALUES = ['all', 'urgent', ...CATEGORY_ORDER] as const
type FilterValue = (typeof FILTER_VALUES)[number]

const EXPIRING_THRESHOLD_DAYS = 3

function daysUntilExpiry(iso: string | undefined, today: Date): number | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((d.getTime() - t.getTime()) / 86400000)
}

function isUrgent(item: InventoryItem, today: Date): boolean {
  const days = daysUntilExpiry(item.expiresAt, today)
  return days !== null && days <= EXPIRING_THRESHOLD_DAYS
}

export function InventorySection({ inventory, setInventory }: Props) {
  const { notify } = useToast()
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('個')
  const [expiresAt, setExpiresAt] = useState('')
  const [category, setCategory] = useState<IngredientCategory>('other')
  const [categoryManuallySet, setCategoryManuallySet] = useState(false)
  const [filter, setFilter] = useUrlState<FilterValue>('cat', 'all', FILTER_VALUES)

  useEffect(() => {
    if (categoryManuallySet) return
    if (!name.trim()) return
    setCategory(categorizeIngredient(name))
  }, [name, categoryManuallySet])

  const today = useMemo(() => new Date(), [])

  const grouped = useMemo(() => {
    const map = new Map<IngredientCategory, InventoryItem[]>()
    for (const c of CATEGORY_ORDER) map.set(c, [])
    for (const item of inventory) {
      map.get(item.category)?.push(item)
    }
    // 各カテゴリ内で賞味期限の近い順にソート (期限なしは末尾)
    for (const items of map.values()) {
      items.sort((a, b) => {
        const da = daysUntilExpiry(a.expiresAt, today)
        const db = daysUntilExpiry(b.expiresAt, today)
        if (da === null && db === null) return 0
        if (da === null) return 1
        if (db === null) return -1
        return da - db
      })
    }
    return map
  }, [inventory, today])

  const urgentCount = useMemo(
    () => inventory.filter((i) => isUrgent(i, today)).length,
    [inventory, today]
  )
  const inventoryCountDisplay = useCounter(inventory.length)
  const urgentCountDisplay = useCounter(urgentCount)

  function removeItem(id: string) {
    const removed = inventory.find((it) => it.id === id)
    if (!removed) return
    setInventory((prev) => prev.filter((it) => it.id !== id))
    notify({
      message: `${removed.ingredient}を削除しました`,
      action: {
        label: '元に戻す',
        onClick: () => setInventory((prev) => [...prev, removed]),
      },
    })
  }

  function resetForm() {
    setName('')
    setQuantity('1')
    setUnit('個')
    setExpiresAt('')
    setCategory('other')
    setCategoryManuallySet(false)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const qty = Number(quantity)
    if (Number.isNaN(qty) || qty <= 0) return

    const maxId = inventory.reduce(
      (max, i) => Math.max(max, Number(i.id) || 0),
      0
    )
    setInventory((prev) => [
      ...prev,
      {
        id: String(maxId + 1),
        ingredient: name.trim(),
        quantity: qty,
        unit,
        category,
        expiresAt: expiresAt || undefined,
        source: 'manual',
      },
    ])
    resetForm()
    setShowAddForm(false)
  }

  const visibleCategories = CATEGORY_ORDER.filter((c) => {
    const items = grouped.get(c) ?? []
    if (items.length === 0) return false
    if (filter === 'all') return true
    if (filter === 'urgent') return items.some((i) => isUrgent(i, today))
    return filter === c
  })

  function itemsForCategory(c: IngredientCategory): InventoryItem[] {
    const items = grouped.get(c) ?? []
    if (filter === 'urgent') return items.filter((i) => isUrgent(i, today))
    return items
  }

  return (
    <div className="space-y-6">
      <section className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow-caps">Pantry</div>
          <h1 className="mt-1.5 text-2xl font-semibold text-balance text-[var(--color-ink)]">
            台所の在庫{' '}
            <span className="ml-1 rounded-full bg-[var(--color-bg-soft)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
              {inventoryCountDisplay}
            </span>
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="press inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
        >
          {showAddForm ? (
            'キャンセル'
          ) : (
            <>
              <PlusIcon /> 食材を追加
            </>
          )}
        </button>
      </section>

      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="animate-fade-rise space-y-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-4 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Field label="食材名">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 鶏むね肉"
                autoFocus
                className={inputCls}
              />
            </Field>
            <Field label="数量">
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="単位">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputCls}
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="消費期限">
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="flex items-end gap-3">
            <Field label="分類">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as IngredientCategory)
                  setCategoryManuallySet(true)
                }}
                className={inputCls}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {getCategoryMeta(c).label}
                  </option>
                ))}
              </select>
            </Field>
            {!categoryManuallySet && name.trim() && (
              <span className="pb-2 text-xs font-medium text-[var(--color-leaf)]">
                自動判定
              </span>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={!name.trim()}
              className="press rounded-md bg-[var(--color-ink)] px-4 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              追加
            </button>
          </div>
        </form>
      )}

      {urgentCount > 0 && (
        <button
          onClick={() => setFilter(filter === 'urgent' ? 'all' : 'urgent')}
          className="press animate-slide-up flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-clay)]/40 bg-[var(--color-clay-soft)] px-4 py-2.5 text-left transition-colors duration-150 hover:border-[var(--color-clay)]"
          aria-pressed={filter === 'urgent'}
        >
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="animate-pulse-soft size-1.5 rounded-full bg-[var(--color-clay)]"
            />
            <span className="text-sm font-medium text-[var(--color-clay)]">
              賞味期限が近いもの <span className="tabular-nums">{urgentCountDisplay}</span> 点
            </span>
            <span className="hidden text-xs text-[var(--color-clay)]/70 sm:inline">
              ({EXPIRING_THRESHOLD_DAYS} 日以内に使い切りたい)
            </span>
          </span>
          <span className="text-xs font-medium text-[var(--color-clay)]">
            {filter === 'urgent' ? 'すべて表示 →' : 'これだけ見る →'}
          </span>
        </button>
      )}

      {inventory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            すべて
            <Num active={filter === 'all'}>{inventory.length}</Num>
          </FilterChip>
          {urgentCount > 0 && (
            <FilterChip active={filter === 'urgent'} onClick={() => setFilter('urgent')}>
              <span
                className="size-1.5 rounded-full"
                style={{ background: 'var(--color-clay)' }}
              />
              期限近
              <Num active={filter === 'urgent'}>{urgentCount}</Num>
            </FilterChip>
          )}
          {CATEGORY_ORDER.map((c) => {
            const count = grouped.get(c)?.length ?? 0
            if (count === 0) return null
            const meta = getCategoryMeta(c)
            return (
              <FilterChip
                key={c}
                active={filter === c}
                onClick={() => setFilter(c)}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: meta.dot }}
                />
                {meta.label}
                <Num active={filter === c}>{count}</Num>
              </FilterChip>
            )
          })}
        </div>
      )}

      {inventory.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="text-sm font-medium text-[var(--color-ink)]">まだ何も入っていません</p>
          <p className="text-xs text-pretty text-[var(--color-ink-soft)]">
            「食材を追加」か、レシートを撮影してください。
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="press rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
          >
            食材を追加
          </button>
        </div>
      ) : visibleCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="text-sm font-medium text-[var(--color-ink)]">該当する食材がありません</p>
          <button
            onClick={() => setFilter('all')}
            className="press rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
          >
            フィルターを解除
          </button>
        </div>
      ) : (
        <div className="stagger-children space-y-5">
          {visibleCategories.map((c, i) => {
            const items = itemsForCategory(c)
            const meta = getCategoryMeta(c)
            return (
              <section
                key={c}
                style={{ '--i': i } as React.CSSProperties}
                className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] shadow-sm"
              >
                <div
                  className="flex items-center justify-between border-b border-[var(--color-line-soft)] px-4 py-2"
                  style={{ background: meta.tint }}
                >
                  <h2
                    className="flex items-center gap-2 text-xs font-semibold"
                    style={{ color: meta.tintText }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: meta.dot }}
                    />
                    {meta.label}
                  </h2>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: meta.tintText, opacity: 0.7 }}
                  >
                    {items.length} 点
                  </span>
                </div>
                <ul>
                  {items.map((item, idx) => {
                    const days = daysUntilExpiry(item.expiresAt, today)
                    const urgent = days !== null && days <= EXPIRING_THRESHOLD_DAYS
                    const expired = days !== null && days < 0
                    return (
                    <li
                      key={item.id}
                      className={`group flex items-baseline justify-between gap-4 px-4 py-2.5 ${
                        idx > 0 ? 'border-t border-[var(--color-line-soft)]' : ''
                      } ${urgent ? 'bg-[var(--color-clay-soft)]/30' : ''}`}
                    >
                      <div className="flex items-baseline gap-3">
                        {urgent && (
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 self-center rounded-full bg-[var(--color-clay)]"
                          />
                        )}
                        <span className="truncate text-sm text-[var(--color-ink)]">
                          {item.ingredient}
                        </span>
                        {item.expiresAt && (
                          <span
                            className={`text-xs ${
                              expired
                                ? 'font-medium text-[var(--color-clay)]'
                                : urgent
                                  ? 'font-medium text-[var(--color-clay)]'
                                  : 'text-[var(--color-ink-mute)]'
                            }`}
                          >
                            <time dateTime={item.expiresAt}>
                              {expired
                                ? `期限切れ (${formatMonthDay(item.expiresAt)})`
                                : days === 0
                                  ? '今日まで'
                                  : days === 1
                                    ? '明日まで'
                                    : urgent
                                      ? `あと${days}日`
                                      : `～${formatMonthDay(item.expiresAt)}`}
                            </time>
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm tabular-nums text-[var(--color-ink-soft)]">
                          {item.quantity}
                          <span className="ml-0.5 text-xs text-[var(--color-ink-mute)]">
                            {item.unit}
                          </span>
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label={`${item.ingredient}を削除`}
                          className="text-base text-[var(--color-ink-mute)] opacity-0 transition-opacity duration-150 hover:text-[var(--color-clay)] group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-[var(--color-line)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-mute)] focus-visible:border-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ink)]/15'

function Field({
  label,
  children,
}: {
  label: string
  children: ReactElement<{ id?: string }>
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="eyebrow-caps mb-1 block">
        {label}
      </label>
      {cloneElement(children, { id })}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
        active
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
          : 'border-[var(--color-line)] bg-[var(--color-bg-card)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-mute)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  )
}

function Num({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <span
      className={`text-xs tabular-nums ${
        active ? 'text-white/70' : 'text-[var(--color-ink-mute)]'
      }`}
    >
      {children}
    </span>
  )
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="size-3"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
