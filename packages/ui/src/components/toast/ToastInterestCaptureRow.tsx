import { useCallback, useState } from 'react'
import { COMPANION_INTEREST_ANSWER_MAX_CHARS } from '../../constants/companionInterestTags'

type ToastInterestCaptureRowProps = {
  disabled?: boolean
  onSubmit: (answer: string) => void | Promise<void>
}

const interestRowClass = 'flex items-center gap-1.5 px-1 pb-1 pt-0.5'

/** 问答模式（VITE_SIDEKICK_COMPANION_QA_MODE=1）下直接展示输入框，提交兴趣补充。 */
export function ToastInterestCaptureRow({
  disabled = false,
  onSubmit,
}: ToastInterestCaptureRowProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = useCallback(async () => {
    const trimmed = value.replace(/\s+/g, ' ').trim()
    if (!trimmed || busy || disabled) return
    setBusy(true)
    try {
      await onSubmit(trimmed)
      setDone(true)
      setValue('')
      window.setTimeout(() => setDone(false), 2400)
    } finally {
      setBusy(false)
    }
  }, [value, busy, disabled, onSubmit])

  if (done) {
    return (
      <p className="px-1 pb-1 pt-0.5 text-center text-[11px] text-[color:var(--sk-text-muted)]">
        已记下你的兴趣 ✓
      </p>
    )
  }

  return (
    <div className={interestRowClass} onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        maxLength={COMPANION_INTEREST_ANSWER_MAX_CHARS}
        placeholder="补充一点你的兴趣或状态…"
        disabled={busy || disabled}
        className="sk-input min-w-0 flex-1 py-1 text-xs"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setValue('')
          }
        }}
      />
      <button
        type="button"
        disabled={busy || disabled || !value.trim()}
        className="sk-btn-primary shrink-0 px-2 py-1 text-xs"
        onClick={() => void submit()}
      >
        提交
      </button>
    </div>
  )
}
