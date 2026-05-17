import type { EmotionRecord } from '@sidekick/core'
import { getMoodEntryForDay, localDayKey } from '../state/moodJournalStorage'

export type YesterdayContext = {
  moodLabel?: string
  moodLevel?: number
  notePreview?: string
  dominantEmotion?: string
}

export function localYesterdayDayKey(d = new Date()): string {
  const copy = new Date(d)
  copy.setDate(copy.getDate() - 1)
  return localDayKey(copy)
}

function emotionRecordsForDay(
  records: EmotionRecord[],
  dayKey: string,
): EmotionRecord[] {
  return records.filter((r) => {
    if (!r.createdAt) return false
    const d = new Date(r.createdAt)
    if (Number.isNaN(d.getTime())) return false
    return localDayKey(d) === dayKey
  })
}

export async function buildYesterdayContext(
  emotionRecords: EmotionRecord[],
): Promise<YesterdayContext | null> {
  const y = localYesterdayDayKey()
  const mood = await getMoodEntryForDay(y)
  const emotions = emotionRecordsForDay(emotionRecords, y)
  if (!mood && emotions.length === 0) return null

  const lastEmotion = emotions.length > 0 ? emotions[emotions.length - 1] : undefined
  const note = mood?.note?.trim() ?? ''
  return {
    ...(mood?.moodLabel ? { moodLabel: mood.moodLabel } : {}),
    ...(mood?.moodLevel ? { moodLevel: mood.moodLevel } : {}),
    ...(note ? { notePreview: note.slice(0, 40) } : {}),
    ...(lastEmotion?.emotion ? { dominantEmotion: lastEmotion.emotion } : {}),
  }
}

export function buildYesterdayGreetingText(ctx: YesterdayContext): string {
  const parts: string[] = []
  if (ctx.moodLabel) {
    parts.push(`昨天你记录了「${ctx.moodLabel}」的心情`)
  } else if (ctx.dominantEmotion) {
    parts.push(`昨天你留下过「${ctx.dominantEmotion}」的反馈`)
  }
  if (ctx.notePreview) {
    parts.push(`日记里提到：${ctx.notePreview}`)
  }
  const lead = parts.length > 0 ? `${parts.join('，')}。` : ''
  return `${lead}新的一天，愿你被温柔接住。`
}
