import type { EmotionKind, EmotionRecord } from '../schema/data'

/** 趋势折线：数值越高整体情绪越积极（示意用，非临床量表）。 */
export const EMOTION_TREND_SCORE: Record<EmotionKind, number> = {
  happy: 5,
  calm: 4,
  tired: 3,
  anxious: 2,
  low: 1,
}

function startOfWeekMonday(d: Date): Date {
  const c = new Date(d)
  const day = c.getDay()
  const diff = day === 0 ? -6 : 1 - day
  c.setDate(c.getDate() + diff)
  c.setHours(0, 0, 0, 0)
  return c
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

/**
 * 本周一至周日：每天当日记录的平均分，无记录则为 null（图表可断开）。
 */
export function aggregateEmotionWeek(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const monday = startOfWeekMonday(now)
  const labels = [...WEEKDAY_LABELS]
  const values: Array<number | null> = []

  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i)
    const dayRecords = records.filter((r) =>
      sameLocalDay(new Date(r.createdAt), day),
    )
    if (dayRecords.length === 0) {
      values.push(null)
      continue
    }
    const sum = dayRecords.reduce(
      (s, r) => s + EMOTION_TREND_SCORE[r.emotion],
      0,
    )
    values.push(sum / dayRecords.length)
  }

  return { labels, values }
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * 本地「今天」0–23 时：每小时内反馈条目的均分，无记录为 null。
 */
export function aggregateEmotionDay(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const dayStart = startOfDay(now)
  const labels: string[] = []
  const values: Array<number | null> = []

  for (let h = 0; h < 24; h++) {
    labels.push(`${h}时`)
    const hourStart = new Date(dayStart)
    hourStart.setHours(h, 0, 0, 0)
    const hourEnd = new Date(dayStart)
    hourEnd.setHours(h, 59, 59, 999)

    const hourRecords = records.filter((r) => {
      const t = new Date(r.createdAt)
      return sameLocalDay(t, dayStart) && t >= hourStart && t <= hourEnd
    })
    if (hourRecords.length === 0) {
      values.push(null)
      continue
    }
    const sum = hourRecords.reduce(
      (s, r) => s + EMOTION_TREND_SCORE[r.emotion],
      0,
    )
    values.push(sum / hourRecords.length)
  }

  return { labels, values }
}

/**
 * 从今天往回共 4 段、每段 7 天：左→右为「更早 → 更近」，右端为最近一周。
 */
export function aggregateEmotionMonth(
  records: EmotionRecord[],
  now = new Date(),
): { labels: string[]; values: Array<number | null> } {
  const labels = ['第4周', '第3周', '第2周', '第1周']
  const values: Array<number | null> = []
  const today = startOfDay(now)

  for (let w = 3; w >= 0; w--) {
    const periodEnd = addDays(new Date(today), -(w * 7))
    periodEnd.setHours(23, 59, 59, 999)
    const periodStart = addDays(new Date(today), -(w * 7 + 6))
    periodStart.setHours(0, 0, 0, 0)

    const inPeriod = records.filter((r) => {
      const t = new Date(r.createdAt).getTime()
      return t >= periodStart.getTime() && t <= periodEnd.getTime()
    })
    if (inPeriod.length === 0) {
      values.push(null)
      continue
    }
    const sum = inPeriod.reduce(
      (s, r) => s + EMOTION_TREND_SCORE[r.emotion],
      0,
    )
    values.push(sum / inPeriod.length)
  }

  return { labels, values }
}
