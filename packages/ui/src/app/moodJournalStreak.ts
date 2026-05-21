import { localDayKey, type MoodJournalEntry } from '../state/moodJournalStorage'

export type MoodJournalStreakInfo = {
  current: number
  /** 截至今日连续有日记的天数（含今天若已写） */
  includesToday: boolean
}

function dayKeyOffset(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + deltaDays)
  return localDayKey(dt)
}

export function computeMoodJournalStreak(
  entries: MoodJournalEntry[],
  today = localDayKey(),
): MoodJournalStreakInfo {
  const days = new Set(
    entries
      .map((e) => e.dayKey)
      .filter((k) => typeof k === 'string' && k.length >= 8),
  )
  if (!days.has(today)) {
    let cursor = dayKeyOffset(today, -1)
    let count = 0
    while (days.has(cursor)) {
      count += 1
      cursor = dayKeyOffset(cursor, -1)
    }
    return { current: count, includesToday: false }
  }

  let count = 1
  let cursor = dayKeyOffset(today, -1)
  while (days.has(cursor)) {
    count += 1
    cursor = dayKeyOffset(cursor, -1)
  }
  return { current: count, includesToday: true }
}

export const STREAK_NUDGE_MILESTONES = [3, 7, 14] as const

export function shouldStreakNudgeAfterSave(streak: MoodJournalStreakInfo): boolean {
  if (!streak.includesToday) return false
  return (STREAK_NUDGE_MILESTONES as readonly number[]).includes(streak.current)
}
