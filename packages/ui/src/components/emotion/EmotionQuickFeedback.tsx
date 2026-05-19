import { useEffect, useRef, useState } from 'react'

type EmotionQuickFeedbackProps = {
  /** 返回 Promise 时加载层会等到该 Promise 结束（宜只包住本地持久化，不宜包含慢速 AI）。 */
  onSelect: (emotion: string) => void | Promise<void>
}

import {
  EMOTION_CHIP_LABELS,
  emotionChipButtonClass,
} from './emotionChips'

export function EmotionQuickFeedback({ onSelect }: EmotionQuickFeedbackProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const hintTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (hintTimerRef.current != null) {
        window.clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [])

  async function handleClick(label: string) {
    setSelected(label)
    setBusy(true)
    setHint(null)
    if (hintTimerRef.current != null) {
      window.clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    try {
      await Promise.resolve(onSelect(label))
      setHint(`已记下「${label}」。陪伴短句稍后在气泡中展示。`)
      hintTimerRef.current = window.setTimeout(() => {
        setHint(null)
        hintTimerRef.current = null
      }, 4500)
    } catch {
      setSelected(null)
      setHint('记录失败，请稍后再试。')
      hintTimerRef.current = window.setTimeout(() => {
        setHint(null)
        hintTimerRef.current = null
      }, 4000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="relative rounded-xl">
      <h3 className="mb-1 text-sm font-medium leading-snug text-[color:var(--sk-text-body)]">现在的情绪是？</h3>
      <div className="flex flex-wrap gap-1.5">
        {EMOTION_CHIP_LABELS.map((emotion) => {
          const active = selected === emotion
          return (
            <button
              key={emotion}
              type="button"
              disabled={busy}
              onClick={() => void handleClick(emotion)}
              className={emotionChipButtonClass(active)}
            >
              {emotion}
            </button>
          )
        })}
      </div>
      <div
        className={`mt-1 flex items-start ${busy ? 'min-h-5' : ''}`}
        aria-live="polite"
        aria-busy={busy}
      >
        {busy ? (
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-violet-500 border-t-transparent motion-reduce:animate-none motion-reduce:border-t-violet-500"
              aria-hidden
            />
            <span className="text-xs font-medium text-[color:var(--sk-accent-on-subtle)]">正在记录情绪…</span>
          </div>
        ) : hint ? (
          <p className="sk-muted text-xs leading-relaxed" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    </section>
  )
}
