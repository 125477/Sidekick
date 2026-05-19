/** 「此刻」与「今日小结」共用的心情标签。 */
export const EMOTION_CHIP_LABELS = [
  '开心',
  '愉快',
  '平静',
  '感动',
  '疲惫',
  '焦虑',
  '烦躁',
  '低落',
] as const

export type EmotionChipLabel = (typeof EMOTION_CHIP_LABELS)[number]

export const EMOTION_LABEL_TO_MOOD_LEVEL: Record<
  EmotionChipLabel,
  1 | 2 | 3 | 4 | 5
> = {
  开心: 5,
  愉快: 5,
  平静: 4,
  感动: 4,
  疲惫: 3,
  焦虑: 2,
  烦躁: 2,
  低落: 1,
}

const LEVEL_TO_LABEL: Record<number, EmotionChipLabel> = {
  5: '开心',
  4: '平静',
  3: '疲惫',
  2: '焦虑',
  1: '低落',
}

export function moodLevelToChipLabel(level: number): EmotionChipLabel {
  return LEVEL_TO_LABEL[level] ?? '开心'
}

export function isEmotionChipLabel(label: string): label is EmotionChipLabel {
  return (EMOTION_CHIP_LABELS as readonly string[]).includes(label)
}

export function moodEntryDisplayLabel(entry: {
  moodLevel: number
  moodLabel?: string
}): EmotionChipLabel {
  if (entry.moodLabel && isEmotionChipLabel(entry.moodLabel)) {
    return entry.moodLabel
  }
  return moodLevelToChipLabel(entry.moodLevel)
}

export function emotionChipButtonClass(active: boolean): string {
  return `sk-emotion-chip ${active ? 'sk-emotion-chip--active' : ''} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sk-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60`
}

/** 陪伴气泡轻反馈：比情绪面板 chip 更小、更弱，不抢正文。 */
export function toastLightFeedbackChipClass(active: boolean): string {
  return `sk-toast-clickable sk-toast-chip rounded-full px-2 py-0.5 text-[11px] leading-tight focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--sk-focus-ring)] disabled:opacity-50 ${
    active ? 'sk-toast-chip--active' : ''
  }`
}
