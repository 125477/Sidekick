import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import { appendText, type EmotionRecord } from '@sidekick/core'
import { localDayKey } from '../state/moodJournalStorage'
import type { SidekickSettings } from '../state/settingsState'
import {
  canPushNow,
  fetchCompanionCopy,
  persistBailianAgentSessionId,
} from './companionCopy'
import {
  buildYesterdayContext,
  buildYesterdayGreetingText,
  formatYesterdayContextForAgent,
} from './buildYesterdayContext'
import {
  loadLastYesterdayGreetingDayKey,
  saveLastYesterdayGreetingDayKey,
} from '../state/yesterdayGreetingStorage'
import { shouldSkipYesterdayGreetingAfterBootstrap } from './companionFetchCoordinator'
import { isCompanionCopyOnScreen } from './companionCopyOnScreen'
import { shouldDeferExtraProactiveCopy } from './companionSessionBoot'

const BLOCK_SCHEDULED_MS = 4 * 60 * 1000

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
      textId?: string | null
      favorite?: boolean
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
  const blockClearTimerRef = useRef<number | null>(null)

  const clearBlockTimer = () => {
    if (blockClearTimerRef.current != null) {
      window.clearTimeout(blockClearTimerRef.current)
      blockClearTimerRef.current = null
    }
  }

  const scheduleBlockClear = () => {
    clearBlockTimer()
    blockClearTimerRef.current = window.setTimeout(() => {
      blockScheduledPushRef.current = false
      blockClearTimerRef.current = null
    }, BLOCK_SCHEDULED_MS)
  }

  const tryYesterdayGreeting = (_reason: 'day-open' | 'resume') => {
    void (async () => {
      if (!isWidgetMode || !settingsReady) return
      if (blockScheduledPushRef.current || greetingBusyRef.current) return
      if (shouldDeferExtraProactiveCopy()) return
      if (shouldSkipYesterdayGreetingAfterBootstrap()) return
      if (await isCompanionCopyOnScreen()) return
      const s = settingsRef.current
      if (!s.pushEnabled || !canPushNow(s)) return

      const today = localDayKey()
      const last = await loadLastYesterdayGreetingDayKey()
      if (last === today) return

      const ctx = await buildYesterdayContext(emotionRecords)
      if (!ctx) return

      greetingBusyRef.current = true
      blockScheduledPushRef.current = true
      try {
        const yesterdayText = formatYesterdayContextForAgent(ctx)
        let text: string
        try {
          const result = await fetchCompanionCopy(
            s,
            undefined,
            undefined,
            undefined,
            {
              fetchKind: 'startup',
              maxQualityRetries: 0,
              trigger: 'yesterday-greeting',
              yesterdayContextText: yesterdayText,
            },
          )
          await persistBailianAgentSessionId(settingsRef, result.sessionId)
          text = result.text.trim()
          if (!text) return
        } catch {
          text = buildYesterdayGreetingText(ctx)
        }

        const next = await appendText({
          id: `text-${Date.now()}`,
          content: text,
          createdAt: new Date().toISOString(),
          source: 'model',
          favorite: false,
        })
        const newId = next.texts.history[0]?.id
        await showToastMessage(text, {
          dwellSeconds: s.toastAlwaysVisible ? 0 : s.dwellMinutes * 60,
          ...(newId ? { textId: newId, favorite: false } : {}),
        })
        await saveLastYesterdayGreetingDayKey(today)
        scheduleBlockClear()
      } catch {
        blockScheduledPushRef.current = false
        clearBlockTimer()
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
    return () => {
      unsub?.()
      clearBlockTimer()
    }
  }, [isWidgetMode, settingsReady, emotionRecords])
}
