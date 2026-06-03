import type { EmotionRecord } from '@sidekick/core'
import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState } from '../state/uiState'
import {
  formatFocusEndMoment,
  formatUnlockMoment,
  pushProactiveCompanionCopy,
} from './companionProactivePush'
import { isCompanionCopyOnScreen } from './companionCopyOnScreen'
import {
  canFireFocusEndRitual,
  canFireInterestDeepen,
  markFocusEndRitualFired,
  markInterestDeepenFired,
  markUnlockRitualFired,
} from '../state/companionProactiveStorage'
import { localDayKey } from '../state/moodJournalStorage'
import { shouldDeferExtraProactiveCopy } from './companionSessionBoot'

const INTEREST_DEEPEN_HOURS = [10, 15] as const

export type UseCompanionRitualsArgs = {
  isWidgetMode: boolean
  settingsReady: boolean
  settings: SidekickSettings
  settingsRef: MutableRefObject<SidekickSettings>
  emotionRecords: EmotionRecord[]
  onboardingDone: boolean | null
  blockScheduledPushRef: MutableRefObject<boolean>
  recentCompanionLinesRef: MutableRefObject<string[]>
  widgetMeasureRef: MutableRefObject<HTMLDivElement | null>
  showToastMessage: (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string
      favorite?: boolean
    },
  ) => Promise<void>
  setToastMeta?: (meta: { id: string; favorite: boolean } | null) => void
  setSpriteState?: (state: SpriteState) => void
  toastVisible?: boolean
  lastShownToastMessageRef?: MutableRefObject<string>
}

export function useCompanionRituals({
  isWidgetMode,
  settingsReady,
  settings,
  settingsRef,
  emotionRecords,
  onboardingDone,
  blockScheduledPushRef,
  recentCompanionLinesRef,
  widgetMeasureRef,
  showToastMessage,
  setToastMeta,
  setSpriteState,
  toastVisible,
  lastShownToastMessageRef,
}: UseCompanionRitualsArgs) {
  const unlockBusyRef = useRef(false)
  const focusEndBusyRef = useRef(false)
  const interestBusyRef = useRef(false)
  const prevFocusUntilRef = useRef<number | null>(settings.focusSessionUntilEpochMs)
  const interestSlotsFiredRef = useRef<Set<number>>(new Set())

  const pushBase = () => ({
    settingsRef,
    recentCompanionLinesRef,
    blockScheduledPushRef,
    showToastMessage,
    ...(setToastMeta ? { setToastMeta } : {}),
    ...(setSpriteState ? { setSpriteState } : {}),
    widgetMeasureRef,
    isWidgetMode,
    requireAutoPushGate: true as const,
  })

  const tryUnlockRitual = () => {
    void (async () => {
      if (!isWidgetMode || !settingsReady || onboardingDone !== true) return
      if (unlockBusyRef.current || blockScheduledPushRef.current) return
      if (shouldDeferExtraProactiveCopy()) return
      if (
        await isCompanionCopyOnScreen({
          ...(toastVisible !== undefined ? { toastVisible } : {}),
          ...(lastShownToastMessageRef
            ? { toastMessage: lastShownToastMessageRef.current }
            : {}),
        })
      ) {
        return
      }

      unlockBusyRef.current = true
      try {
        const text = await pushProactiveCompanionCopy({
          ...pushBase(),
          fetchOptions: {
            trigger: 'unlock',
            momentContextText: formatUnlockMoment(),
          },
        })
        if (text) await markUnlockRitualFired()
      } finally {
        unlockBusyRef.current = false
      }
    })()
  }

  const tryFocusEndRitual = (minutes: number) => {
    void (async () => {
      if (!isWidgetMode || !settingsReady || onboardingDone !== true) return
      if (focusEndBusyRef.current || blockScheduledPushRef.current) return
      if (shouldDeferExtraProactiveCopy()) return
      if (!(await canFireFocusEndRitual())) return

      focusEndBusyRef.current = true
      try {
        const text = await pushProactiveCompanionCopy({
          ...pushBase(),
          fetchOptions: {
            trigger: 'focus-end',
            momentContextText: formatFocusEndMoment(minutes),
          },
        })
        if (text) await markFocusEndRitualFired()
      } finally {
        focusEndBusyRef.current = false
      }
    })()
  }

  const tryInterestDeepen = () => {
    void (async () => {
      if (!isWidgetMode || !settingsReady || onboardingDone !== true) return
      if (interestBusyRef.current || blockScheduledPushRef.current) return
      if (shouldDeferExtraProactiveCopy()) return
      if (!(await canFireInterestDeepen())) return

      interestBusyRef.current = true
      try {
        const text = await pushProactiveCompanionCopy({
          ...pushBase(),
          fetchOptions: {
            trigger: 'interest-deepen',
            momentContextText:
              '每日兴趣深化：用一句温柔问句了解用户近期喜好或状态，须以？结尾。',
          },
        })
        if (text) await markInterestDeepenFired()
      } finally {
        interestBusyRef.current = false
      }
    })()
  }

  useEffect(() => {
    if (!isWidgetMode) return
    const unsub = window.sidekickDesktop?.onSystemResume?.(() => {
      window.setTimeout(() => tryUnlockRitual(), 2500)
    })
    return () => unsub?.()
  }, [isWidgetMode, settingsReady, onboardingDone, emotionRecords])

  useEffect(() => {
    const prev = prevFocusUntilRef.current
    const now = settings.focusSessionUntilEpochMs
    prevFocusUntilRef.current = now

    if (prev == null || !Number.isFinite(prev)) return
    const wasActive = Date.now() < prev
    const nowActive =
      now != null && Number.isFinite(now) && Date.now() < now
    if (!wasActive || nowActive) return

    const minutes =
      settingsRef.current.focusPresetMinutes > 0
        ? settingsRef.current.focusPresetMinutes
        : 25
    tryFocusEndRitual(minutes)
  }, [settings.focusSessionUntilEpochMs])

  const dayKeyRef = useRef(localDayKey())

  useEffect(() => {
    if (!isWidgetMode || !settingsReady || onboardingDone !== true) return

    const tick = () => {
      if (shouldDeferExtraProactiveCopy()) return
      const today = localDayKey()
      if (today !== dayKeyRef.current) {
        dayKeyRef.current = today
        interestSlotsFiredRef.current = new Set()
      }
      const hour = new Date().getHours()
      if (!(INTEREST_DEEPEN_HOURS as readonly number[]).includes(hour)) return
      if (interestSlotsFiredRef.current.has(hour)) return
      interestSlotsFiredRef.current.add(hour)
      tryInterestDeepen()
    }

    tick()
    const id = window.setInterval(tick, 15 * 60_000)
    return () => window.clearInterval(id)
  }, [isWidgetMode, settingsReady, onboardingDone])
}
