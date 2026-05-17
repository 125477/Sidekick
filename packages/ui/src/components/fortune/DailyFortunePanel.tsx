import { useCallback, useEffect, useRef, useState } from 'react'
import {
  commitTodayLotteryDraw,
  loadData,
  localCalendarDate,
  redrawTodayLotteryDraw,
  type DailyLotteryDraw,
} from '@sidekick/core'

const tierTone: Record<
  DailyLotteryDraw['tier'],
  { label: string; className: string }
> = {
  上上签: { label: '上上签', className: 'text-rose-600' },
  上签: { label: '上签', className: 'text-amber-600' },
  中上签: { label: '中上签', className: 'text-violet-600' },
  中签: { label: '中签', className: 'text-slate-600' },
  中下签: { label: '中下签', className: 'text-slate-500' },
  下签: { label: '下签', className: 'text-slate-500' },
}

type Phase = 'ready' | 'shaking' | 'result'

const SHAKE_MS = 1200

type DailyFortunePanelProps = {
  /** 独立 panel / 全屏层：纵向占满父级，主内容区垂直居中。 */
  fillAvailable?: boolean
}

export function DailyFortunePanel({ fillAvailable = false }: DailyFortunePanelProps) {
  const [draw, setDraw] = useState<DailyLotteryDraw | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  const refreshFromStorage = useCallback(async () => {
    const data = await loadData()
    const day = localCalendarDate()
    const last = data.lottery.lastDraw
    if (last?.date === day) {
      setDraw(last)
      setPhase('result')
    } else {
      setDraw(null)
      setPhase('ready')
    }
    setError(null)
  }, [])

  useEffect(() => {
    void refreshFromStorage()
  }, [refreshFromStorage])

  const runAnimatedDraw = useCallback(
    async (fetchDraw: () => Promise<DailyLotteryDraw>) => {
      if (busyRef.current) return
      busyRef.current = true
      setError(null)
      setPhase('shaking')
      await new Promise((r) => window.setTimeout(r, SHAKE_MS))
      try {
        const next = await fetchDraw()
        setDraw(next)
        setPhase('result')
      } catch {
        await refreshFromStorage()
        setError('抽签失败，请稍后再试。')
      } finally {
        busyRef.current = false
      }
    },
    [refreshFromStorage],
  )

  const startDraw = useCallback(() => {
    void runAnimatedDraw(() => commitTodayLotteryDraw())
  }, [runAnimatedDraw])

  const redrawDraw = useCallback(() => {
    void runAnimatedDraw(() => redrawTodayLotteryDraw())
  }, [runAnimatedDraw])

  const tone = draw ? tierTone[draw.tier] : null
  const showResult = phase === 'result' && draw
  const shaking = phase === 'shaking'

  const mainCol = fillAvailable
    ? 'flex flex-1 flex-col items-center justify-center gap-8 py-4 min-h-0'
    : 'flex flex-col items-center gap-6 py-2'

  return (
    <div
      className={`text-slate-800 ${fillAvailable ? 'flex min-h-0 flex-1 flex-col' : ''}`}
    >
      <style>{`
        @keyframes fortune-shake {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          20% { transform: rotate(6deg) translateY(-3px); }
          40% { transform: rotate(-4deg) translateY(2px); }
          60% { transform: rotate(5deg) translateY(-2px); }
          80% { transform: rotate(-3deg) translateY(1px); }
        }
        @keyframes fortune-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.35); }
          50% { box-shadow: 0 0 24px 4px rgba(139, 92, 246, 0.25); }
        }
        @keyframes fortune-reveal {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fortune-tube-shake {
          animation: fortune-shake 0.14s ease-in-out infinite;
        }
        .fortune-tube-glow {
          animation: fortune-glow 0.8s ease-in-out infinite;
        }
        .fortune-reveal-elm {
          animation: fortune-reveal 420ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .fortune-tube-shake, .fortune-tube-glow, .fortune-reveal-elm {
            animation: none !important;
          }
        }
      `}</style>

      <p className={`text-sm text-slate-600 ${fillAvailable ? 'shrink-0' : 'mb-4'}`}>
        娱乐向小仪式 · 同一自然日内以<strong className="font-medium text-slate-700">最后一次</strong>
        签文为准 · 今日{' '}
        <span className="font-medium text-slate-700">{localCalendarDate()}</span>
      </p>

      <div className={mainCol}>
        <div
          className={`relative flex h-36 w-28 flex-col items-center justify-end rounded-2xl border-2 border-violet-300 bg-gradient-to-b from-violet-100 to-violet-50 px-2 pb-3 transition-opacity ${
            shaking ? 'fortune-tube-shake fortune-tube-glow' : ''
          } ${showResult ? 'opacity-90' : ''}`}
          aria-hidden
        >
          <div className="absolute inset-x-2 top-2 h-8 rounded-lg bg-violet-200/80" />
          <div className="mb-1 flex gap-0.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                className="h-10 w-1 rounded-full bg-amber-700/85 shadow-sm"
                style={{ transform: `rotate(${(i - 3) * 4}deg)` }}
              />
            ))}
          </div>
          <span className="text-[10px] font-medium tracking-widest text-violet-800/80">
            签筒
          </span>
        </div>

        {error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : null}

        {showResult ? (
          <div className="flex w-full max-w-md flex-col items-center gap-3">
            <div className="fortune-reveal-elm w-full rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-center">
              <span
                className={`inline-block rounded-full border px-3 py-1 text-sm font-semibold ${tone?.className ?? ''} border-current/20 bg-white`}
              >
                {tone?.label}
              </span>
              <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-800">
                {draw.verse}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{draw.hint}</p>
            </div>
            <button
              type="button"
              disabled={shaking}
              onClick={redrawDraw}
              className="cursor-pointer rounded-xl border border-violet-200 bg-white px-5 py-2 text-sm font-medium text-violet-800 shadow-sm transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              重新抽签
            </button>
          </div>
        ) : phase === 'ready' ? (
          <div className="flex max-w-md flex-col items-center gap-3 text-center">
            <p className="text-sm text-slate-600">
              诚心一念，点击求签。结果仅作心情参考。
            </p>
            <button
              type="button"
              onClick={startDraw}
              className="cursor-pointer rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
            >
              求签
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium text-violet-700 motion-reduce:hidden">
            摇签中…
          </p>
        )}
      </div>
    </div>
  )
}
