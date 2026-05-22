import { MoodHistoryQuoteBubble } from '../emotion/moodHistory/MoodHistoryQuoteBubble'
import {
  QUOTE_BUBBLE_PREVIEW_SAMPLE,
  QUOTE_BUBBLE_SETTING_OPTIONS,
  resolveCompanionQuoteBubbleVariant,
  usesCompanionToastShell,
  type QuoteBubbleDisplayMode,
} from '../emotion/moodHistory/quoteBubbleSettings'

type QuoteBubbleSettingsSectionProps = {
  value: QuoteBubbleDisplayMode
  onChange: (next: QuoteBubbleDisplayMode) => void
}

export function QuoteBubbleSettingsSection({
  value,
  onChange,
}: QuoteBubbleSettingsSectionProps) {
  const previewVariant = resolveCompanionQuoteBubbleVariant(value)
  const previewUsesShell = usesCompanionToastShell(previewVariant)

  return (
    <div className="grid gap-3">
      <p className="sk-muted text-sm leading-relaxed">
        陪伴推送与点精灵时的短句气泡样式；选「自动混排」时，历史小结详情仍按段落自动搭配多种样式。
      </p>

      <div
        className={`flex justify-center px-4 py-5 ${
          previewUsesShell
            ? 'rounded-[var(--sk-radius-card)] border border-[color:var(--sk-callout-border)] bg-[color:var(--sk-card-bg)]'
            : ''
        }`}
      >
        <div className="w-full max-w-[17rem]">
          <MoodHistoryQuoteBubble variant={previewVariant}>
            {QUOTE_BUBBLE_PREVIEW_SAMPLE}
          </MoodHistoryQuoteBubble>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUOTE_BUBBLE_SETTING_OPTIONS.map((opt) => {
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              className={`sk-chip ${active ? 'sk-chip-active' : ''}`}
              aria-pressed={active}
              onClick={() => onChange(opt.id)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
