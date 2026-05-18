import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { EmotionRecord } from '@sidekick/core'
import { localDayKey } from '../state/moodJournalStorage'
import type { SidekickSettings } from '../state/settingsState'
import { canPushNow } from './companionCopy'
import {
  buildYesterdayContext,
  buildYesterdayGreetingText,
} from './buildYesterdayContext'
import {
  loadLastYesterdayGreetingDayKey,
  saveLastYesterdayGreetingDayKey,
} from '../state/yesterdayGreetingStorage'

export type UseYesterdayEmotionGreetingArgs = {
  isWidgetMode: boolean
  settingsReady: boolean
  settingsRef: MutableRefObject<SidekickSettings>
  emotionRecords: EmotionRecord[]
  blockScheduledPushRef: MutableRefObject<boolean>
  showToastMessage: (
    message: string,
    opts?: {
      dwellSeconds?: number
      toastMode?: 'normal' | 'intro'
    },
  ) => Promise<void>
}

export function useYesterdayEmotionGreeting({
  isWidgetMode,
  settingsReady,
  settingsRef,
  emotionRecords,
  blockScheduledPushRef,
  showToastMessage,
}: UseYesterdayEmotionGreetingArgs) {
  const greetingBusyRef = useRef(false)

  const tryYesterdayGreeting = (_reason: 'day-open' | 'resume') => {
    void (async () => {
      if (!isWidgetMode || !settingsReady) return
      if (blockScheduledPushRef.current || greetingBusyRef.current) return
      const s = settingsRef.current
      if (!canPushNow(s)) return

      const today = localDayKey()
      const last = await loadLastYesterdayGreetingDayKey()
      if (last === today) return

      const ctx = await buildYesterdayContext(emotionRecords)
      if (!ctx) return

      greetingBusyRef.current = true
      try {
        const text = buildYesterdayGreetingText(ctx)
        await showToastMessage(text, {
          dwellSeconds: s.toastAlwaysVisible ? 0 : s.dwellMinutes * 60,
        })
        await saveLastYesterdayGreetingDayKey(today)
      } finally {
        greetingBusyRef.current = false
      }
    })()
  }

  useEffect(() => {
    if (!isWidgetMode || !settingsReady) return
    const t = window.setTimeout(() => tryYesterdayGreeting('day-open'), 1200)
    return () => window.clearTimeout(t)
  }, [isWidgetMode, settingsReady, emotionRecords])

  useEffect(() => {
    if (!isWidgetMode) return
    const unsub = window.sidekickDesktop?.onSystemResume?.(() => {
      tryYesterdayGreeting('resume')
    })
    return () => unsub?.()
  }, [isWidgetMode, settingsReady, emotionRecords])
}
