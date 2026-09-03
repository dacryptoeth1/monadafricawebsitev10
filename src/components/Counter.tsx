import { useEffect, useRef } from 'react'
import { useInView } from 'framer-motion'

// Counts up to `value` once its span scrolls into view. Used 4x in the
// Hero's stats row (Builders/Projects/Opportunities/Countries) — all 4
// mount and animate simultaneously on every homepage load, since the
// Hero is never deferred.
//
// Previously each frame of the count-up called setState, so React
// re-rendered this component on every animation frame — ~60fps for
// 1.4s is roughly 84 re-renders per instance, ~336 across the 4
// simultaneous Hero counters, all happening in the first 1.4 seconds of
// every homepage load, competing with everything else starting up at
// the same time. The count-up is now a direct DOM write via a ref on
// each frame instead — the one place worth bypassing React state for,
// since the intermediate values during the animation were never
// meaningful application state, just frame-by-frame text content.
export default function Counter({ value, suffix = '', duration = 1400 }: { value: number; suffix?: string; duration?: number }) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const inView = useInView(spanRef, { once: true, margin: '-40px' })

  useEffect(() => {
    if (!inView) return
    const el = spanRef.current
    if (!el) return

    // Never animated this at all before — every other animation on the
    // site respects this, the count-up should too: jump straight to
    // the final value instead of running the frame loop at all.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = `${value}${suffix}`
      return
    }

    const start = performance.now()
    let raf: number
    function tick(now: number) {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      if (el) el.textContent = `${Math.round(value * eased)}${suffix}`
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration, suffix])

  return <span ref={spanRef}>0{suffix}</span>
}
