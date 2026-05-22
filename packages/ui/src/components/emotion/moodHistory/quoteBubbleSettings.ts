import type { MoodHistoryQuoteBubbleVariant } from './moodHistoryQuoteBubbleVariants'
import { MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS } from './moodHistoryQuoteBubbleVariants'
import { pickBubbleVariantForBlock } from './moodHistoryNoteLayout'

/** 设置项：自动混排（历史小结）或指定一种气泡样式 */
export type QuoteBubbleDisplayMode = 'auto' | MoodHistoryQuoteBubbleVariant

export const QUOTE_BUBBLE_AUTO: QuoteBubbleDisplayMode = 'auto'

export const QUOTE_BUBBLE_SETTING_OPTIONS: {
  id: QuoteBubbleDisplayMode
  label: string
}[] = [
  { id: 'auto', label: '自动混排' },
  ...MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS.map((v) => ({
    id: v.id as QuoteBubbleDisplayMode,
    label: v.label,
  })),
]

const VALID_VARIANT_IDS = new Set(
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS.map((v) => v.id),
)

export function normalizeQuoteBubbleDisplayMode(
  raw: unknown,
): QuoteBubbleDisplayMode {
  if (raw === 'auto') return 'auto'
  if (typeof raw === 'string' && VALID_VARIANT_IDS.has(raw as MoodHistoryQuoteBubbleVariant)) {
    return raw as MoodHistoryQuoteBubbleVariant
  }
  return 'companion-tail'
}

/** 陪伴气泡：自动 = 标准尾泡；其余 = 所选样式 */
export function resolveCompanionQuoteBubbleVariant(
  mode: QuoteBubbleDisplayMode,
): MoodHistoryQuoteBubbleVariant {
  if (mode === 'auto') return 'companion-tail'
  return mode
}

/** 使用外层 sk-toast-shell 白底 + 尾巴；否则仅展示 MoodHistoryQuoteBubble 样式本身 */
export function usesCompanionToastShell(
  variant: MoodHistoryQuoteBubbleVariant,
): boolean {
  return (
    variant === 'companion-tail' ||
    variant === 'tail-left' ||
    variant === 'tail-right'
  )
}

export function resolveHistoryQuoteBubbleVariant(
  mode: QuoteBubbleDisplayMode,
  index: number,
  total: number,
  text: string,
): MoodHistoryQuoteBubbleVariant {
  if (mode !== 'auto') return mode
  return pickBubbleVariantForBlock(index, total, text)
}

export const QUOTE_BUBBLE_PREVIEW_SAMPLE =
  '偶尔停下来，听听内心的声音。'
