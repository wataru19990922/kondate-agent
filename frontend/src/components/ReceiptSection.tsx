import { useState, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { categorizeIngredient } from '../lib/categorize'
import { formatMonthDay } from '../lib/format'
import { useToast } from '../lib/toast'
import type { InventoryItem } from '../types'

type Props = {
  setInventory: Dispatch<SetStateAction<InventoryItem[]>>
}

const MOCK_PARSED_INGREDIENTS: Omit<InventoryItem, 'id' | 'source' | 'category'>[] = [
  { ingredient: '豚バラ肉', quantity: 250, unit: 'g', expiresAt: '2026-05-28' },
  { ingredient: 'キャベツ', quantity: 1, unit: '玉', expiresAt: '2026-06-05' },
  { ingredient: '牛乳', quantity: 1, unit: '本', expiresAt: '2026-06-02' },
  { ingredient: '木綿豆腐', quantity: 1, unit: '丁', expiresAt: '2026-05-29' },
]

export function ReceiptSection({ setInventory }: Props) {
  const { notify } = useToast()
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done'>('idle')
  const [parsed, setParsed] = useState<typeof MOCK_PARSED_INGREDIENTS>([])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setStatus('parsing')
    setParsed([])
    setTimeout(() => {
      setParsed(MOCK_PARSED_INGREDIENTS)
      setStatus('done')
    }, 1500)
  }

  function addAllToInventory() {
    const addedIds: string[] = []
    setInventory((prev) => {
      const next = [...prev]
      const maxId = prev.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0)
      parsed.forEach((p, idx) => {
        const newId = String(maxId + idx + 1)
        addedIds.push(newId)
        next.push({
          id: newId,
          ingredient: p.ingredient,
          quantity: p.quantity,
          unit: p.unit,
          category: categorizeIngredient(p.ingredient),
          expiresAt: p.expiresAt,
          source: 'receipt',
        })
      })
      return next
    })
    const addedCount = parsed.length
    setParsed([])
    setStatus('idle')
    setPreview(null)
    notify({
      message: `${addedCount} 点を在庫に追加しました`,
      action: {
        label: '元に戻す',
        onClick: () => {
          const idSet = new Set(addedIds)
          setInventory((prev) => prev.filter((i) => !idSet.has(i.id)))
        },
      },
    })
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="eyebrow-caps">Receipt</div>
        <h1 className="mt-1.5 text-2xl font-semibold text-balance text-[var(--color-ink)]">
          レシートから在庫に取り込む
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-pretty text-[var(--color-ink-soft)]">
          スーパーのレシートを撮影してアップロードすると、品目と数量を読み取って台所の在庫に追加します。
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="group flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-bg-card)] text-center transition-colors duration-150 hover:border-[var(--color-ink-mute)] hover:bg-[var(--color-bg-soft)]/60">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            aria-label="レシート画像を選択"
          />
          {preview ? (
            <img
              src={preview}
              alt="レシートのプレビュー"
              width={1200}
              height={900}
              className="max-h-full max-w-full object-contain p-4"
            />
          ) : (
            <>
              <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-bg-soft)] text-[var(--color-ink-soft)] transition-colors duration-150 group-hover:bg-[var(--color-ink)] group-hover:text-white">
                <UploadIcon />
              </div>
              <span className="mt-3 text-sm font-medium text-[var(--color-ink)]">
                画像をアップロード
              </span>
              <span className="mt-1 text-xs text-[var(--color-ink-mute)]">JPEG · PNG · HEIC</span>
            </>
          )}
        </label>

        <div
          aria-live="polite"
          aria-busy={status === 'parsing'}
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-card)] shadow-sm"
        >
          {status === 'idle' && !preview && (
            <div className="flex h-full min-h-[200px] items-center justify-center p-8 text-center">
              <p className="text-sm text-pretty text-[var(--color-ink-soft)]">
                画像を選択すると、ここに読み取り結果が表示されます。
              </p>
            </div>
          )}

          {status === 'parsing' && (
            <div className="flex h-full min-h-[200px] items-center justify-center gap-2 p-8">
              <Spinner />
              <span className="text-sm text-[var(--color-ink-soft)]">読み取り中…</span>
            </div>
          )}

          {status === 'done' && (
            <div className="animate-fade-rise">
              <div className="flex items-baseline justify-between border-b border-[var(--color-line-soft)] px-5 py-3">
                <span className="text-sm font-semibold text-[var(--color-ink)]">読み取り結果</span>
                <span className="text-xs font-medium tabular-nums text-[var(--color-ink-mute)]">
                  {parsed.length} 点
                </span>
              </div>
              <ul className="stagger-children">
                {parsed.map((p, idx) => (
                  <li
                    key={p.ingredient}
                    style={{ '--i': idx } as React.CSSProperties}
                    className={`flex items-baseline justify-between gap-4 px-5 py-2.5 ${
                      idx > 0 ? 'border-t border-[var(--color-line-soft)]' : ''
                    }`}
                  >
                    <span className="truncate text-sm text-[var(--color-ink)]">{p.ingredient}</span>
                    <span className="flex items-baseline gap-3 text-xs">
                      <span className="tabular-nums text-[var(--color-ink-soft)]">
                        {p.quantity}
                        <span className="ml-0.5 text-[var(--color-ink-mute)]">{p.unit}</span>
                      </span>
                      {p.expiresAt && (
                        <time dateTime={p.expiresAt} className="text-[var(--color-ink-mute)]">
                          ～{formatMonthDay(p.expiresAt)}
                        </time>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end border-t border-[var(--color-line-soft)] px-5 py-3">
                <button
                  onClick={addAllToInventory}
                  className="press rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-medium text-white transition-opacity duration-150 hover:opacity-90"
                >
                  すべて在庫に追加
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
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
