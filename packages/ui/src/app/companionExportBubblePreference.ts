import {
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS,
  type MoodHistoryQuoteBubbleVariant,
} from '../components/emotion/moodHistory/moodHistoryQuoteBubbleVariants'

const STORAGE_KEY = 'sidekick.companion.export.bubble.v1'

/** 导出卡片默认样式：列表第一项「紫框白底」。 */
export const DEFAULT_COMPANION_EXPORT_BUBBLE_VARIANT =
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS[0]!.id

const VALID_IDS = new Set(
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS.map((v) => v.id),
)

export function readCompanionExportBubbleVariant(): MoodHistoryQuoteBubbleVariant {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_COMPANION_EXPORT_BUBBLE_VARIANT
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim()
    if (raw && VALID_IDS.has(raw as MoodHistoryQuoteBubbleVariant)) {
      return raw as MoodHistoryQuoteBubbleVariant
    }
  } catch {
    /* noop */
  }
  return DEFAULT_COMPANION_EXPORT_BUBBLE_VARIANT
}

export function saveCompanionExportBubbleVariant(
  variant: MoodHistoryQuoteBubbleVariant,
): void {
  if (!VALID_IDS.has(variant)) return
  try {
    localStorage.setItem(STORAGE_KEY, variant)
  } catch {
    /* noop */
  }
}
