import { useCallback, useState } from 'react'

type ToastInterestCaptureRowProps = {
  disabled?: boolean
  onSubmit: (answer: string) => void | Promise<void>
}

/** 气泡 hover 时显示「点击输入」，提交兴趣补充。 */
export function ToastInterestCaptureRow({
  disabled = false,
  onSubmit,
}: ToastInterestCaptureRowProps) {
  const [open, setOpen] = useState(false)
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
      setOpen(false)
      setValue('')
      window.setTimeout(() => setDone(false), 2400)
    } finally {
      setBusy(false)
    }
  }, [value, busy, disabled, onSubmit])

  if (done) {
    return (
      <p className="px-1 py-0.5 text-center text-[11px] text-[color:var(--sk-text-muted)]">
        已记下你的兴趣 ✓
      </p>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        className="w-full cursor-pointer rounded-md px-1 py-1 text-center text-[11px] text-[color:var(--sk-text-muted)] opacity-0 transition-opacity duration-200 group-hover/toastbar-plain:opacity-100 group-hover/toastbar-bubble:opacity-100 group-focus-within/toastbar-plain:opacity-100 group-focus-within/toastbar-bubble:opacity-100 hover:text-[color:var(--sk-accent-on-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) setOpen(true)
        }}
      >
        点击输入
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-0.5 py-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        value={value}
        maxLength={48}
        autoFocus
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
            setOpen(false)
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
