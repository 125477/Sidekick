import { useEffect, useRef } from 'react'
import { getMoodEntryForDay, localDayKey } from '../state/moodJournalStorage'
import { subscribeSettingsSync } from '../state/settingsSync'
import type { SidekickSettings } from '../state/settingsState'

const TICK_MS = 10_000

export function useDailyMoodReminder(
  settings: SidekickSettings,
  settingsReady: boolean,
  runsReminderScheduler: boolean,
  onboardingDone: boolean | null,
): void {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const publishRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!runsReminderScheduler) return
    if (!window.sidekickDesktop?.updateMoodReminderSnapshot) return

    const publish = async () => {
      const s = settingsRef.current
      const day = localDayKey()
      const existing = settingsReady ? await getMoodEntryForDay(day) : null
      window.sidekickDesktop?.updateMoodReminderSnapshot?.({
        settingsReady,
        onboardingComplete: settingsReady && onboardingDone !== false,
        dailyMoodEnabled: s.dailyMoodEnabled,
        dailyMoodReminderEnabled: s.dailyMoodReminderEnabled,
        dailyMoodReminderTime: s.dailyMoodReminderTime,
        hasMoodEntryToday: Boolean(existing),
      })
    }

    publishRef.current = publish

    void publish()
    const intervalId = window.setInterval(() => {
      void publish()
    }, TICK_MS)

    const unsubMainTick = window.sidekickDesktop?.onMoodReminderTick?.(() => {
      void publish()
    })
    const unsubResume = window.sidekickDesktop?.onSystemResume?.(() => {
      void publish()
    })

    return () => {
      window.clearInterval(intervalId)
      unsubMainTick?.()
      unsubResume?.()
      publishRef.current = null
    }
  }, [
    runsReminderScheduler,
    settingsReady,
    onboardingDone,
    settings.dailyMoodEnabled,
    settings.dailyMoodReminderEnabled,
    settings.dailyMoodReminderTime,
  ])

  useEffect(() => {
    if (!runsReminderScheduler || !settingsReady) return
    return subscribeSettingsSync(() => {
      void publishRef.current?.()
    })
  }, [runsReminderScheduler, settingsReady])
}
