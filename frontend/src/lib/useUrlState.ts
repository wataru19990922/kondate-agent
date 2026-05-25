import { useCallback, useEffect, useState } from 'react'

/**
 * URL の querystring と単一の string state を同期する最小フック。
 * - 初期値は URL から (なければ defaultValue)
 * - 値変更時は history.replaceState で URL を更新 (履歴を汚さない)
 * - popstate (戻る/進む) で state を追従
 *
 * 厳密な型は呼び元で union narrowing。
 */
export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
  allowed?: readonly T[]
): [T, (next: T) => void] {
  const read = useCallback((): T => {
    const params = new URLSearchParams(window.location.search)
    const v = params.get(key) as T | null
    if (v === null) return defaultValue
    if (allowed && !allowed.includes(v)) return defaultValue
    return v
  }, [key, defaultValue, allowed])

  const [value, setValue] = useState<T>(read)

  const update = useCallback(
    (next: T) => {
      setValue(next)
      const params = new URLSearchParams(window.location.search)
      if (next === defaultValue) {
        params.delete(key)
      } else {
        params.set(key, next)
      }
      const qs = params.toString()
      const url = qs ? `?${qs}` : window.location.pathname
      window.history.replaceState(null, '', url)
    },
    [key, defaultValue]
  )

  useEffect(() => {
    const onPop = () => setValue(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [read])

  return [value, update]
}
