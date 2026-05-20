import { useState } from 'react'
import { InventorySection } from './components/InventorySection'
import { MealsSection } from './components/MealsSection'
import { ReceiptSection } from './components/ReceiptSection'

type Tab = 'inventory' | 'meals' | 'receipt'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'meals', label: '献立提案', icon: '🍳' },
  { key: 'inventory', label: '在庫', icon: '🧊' },
  { key: 'receipt', label: 'レシート', icon: '🧾' },
]

function App() {
  const [tab, setTab] = useState<Tab>('meals')

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">kondate-agent</h1>
            <p className="text-xs text-gray-500">
              冷蔵庫の在庫から、今日の献立を提案
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
            MVP
          </span>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === 'meals' && <MealsSection />}
        {tab === 'inventory' && <InventorySection />}
        {tab === 'receipt' && <ReceiptSection />}
      </main>
    </div>
  )
}

export default App
