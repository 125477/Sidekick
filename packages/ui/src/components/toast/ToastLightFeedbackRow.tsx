import { useEffect, useRef, useState } from 'react'
import {
  clearLightFeedbackForMessage,
  getLightFeedbackForMessage,
} from '../../app/companionLightFeedbackStorage'
import {
  submitCompanionLightFeedback,
  type LightFeedbackKind,
} from '../../app/companionLightFeedbackSubmit'
import { SIDEKICK_MORE_FEATURES_PLACEHOLDER } from '../../constants/toastCopy'
import { toastLightFeedbackChipClass } from '../emotion/emotionChips'

type ToastLightFeedbackRowProps = {
  message: string
  disabled?: boolean
  centered?: boolean
}

const CHIPS: { kind: LightFeedbackKind; label: string }[] = [
  { kind: 'like', label: '喜欢' },
  { kind: 'neutral', label: '一般' },
  { kind: 'less', label: '少推这类' },
]

const HINT_OK_MS = 2600
const HINT_ERR_MS = 5000

export function ToastLightFeedbackRow({
  message,
  disabled = false,
  centered = false,
}: ToastLightFeedbackRowProps) {
  const [busyKind, setBusyKind] = useState<LightFeedbackKind | null>(null)
  const [selectedKind, setSelectedKind] = useState<LightFeedbackKind | null>(
    null,
  )
  const [hint, setHint] = useState<string | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trimmed = message.trim()

  useEffect(() => {
    setBusyKind(null)
    setHint(null)
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    const stored = getLightFeedbackForMessage(trimmed)
    setSelectedKind(stored?.kind ?? null)
  }, [trimmed])

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  function scheduleHintHide(ms: number) {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    hintTimerRef.current = setTimeout(() => {
      setHint(null)
      hintTimerRef.current = null
    }, ms)
  }

  if (
    !trimmed ||
    trimmed === SIDEKICK_MORE_FEATURES_PLACEHOLDER ||
    trimmed.length < 2
  ) {
    return null
  }

  async function onPick(kind: LightFeedbackKind) {
    if (disabled || busyKind !== null) return

    if (selectedKind === kind) {
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
      clearLightFeedbackForMessage(trimmed)
      setSelectedKind(null)
      setHint('已取消反馈')
      scheduleHintHide(HINT_OK_MS)
      return
    }

    if (selectedKind !== null) return

    setBusyKind(kind)
    setHint(null)
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    try {
      await submitCompanionLightFeedback({ message: trimmed, kind })
      setSelectedKind(kind)
      setHint('已记录，后续陪伴句会参考你的偏好')
      scheduleHintHide(HINT_OK_MS)
    } catch {
      setHint('反馈失败，请检查通义 API 配置')
      scheduleHintHide(HINT_ERR_MS)
    } finally {
      setBusyKind(null)
    }
  }

  function chipDisabled(kind: LightFeedbackKind): boolean {
    if (disabled || busyKind !== null) return true
    if (selectedKind !== null && selectedKind !== kind) return true
    return false
  }

  function chipHighlighted(kind: LightFeedbackKind): boolean {
    return selectedKind === kind || busyKind === kind
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 border-t border-slate-100/90 px-0.5 py-1 [-webkit-app-region:no-drag]">
      <div
        className={`flex flex-row flex-wrap items-center gap-1 ${centered ? 'justify-center' : ''}`}
      >
        {CHIPS.map(({ kind, label }) => {
          const loading = busyKind === kind
          return (
            <button
              key={kind}
              type="button"
              disabled={chipDisabled(kind)}
              aria-pressed={chipHighlighted(kind)}
              aria-busy={loading}
              onClick={(e) => {
                e.stopPropagation()
                void onPick(kind)
              }}
              className={toastLightFeedbackChipClass(chipHighlighted(kind))}
            >
              <span className="inline-flex items-center gap-1">
                <span>{label}</span>
                {loading ? (
                  <>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent will-change-transform motion-safe:animate-spin motion-reduce:animate-pulse motion-reduce:border-t-current"
                      aria-hidden
                    />
                    <span className="sr-only">提交中</span>
                  </>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
      {hint ? (
        <p className="text-[10px] leading-snug text-slate-500" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
