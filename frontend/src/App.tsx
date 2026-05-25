import { useState } from 'react'
import { InventorySection } from './components/InventorySection'
import { MealsSection } from './components/MealsSection'
import { NutritionSection } from './components/NutritionSection'
import { ReceiptSection } from './components/ReceiptSection'
import { ShoppingSection } from './components/ShoppingSection'
import { mockInventory } from './mock/inventory'
import { mockMealHistory } from './mock/mealHistory'
import { useUrlState } from './lib/useUrlState'
import { ToastProvider } from './lib/toast'
import type { AcceptedMeal, InventoryItem, PlannedMeal, ShoppingItem } from './types'

type Tab = 'meals' | 'inventory' | 'shopping' | 'receipt' | 'nutrition'

const TABS: { key: Tab; label: string }[] = [
  { key: 'meals', label: '献立' },
  { key: 'inventory', label: '在庫' },
  { key: 'shopping', label: '買い物' },
  { key: 'receipt', label: 'レシート' },
  { key: 'nutrition', label: '栄養' },
]

const TAB_KEYS = TABS.map((t) => t.key) as readonly Tab[]

function App() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'meals', TAB_KEYS)
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory)
  const [householdSize, setHouseholdSize] = useState<number>(2)
  const [mealHistory, setMealHistory] = useState<AcceptedMeal[]>(mockMealHistory)
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([])
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([])

  return (
    <ToastProvider>
    <div className="min-h-dvh bg-[var(--color-bg)]">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-bg)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-[var(--color-ink)]">
              <div className="size-1.5 rounded-full bg-[var(--color-leaf)]" />
            </div>
            <div className="text-base font-semibold text-[var(--color-ink)]">kondate</div>
            <span className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-ink-soft)]">
              beta
            </span>
          </div>
          <nav aria-label="主要メニュー" className="hidden items-center gap-0.5 md:flex">
            {TABS.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:py-8 md:pb-8">
        {tab === 'meals' && (
          <MealsSection
            inventory={inventory}
            setInventory={setInventory}
            householdSize={householdSize}
            setHouseholdSize={setHouseholdSize}
            mealHistory={mealHistory}
            setMealHistory={setMealHistory}
            plannedMeals={plannedMeals}
            setPlannedMeals={setPlannedMeals}
            shoppingList={shoppingList}
            setShoppingList={setShoppingList}
          />
        )}
        {tab === 'inventory' && (
          <InventorySection inventory={inventory} setInventory={setInventory} />
        )}
        {tab === 'shopping' && (
          <ShoppingSection
            shoppingList={shoppingList}
            setShoppingList={setShoppingList}
            inventory={inventory}
            setInventory={setInventory}
          />
        )}
        {tab === 'receipt' && <ReceiptSection setInventory={setInventory} />}
        {tab === 'nutrition' && (
          <NutritionSection
            mealHistory={mealHistory}
            inventory={inventory}
            householdSize={householdSize}
            setPlannedMeals={setPlannedMeals}
            shoppingList={shoppingList}
            setShoppingList={setShoppingList}
            onNavigate={setTab}
          />
        )}
      </main>

      <nav
        aria-label="主要メニュー"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-bg-card)]/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? 'text-[var(--color-ink)]'
                    : 'text-[var(--color-ink-mute)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1 rounded-full ${
                    active ? 'bg-[var(--color-leaf)]' : 'bg-transparent'
                  }`}
                />
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
    </ToastProvider>
  )
}

export default App
