import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import { appendText } from '@sidekick/core'
import {
  fetchCompanionCopy,
  canPushNow,
  persistBailianAgentSessionId,
  type FetchCompanionCopyResult,
} from './companionCopy'
import { RECENT_COMPANION_LINES_MAX } from './recentCompanionLines'
import {
  shouldApplyCompanionCopyResult,
  startCompanionCopyRequest,
} from './companionCopySession'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState, UiAction } from '../state/uiState'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'
import { usesDetachedToastWindow } from '../utils/companionTts'
import { buildShowToastWindowPayload } from '../utils/toastWindowPayload'
import { markStartupCompanionCopyFinished } from './companionSessionBoot'
import { subscribeAppSelfIntroDismissed } from '../state/appSelfIntroSync'
import { loadAppSelfIntroShown } from '../state/appSelfIntroStorage'
import {
  clearPendingEmotionForCompanion,
  readPendingEmotionForCompanion,
} from '../state/pendingEmotionStorage'
import { resetStartupFetchCoordinatorIfIdle, isInteractiveCompanionFetchActive } from './companionFetchCoordinator'

export type UseScheduledCompanionPushArgs = {
  settings: SidekickSettings
  settingsReady: boolean
  settingsRef: MutableRefObject<SidekickSettings>
  onboardingDone: boolean | null
  runsScheduledPush: boolean
  isWidgetMode: boolean
  dispatch: Dispatch<UiAction>
  setToastMeta: Dispatch<SetStateAction<{ id: string; favorite: boolean } | null>>
  setSpriteState: Dispatch<SetStateAction<SpriteState>>
  widgetMeasureRef: MutableRefObject<HTMLDivElement | null>
  pushCopyToastSuccessCountRef: MutableRefObject<number>
  companionBootstrapDoneRef: MutableRefObject<boolean>
  recentCompanionLinesRef: MutableRefObject<string[]>
  advanceAvatarAfterPushCopy: () => void
  blockScheduledPushRef: MutableRefObject<boolean>
}

