import { localDayKey } from './moodJournalStorage'

const KEY = 'sidekick.moodJournalGuide.v1'

export type MoodJournalGuideCache = {
  dayKey: string
  moodLabel: string
  questions: string[]
}

function readAll(): Record<string, MoodJournalGuideCache> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, MoodJournalGuideCache> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue
      const row = v as MoodJournalGuideCache
      if (
        typeof row.dayKey !== 'string' ||
        typeof row.moodLabel !== 'string' ||
        !Array.isArray(row.questions)
      ) {
        continue
      }
      const questions = row.questions
        .filter((q): q is string => typeof q === 'string')
        .map((q) => q.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      if (questions.length === 0) continue
      out[k] = { dayKey: row.dayKey, moodLabel: row.moodLabel, questions }
    }
    return out
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, MoodJournalGuideCache>): void {
  localStorage.setItem(KEY, JSON.stringify(map))
}

/** 按本地日历日读取缓存；日期不符时返回 null。 */
export function loadMoodJournalGuideForDay(
  dayKey = localDayKey(),
): string[] | null {
  const row = readAll()[dayKey]
  if (!row || row.dayKey !== dayKey) return null
  return row.questions.length > 0 ? row.questions : null
}

export function saveMoodJournalGuideForDay(
  questions: string[],
  moodLabel: string,
  dayKey = localDayKey(),
): void {
  const list = questions
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (list.length === 0) return
  const map = readAll()
  map[dayKey] = { dayKey, moodLabel, questions: list }
  writeAll(map)
}

export function clearMoodJournalGuideForDay(dayKey = localDayKey()): void {
  const map = readAll()
  delete map[dayKey]
  writeAll(map)
}
