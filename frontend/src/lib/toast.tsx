import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

type Toast = {
  id: string
  message: string
  action?: { label: string; onClick: () => void }
}

type ToastContextValue = {
  notify: (t: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timerId = timers.current.get(id)
    if (timerId) {
      window.clearTimeout(timerId)
      timers.current.delete(id)
    }
  }, [])

  const notify = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { ...t, id }])
      const timerId = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      timers.current.set(id, timerId)
    },
    [dismiss]
  )

  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="animate-fade-rise pointer-events-auto flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink)] px-4 py-2.5 shadow-md"
    >
      <span className="text-sm text-white">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            onDismiss()
          }}
          className="rounded-md border border-white/20 px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="閉じる"
        className="rounded-md text-base text-white/60 transition-colors duration-150 hover:text-white"
      >
        ×
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
