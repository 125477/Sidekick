import { useEffect, useRef, useState } from 'react'

type EmotionQuickFeedbackProps = {
  /** 返回 Promise 时加载层会等到该 Promise 结束（宜只包住本地持久化，不宜包含慢速 AI）。 */
  onSelect: (emotion: string) => void | Promise<void>
}

const EMOTIONS = ['开心', '平静', '焦虑', '低落', '疲惫']

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
      <h3 className="mb-3 text-sm font-medium">现在的情绪是？</h3>
      <div className="flex flex-wrap gap-2">
        {EMOTIONS.map((emotion) => {
          const active = selected === emotion
          return (
            <button
              key={emotion}
              type="button"
              disabled={busy}
              onClick={() => void handleClick(emotion)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                  : 'border-violet-200 text-violet-700 hover:bg-violet-50'
              }`}
            >
              {emotion}
            </button>
          )
        })}
      </div>
      {/**
       * 固定槽高度：避免 busy 时清掉 hint、再用 absolute 遮罩导致整块高度变化，下方「情绪趋势」上下闪动。
       */}
      <div
        className="mt-3 flex min-h-[3.25rem] items-start"
        aria-live="polite"
        aria-busy={busy}
      >
        {busy ? (
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-violet-500 border-t-transparent motion-reduce:animate-none motion-reduce:border-t-violet-500"
              aria-hidden
            />
            <span className="text-xs font-medium text-violet-700">正在记录情绪…</span>
          </div>
        ) : hint ? (
          <p className="text-xs leading-relaxed text-slate-600" role="status">
            {hint}
          </p>
        ) : null}
      </div>
    </section>
  )
}
