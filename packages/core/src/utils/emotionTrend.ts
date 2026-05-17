import type { EmotionKind, EmotionRecord } from '../schema/data'

/** 趋势折线：数值越高整体情绪越积极（示意用，非临床量表）。 */
export const EMOTION_TREND_SCORE: Record<EmotionKind, number> = {
  happy: 5,
  calm: 4,
  tired: 3,
  anxious: 2,
  low: 1,
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function averageScore(records: EmotionRecord[]): number {
  const sum = records.reduce((s, r) => s + EMOTION_TREND_SCORE[r.emotion], 0)
  return sum / records.length
}

function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 「日」：最近 7 个自然日（含今天），每天一条均分，无记录为 null。
 */
export function aggregateEmotionDay(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const today = startOfDay(now)
  const labels: string[] = []
  const values: Array<number | null> = []

  for (let i = 6; i >= 0; i--) {
    const day = addDays(today, -i)
    labels.push(formatShortDate(day))
    const dayRecords = records.filter((r) =>
      sameLocalDay(new Date(r.createdAt), day),
    )
    values.push(dayRecords.length === 0 ? null : averageScore(dayRecords))
  }

  return { labels, values }
}

function monthWeekRanges(year: number, month: number): Array<[number, number]> {
  const last = new Date(year, month + 1, 0).getDate()
  return [
    [1, Math.min(7, last)],
    [8, Math.min(14, last)],
    [15, Math.min(21, last)],
    [22, last],
  ]
}

/**
 * 「周」：当前自然月内按 4 段周汇总（约每 7 天一段）。
 */
export function aggregateEmotionWeek(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const year = now.getFullYear()
  const month = now.getMonth()
  const labels = ['第1周', '第2周', '第3周', '第4周']
  const values: Array<number | null> = []

  for (const [startDay, endDay] of monthWeekRanges(year, month)) {
    const periodStart = new Date(year, month, startDay, 0, 0, 0, 0)
    const periodEnd = new Date(year, month, endDay, 23, 59, 59, 999)
    const inPeriod = records.filter((r) => {
      const t = new Date(r.createdAt).getTime()
      return t >= periodStart.getTime() && t <= periodEnd.getTime()
    })
    values.push(inPeriod.length === 0 ? null : averageScore(inPeriod))
  }

  return { labels, values }
}

/**
 * 「月」：最近 12 个自然月（含本月），每月均分，无记录为 null。
 */
export function aggregateEmotionMonth(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const labels: string[] = []
  const values: Array<number | null> = []

  for (let offset = 11; offset >= 0; offset--) {
    const monthAnchor = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const y = monthAnchor.getFullYear()
    const m = monthAnchor.getMonth()
    labels.push(`${m + 1}月`)
    const periodStart = new Date(y, m, 1, 0, 0, 0, 0)
    const periodEnd = new Date(y, m + 1, 0, 23, 59, 59, 999)
    const inPeriod = records.filter((r) => {
      const t = new Date(r.createdAt).getTime()
      return t >= periodStart.getTime() && t <= periodEnd.getTime()
    })
    values.push(inPeriod.length === 0 ? null : averageScore(inPeriod))
  }

  return { labels, values }
}
