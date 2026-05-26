import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { categorizeIngredient } from '../lib/categorize'
import { useToast } from '../lib/toast'
import type { InventoryItem, ShoppingItem } from '../types'

type Props = {
  shoppingList: ShoppingItem[]
  setShoppingList: Dispatch<SetStateAction<ShoppingItem[]>>
  inventory: InventoryItem[]
  setInventory: Dispatch<SetStateAction<InventoryItem[]>>
}

export function ShoppingSection({
  shoppingList,
  setShoppingList,
  inventory,
  setInventory,
}: Props) {
  const { notify } = useToast()
  const [input, setInput] = useState('')

  const sorted = useMemo(
    () =>
      [...shoppingList].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return a.addedAt < b.addedAt ? -1 : 1
      }),
    [shoppingList]
  )

  const unchecked = sorted.filter((s) => !s.checked)
  const checked = sorted.filter((s) => s.checked)

  function addItem(e: FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    const item: ShoppingItem = {
      id: `s-${Date.now()}`,
      ingredient: trimmed,
      source: 'manual',
      checked: false,
      addedAt: new Date().toISOString(),
    }
    setShoppingList((prev) => [...prev, item])
    setInput('')
  }

  function toggle(id: string) {
    setShoppingList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    )
  }

  function remove(id: string) {
    const removed = shoppingList.find((s) => s.id === id)
    if (!removed) return
    setShoppingList((prev) => prev.filter((s) => s.id !== id))
    notify({
      message: `${removed.ingredient}を削除しました`,
      action: {
        label: '元に戻す',
        onClick: () => setShoppingList((prev) => [...prev, removed]),
      },
    })
  }

  function clearChecked() {
    const willRemove = shoppingList.filter((s) => s.checked)
    if (willRemove.length === 0) return
    setShoppingList((prev) => prev.filter((s) => !s.checked))
    notify({
      message: `${willRemove.length} 件を削除しました`,
      action: {
        label: '元に戻す',
        onClick: () => setShoppingList((prev) => [...prev, ...willRemove]),
      },
    })
  }

  function moveCheckedToInventory() {
    const willMove = shoppingList.filter((s) => s.checked)
    if (willMove.length === 0) return
    const maxId = inventory.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0)
    const newItems: InventoryItem[] = willMove.map((s, idx) => ({
      id: String(maxId + idx + 1),
      ingredient: s.ingredient,
      quantity: 1,
      unit: '個',
      category: categorizeIngredient(s.ingredient),
      source: 'manual',
    }))
    setInventory((prev) => [...prev, ...newItems])
    setShoppingList((prev) => prev.filter((s) => !s.checked))
    notify({
      message: `${willMove.length} 件を在庫に移しました`,
      action: {
        label: '元に戻す',
        onClick: () => {
          const newIds = new Set(newItems.map((n) => n.id))
          setInventory((prev) => prev.filter((i) => !newIds.has(i.id)))
          setShoppingList((prev) => [...prev, ...willMove])
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <section className="flex items-baseline justify-between">
        <div>
          <div className="eyebrow-caps">Shopping</div>
          <h1 className="mt-1.5 text-2xl font-semibold text-balance text-[var(--color-ink)]">
            買い物リスト{' '}
            {unchecked.length > 0 && (
              <span className="ml-1 rounded-full bg-[var(--color-bg-soft)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
                {unchecked.length}
              </span>
            )}
          </h1>
        </div>
        {checked.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={moveCheckedToInventory}
              className="press rounded-md bg-[var(--color-leaf)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              在庫に移す ({checked.length})
            </button>
            <button
              onClick={clearChecked}
              className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] transition-colors duration-150 hover:bg-[var(--color-bg-soft)]"
            >
              削除
            </button>
          </div>
        )}
      </section>

      <form
        onSubmit={addItem}
        className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] p-2.5 shadow-sm"
      >
        <PlusIcon />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="食材を追加 (例: 鶏むね肉)"
          aria-label="買い物リストに追加する食材"
          className="flex-1 rounded bg-transparent py-1 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-mute)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)]"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="press rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
        >
          追加
        </button>
      </form>

      {shoppingList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="text-sm font-medium text-[var(--color-ink)]">買い物リストは空です</p>
          <p className="text-xs text-pretty text-[var(--color-ink-soft)]">
            上の入力欄から手動で追加するか、献立タブで「不足材料を買い物リストへ」ボタンから一括追加できます。
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {unchecked.length > 0 && (
            <section
              aria-labelledby="shopping-unchecked"
              className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] shadow-sm"
            >
              <div className="flex items-baseline justify-between border-b border-[var(--color-line-soft)] px-4 py-2">
                <h2 id="shopping-unchecked" className="text-xs font-semibold text-[var(--color-ink)]">
                  買うもの
                </h2>
                <span className="text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
                  {unchecked.length} 点
                </span>
              </div>
              <ul className="stagger-children">
                {unchecked.map((item, idx) => (
                  <div key={item.id} style={{ '--i': idx } as React.CSSProperties}>
                    <Row
                      item={item}
                      onToggle={() => toggle(item.id)}
                      onRemove={() => remove(item.id)}
                      border={idx > 0}
                    />
                  </div>
                ))}
              </ul>
            </section>
          )}
          {checked.length > 0 && (
            <section
              aria-labelledby="shopping-checked"
              className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] shadow-sm"
            >
              <div className="flex items-baseline justify-between border-b border-[var(--color-line-soft)] bg-[var(--color-leaf-soft)]/40 px-4 py-2">
                <h2
                  id="shopping-checked"
                  className="flex items-center gap-2 text-xs font-semibold text-[var(--color-leaf)]"
                >
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--color-leaf)]" />
                  カゴに入れた
                </h2>
                <span className="text-xs font-medium tabular-nums text-[var(--color-leaf)]/70">
                  {checked.length} 点
                </span>
              </div>
              <ul className="stagger-children">
                {checked.map((item, idx) => (
                  <div key={item.id} style={{ '--i': idx } as React.CSSProperties}>
                    <Row
                      item={item}
                      onToggle={() => toggle(item.id)}
                      onRemove={() => remove(item.id)}
                      border={idx > 0}
                    />
                  </div>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function Row({
  item,
  onToggle,
  onRemove,
  border,
}: {
  item: ShoppingItem
  onToggle: () => void
  onRemove: () => void
  border: boolean
}) {
  return (
    <li
      className={`group flex items-center gap-3 px-4 py-2.5 ${
        border ? 'border-t border-[var(--color-line-soft)]' : ''
      }`}
    >
      <label className="flex flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={item.checked}
          onChange={onToggle}
          aria-label={`${item.ingredient}を${item.checked ? '未購入に戻す' : 'カゴに入れる'}`}
          className="size-4 shrink-0 cursor-pointer accent-[var(--color-leaf)]"
        />
        <span
          className={`truncate text-sm ${
            item.checked
              ? 'text-[var(--color-ink-mute)] line-through'
              : 'text-[var(--color-ink)]'
          }`}
        >
          {item.ingredient}
        </span>
        {item.fromRecipeTitle && (
          <span className="truncate text-xs text-[var(--color-ink-mute)]">
            ({item.fromRecipeTitle})
          </span>
        )}
      </label>
      <button
        onClick={onRemove}
        aria-label={`${item.ingredient}を削除`}
        className="text-base text-[var(--color-ink-mute)] opacity-0 transition-opacity duration-150 hover:text-[var(--color-clay)] group-hover:opacity-100 focus-visible:opacity-100"
      >
        ×
      </button>
    </li>
  )
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="ml-1.5 size-4 text-[var(--color-ink-mute)]"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
