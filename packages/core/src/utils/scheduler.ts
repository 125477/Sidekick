export type SchedulerConfig = {
  enabled: boolean
  intervalMinutes: number
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
}

function parseTime(input: string): number {
  const [hourRaw, minuteRaw] = input.split(':')
  const hour = Number(hourRaw ?? 0)
  const minute = Number(minuteRaw ?? 0)
  return hour * 60 + minute
}

/** 本地时区：当前时刻是否落在 [start, end) 内；跨午夜区间（如 20:00–06:00）按环状处理。 */
export function isWithinScheduledInterval(
  now: Date,
  start: string,
  end: string,
): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = parseTime(start)
  const endMinutes = parseTime(end)

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

export function isWithinQuietHours(now: Date, config: SchedulerConfig): boolean {
  if (!config.quietHoursEnabled) return false
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = parseTime(config.quietStart)
  const endMinutes = parseTime(config.quietEnd)

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes
}

export function shouldDispatchPush(now: Date, config: SchedulerConfig): boolean {
  if (!config.enabled) return false
  if (config.intervalMinutes < 1 || config.intervalMinutes > 60) return false
  if (isWithinQuietHours(now, config)) return false
  return true
}
