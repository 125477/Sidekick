import { useState } from 'react'
import {
  submitCompanionLightFeedback,
  type LightFeedbackKind,
} from '../../app/companionLightFeedbackSubmit'
import { SIDEKICK_MORE_FEATURES_PLACEHOLDER } from '../../constants/toastCopy'
import { toastLightFeedbackChipClass } from '../emotion/emotionChips'

type ToastLightFeedbackRowProps = {
  message: string
  disabled?: boolean
}

const CHIPS: { kind: LightFeedbackKind; label: string }[] = [
  { kind: 'like', label: '喜欢' },
  { kind: 'neutral', label: '一般' },
  { kind: 'less', label: '少推这类' },
]

export function ToastLightFeedbackRow({
  message,
  disabled = false,
}: ToastLightFeedbackRowProps) {
  const [busyKind, setBusyKind] = useState<LightFeedbackKind | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  const trimmed = message.trim()
  if (
    !trimmed ||
    trimmed === SIDEKICK_MORE_FEATURES_PLACEHOLDER ||
    trimmed.length < 2
  ) {
    return null
  }

  async function onPick(kind: LightFeedbackKind) {
    if (disabled || busyKind) return
    setBusyKind(kind)
    setHint(null)
    try {
      await submitCompanionLightFeedback({ message: trimmed, kind })
      setHint('已记录，后续陪伴句会参考你的偏好')
    } catch {
      setHint('反馈失败，请检查通义 API 配置')
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 border-t border-slate-100/90 px-0.5 py-1 [-webkit-app-region:no-drag]">
      <div className="flex flex-row flex-wrap items-center gap-1">
        {CHIPS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            disabled={disabled || busyKind !== null}
            onClick={(e) => {
              e.stopPropagation()
              void onPick(kind)
            }}
            className={toastLightFeedbackChipClass(busyKind === kind)}
          >
            {busyKind === kind ? '\u2026' : label}
          </button>
        ))}
      </div>
      {hint ? (
        <p className="text-[10px] leading-snug text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
