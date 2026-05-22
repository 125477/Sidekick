import type { MoodHistoryQuoteBubbleVariant } from './moodHistoryQuoteBubbleVariants'

/** 将日记正文拆成若干展示块（段落优先，过长单段再按句切） */
export function splitNoteIntoDisplayBlocks(note: string): string[] {
  const t = note.trim()
  if (!t) return []

  const paragraphs = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length > 1) return paragraphs

  if (t.length <= 48) return [t]

  const sentences = t
    .split(/(?<=[。！？；])/u)
    .map((s) => s.trim())
    .filter(Boolean)

  if (
    sentences.length > 1 &&
    sentences.every((s) => s.length <= 80) &&
    sentences.length <= 8
  ) {
    return sentences
  }

  return [t]
}

/** 详情页气泡轮换（含用户参考稿样式） */
const DETAIL_BUBBLE_ROTATION: MoodHistoryQuoteBubbleVariant[] = [
  'border-card',
  'lavender-block',
  'soft-violet',
  'highlight-wash',
  'watercolor-wash',
  'quote-bar',
  'underline-accent',
  'inset-card',
  'gradient-ring',
  'whisper-dashed',
  'nested-echo',
]

export function pickBubbleVariantForBlock(
  index: number,
  total: number,
  text: string,
): MoodHistoryQuoteBubbleVariant {
  const len = text.replace(/\s/g, '').length

  if (len <= 14) return 'pill-solid'
  if (index === 0 && len > 36) return 'editorial-wide'
  if (index === total - 1 && total > 1) {
    return len <= 28 ? 'arc-diamond' : 'closing-stamp'
  }

  return DETAIL_BUBBLE_ROTATION[(index + len) % DETAIL_BUBBLE_ROTATION.length]!
}

export function formatMoodHistoryMetaLine(
  dayKey: string,
  createdAt: string,
): string {
  let timePart = ''
  try {
    const d = new Date(createdAt)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const day = d.getDate()
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      timePart = `${y}年${m}月${day}日 ${hh}:${mm}`
    }
  } catch {
    /* ignore */
  }
  if (!timePart && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    const [y, m, d] = dayKey.split('-').map(Number)
    timePart = `${y}年${m}月${d}日`
  }
  return timePart ? `日记 · ${timePart}` : `日记 · ${dayKey}`
}

/** 详情顶栏用：仅日期时间，不含「日记 ·」前缀 */
export function formatMoodHistoryDateLabel(
  dayKey: string,
  createdAt: string,
): string {
  return formatMoodHistoryMetaLine(dayKey, createdAt).replace(/^日记 · /u, '')
}

/** 详情标题：首句/首行摘要，否则默认 */
export function moodHistoryDetailTitle(note: string): string {
  const t = note.trim()
  if (!t) return '今日小结'
  const firstLine = t.split(/\n/)[0]?.trim() ?? t
  if (firstLine.length <= 28) return firstLine
  return `${firstLine.slice(0, 28)}…`
}
