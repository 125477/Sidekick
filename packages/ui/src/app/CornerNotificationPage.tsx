import { useCallback, useEffect, useRef, useState } from 'react'

const EXIT_MS = 220

const KEYFRAMES = `
  @keyframes sk-corner-enter {
    from { opacity: 0; transform: translateY(24px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes sk-corner-exit {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(16px) scale(0.98); }
  }
`

type CornerNotificationPageProps = {
  title: string
  message: string
}

export function CornerNotificationPage({
  title,
  message,
}: CornerNotificationPageProps) {
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter')
  const closingRef = useRef(false)

  const dismiss = useCallback(async () => {
    if (closingRef.current) return
    closingRef.current = true
    setPhase('exit')
    window.setTimeout(() => {
      void window.sidekickDesktop?.hideCornerNotification?.()
    }, EXIT_MS)
  }, [])

  const openTarget = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setPhase('exit')
    window.setTimeout(() => {
      void window.sidekickDesktop?.openCornerNotificationTarget?.()
    }, EXIT_MS)
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('sidekick-corner-notification-root')
    document.body.classList.add('sidekick-corner-notification-root')
    return () => {
      document.documentElement.classList.remove('sidekick-corner-notification-root')
      document.body.classList.remove('sidekick-corner-notification-root')
    }
  }, [])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPhase('idle')
    } else {
      const id = window.setTimeout(() => setPhase('idle'), 280)
      return () => window.clearTimeout(id)
    }
  }, [])

  const motionClass =
    phase === 'enter'
      ? 'motion-safe:animate-[sk-corner-enter_280ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:opacity-100'
      : phase === 'exit'
        ? 'motion-safe:animate-[sk-corner-exit_220ms_cubic-bezier(0.4,0,1,1)_both] motion-reduce:opacity-0'
        : ''

  return (
    <main className="box-border flex h-full w-full overflow-hidden items-stretch bg-transparent p-0 [-webkit-app-region:no-drag]">
      <style>{KEYFRAMES}</style>
      <article
        role="status"
        aria-live="polite"
        className={`flex h-full w-full min-h-0 items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-3.5 shadow-[0_4px_14px_-6px_rgba(15,23,42,0.10)] [-webkit-app-region:no-drag] ${motionClass}`}
      >
        <img
          src="./app-icon.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h1 className="text-[13px] font-semibold leading-tight text-slate-900">
              {title}
            </h1>
            <button
              type="button"
              aria-label="关闭"
              className="sk-toast-clickable inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
              onClick={() => void dismiss()}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-[13px] leading-snug text-slate-600">{message}</p>
          <button
            type="button"
            className="sk-toast-clickable -ml-1.5 mt-2 inline-flex cursor-pointer items-center rounded-md px-1.5 py-1 text-[12px] font-semibold text-violet-600 underline-offset-2 transition-colors hover:bg-violet-50 hover:text-violet-700 hover:underline active:bg-violet-100"
            onClick={() => void openTarget()}
          >
            去写小结 →
          </button>
        </div>
      </article>
    </main>
  )
}
