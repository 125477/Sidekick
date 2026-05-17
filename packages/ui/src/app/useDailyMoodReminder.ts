import { useEffect, useRef } from 'react'
import { getMoodEntryForDay, localDayKey } from '../state/moodJournalStorage'
import type { SidekickSettings } from '../state/settingsState'

function parseHm(hm: string): { h: number; m: number } | null {
  const parts = hm.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return { h, m }
}

export function useDailyMoodReminder(
  settings: SidekickSettings,
  settingsReady: boolean,
  runsInWidget: boolean,
  onboardingDone: boolean | null,
): void {
  const lastFiredDayRef = useRef<string | null>(null)

  useEffect(() => {
    if (!settingsReady || !runsInWidget || onboardingDone !== true) return
    if (!settings.dailyMoodEnabled || !settings.dailyMoodReminderEnabled) return
    const show = window.sidekickDesktop?.showSystemNotification
    if (!show) return

    const target = parseHm(settings.dailyMoodReminderTime)
    if (!target) return

    const tick = async () => {
      const now = new Date()
      const day = localDayKey(now)
      if (lastFiredDayRef.current === day) return
      if (now.getHours() !== target.h || now.getMinutes() !== target.m) return

      const existing = await getMoodEntryForDay(day)
      if (existing) {
        lastFiredDayRef.current = day
        return
      }

      const ok = await show({
        title: 'Sidekick · 今日心情',
        body: '花一分钟记下今天的心情与日记吧。',
        panel: 'emotion',
        emotionTab: 'summary',
      })
      if (ok) lastFiredDayRef.current = day
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 45_000)
    return () => window.clearInterval(id)
  }, [
    settingsReady,
    runsInWidget,
    onboardingDone,
    settings.dailyMoodEnabled,
    settings.dailyMoodReminderEnabled,
    settings.dailyMoodReminderTime,
  ])
}
