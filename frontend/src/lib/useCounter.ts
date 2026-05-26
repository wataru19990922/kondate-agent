import { useEffect, useRef, useState } from 'react'

/**
 * 数値の変化を一定時間かけてイージング付きで滑らかに見せる。
 * 整数を扱う前提 (出力時に Math.round)。
 *
 * @param value 目標値
 * @param duration アニメ持続 (ms)、デフォルト 600
 */
export function useCounter(value: number, duration = 600): number {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(value)

  useEffect(() => {
    if (display === value) return

    // 既存アニメをキャンセル
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    fromRef.current = display
    startRef.current = null

    function tick(now: number) {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(1, elapsed / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      const next = fromRef.current + (value - fromRef.current) * eased
      setDisplay(Math.round(next))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration, display])

  return display
}