/** 定时陪伴推送：interval + 推送开关变更时重置会话计数。 */
export function useScheduledCompanionPush({
  settings,
  settingsReady,
  settingsRef,
  onboardingDone,
  runsScheduledPush,
  isWidgetMode,
  dispatch,
  setToastMeta,
  setSpriteState,
  widgetMeasureRef,
  pushCopyToastSuccessCountRef,
  companionBootstrapDoneRef,
  recentCompanionLinesRef,
  advanceAvatarAfterPushCopy,
  blockScheduledPushRef,
}: UseScheduledCompanionPushArgs) {
  const pushTextInFlightRef = useRef(false)
  const startupPushSucceededRef = useRef(false)
  const pendingStartupResultRef = useRef<{
    result: FetchCompanionCopyResult
    fetchId: number
  } | null>(null)
  const runStartupPushRef = useRef<
    (opts?: { displayOnly?: boolean }) => Promise<boolean>
  >(async () => false)

  useEffect(() => {
    if (!isWidgetMode) return
    return subscribeAppSelfIntroDismissed(() => {
      blockScheduledPushRef.current = false
      if (startupPushSucceededRef.current) return
      if (isInteractiveCompanionFetchActive()) return
      const pending = pendingStartupResultRef.current
      if (pending?.result.text.trim()) {
        void runStartupPushRef.current({ displayOnly: true })
        return
      }
      void runStartupPushRef.current()
    })
  }, [isWidgetMode, blockScheduledPushRef])

  useEffect(() => {
    if (!settings.pushEnabled) {
      pushCopyToastSuccessCountRef.current = 0
      companionBootstrapDoneRef.current = false
      startupPushSucceededRef.current = false
      pendingStartupResultRef.current = null
    }
  }, [
    settings.pushEnabled,
    pushCopyToastSuccessCountRef,
    companionBootstrapDoneRef,
  ])

  useEffect(() => {
    if (!settingsReady) return
    if (onboardingDone !== true) return
    if (!runsScheduledPush) return
    if (!settings.pushEnabled) return

    resetStartupFetchCoordinatorIfIdle()

    const displayStartupResult = async (
      result: FetchCompanionCopyResult,
      fetchId: number,
    ): Promise<boolean> => {
      if (!shouldApplyCompanionCopyResult(fetchId, result.source)) {
        return false
      }
      const s = settingsRef.current
      const next = await appendText({
        id: `text-${Date.now()}`,
        content: result.text,
        createdAt: new Date().toISOString(),
        source: result.source,
        favorite: false,
      })
      const newId = next.texts.history[0]?.id
      const anchor = s.toastAnchor
      const dwell = s.toastAlwaysVisible ? 0 : s.dwellMinutes * 60
      const detachedToast = isWidgetMode && usesDetachedToastWindow()
      if (detachedToast) {
        await reportSpriteAnchorToMain(widgetMeasureRef.current, {
          flush: true,
          avatarSizePercent: settingsRef.current.avatarSize,
        })
        await window.sidekickDesktop!.showToastWindow(
          buildShowToastWindowPayload(s, {
            message: result.text,
            anchor,
            dwellSeconds: dwell,
            ...(newId ? { textId: newId, favorite: false } : {}),
          }),
        )
      } else {
        if (newId) {
          setToastMeta({ id: newId, favorite: false })
        } else {
          setToastMeta(null)
        }
        dispatch({ type: 'SHOW_TOAST', message: result.text })
      }
      pushCopyToastSuccessCountRef.current += 1
      const postPush = settingsRef.current
      if (
        postPush.pushAutoSwitchAvatar &&
        pushCopyToastSuccessCountRef.current > 1
      ) {
        advanceAvatarAfterPushCopy()
      }
      recentCompanionLinesRef.current = [
        ...recentCompanionLinesRef.current,
        result.text,
      ].slice(-RECENT_COMPANION_LINES_MAX)
      markStartupCompanionCopyFinished()
      startupPushSucceededRef.current = true
      companionBootstrapDoneRef.current = true
      pendingStartupResultRef.current = null
      setSpriteState('notify')
      window.setTimeout(() => setSpriteState('idle'), 520)
      return true
    }

    const runStartupPush = async (opts?: {
      displayOnly?: boolean
    }): Promise<boolean> => {
      if (startupPushSucceededRef.current) return true
      if (pushTextInFlightRef.current && !opts?.displayOnly) return false

      if (opts?.displayOnly) {
        const pending = pendingStartupResultRef.current
        if (!pending?.result.text.trim()) return false
        return displayStartupResult(pending.result, pending.fetchId)
      }

      pushTextInFlightRef.current = true
      try {
        const s = settingsRef.current
        if (!s.pushEnabled || !canPushNow(s)) return false

        const fetchId = startCompanionCopyRequest()
        const avoidPush = recentCompanionLinesRef.current
        const pendingEmotion = await readPendingEmotionForCompanion()
        const result = await fetchCompanionCopy(
          s,
          undefined,
          pendingEmotion ?? undefined,
          avoidPush.length > 0 ? avoidPush : undefined,
          {
            fetchKind: 'startup',
            maxQualityRetries: 0,
            ...(pendingEmotion
              ? { trigger: 'emotion' as const }
              : { trigger: 'scheduled' as const }),
          },
        )
        await persistBailianAgentSessionId(settingsRef, result.sessionId)
        if (!shouldApplyCompanionCopyResult(fetchId, result.source)) return false
        if (!result.text.trim()) return false
        if (pendingEmotion) await clearPendingEmotionForCompanion()

        if (blockScheduledPushRef.current) {
          pendingStartupResultRef.current = { result, fetchId }
          return true
        }
        return displayStartupResult(result, fetchId)
      } finally {
        pushTextInFlightRef.current = false
      }
    }

    const showPushText = () => {
      void runStartupPush()
    }

    runStartupPushRef.current = runStartupPush

    const raw = Number(settings.pushIntervalMinutes)
    const intervalMinutes =
      Number.isFinite(raw) && raw >= 1 && raw <= 60 ? Math.floor(raw) : 10
    const intervalMs = intervalMinutes * 60_000

    let cancelled = false
    void (async () => {
      if (startupPushSucceededRef.current) return

      const introAlreadyShown = await loadAppSelfIntroShown()
      if (cancelled) return

      if (!introAlreadyShown) {
        blockScheduledPushRef.current = true
      }

      await runStartupPush()
    })()

    const intervalId = window.setInterval(showPushText, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    settingsReady,
    runsScheduledPush,
    settings.pushEnabled,
    settings.pushIntervalMinutes,
    settings.pushStart,
    settings.pushEnd,
    settings.quietHoursEnabled,
    settings.quietStart,
    settings.quietEnd,
    settings.focusSessionUntilEpochMs,
    dispatch,
    isWidgetMode,
    onboardingDone,
    advanceAvatarAfterPushCopy,
    settingsRef,
    widgetMeasureRef,
    setToastMeta,
    setSpriteState,
    pushCopyToastSuccessCountRef,
    companionBootstrapDoneRef,
    recentCompanionLinesRef,
    blockScheduledPushRef,
  ])
}
