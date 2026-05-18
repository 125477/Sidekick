import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import { useEffect, useRef } from 'react'
import { appendText } from '@sidekick/core'
import { fetchCompanionCopy, canPushNow } from './companionCopy'
import { RECENT_COMPANION_LINES_MAX } from './recentCompanionLines'
import {
  shouldApplyCompanionCopyResult,
  startCompanionCopyRequest,
} from './companionCopySession'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState, UiAction } from '../state/uiState'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'
import {
  speakCompanionLine,
  usesDetachedToastWindow,
} from '../utils/companionTts'
import { subscribeAppSelfIntroDismissed } from '../state/appSelfIntroSync'

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
  const bootstrapPendingRef = useRef(false)
  const showPushTextRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!isWidgetMode) return
    return subscribeAppSelfIntroDismissed(() => {
      if (!bootstrapPendingRef.current) return
      bootstrapPendingRef.current = false
      if (companionBootstrapDoneRef.current) return
      companionBootstrapDoneRef.current = true
      showPushTextRef.current()
    })
  }, [isWidgetMode, companionBootstrapDoneRef])

  useEffect(() => {
    if (!settings.pushEnabled) {
      pushCopyToastSuccessCountRef.current = 0
      companionBootstrapDoneRef.current = false
    }
  }, [settings.pushEnabled, pushCopyToastSuccessCountRef, companionBootstrapDoneRef])

  useEffect(() => {
    if (!settingsReady) return
    if (onboardingDone !== true) return
    if (!runsScheduledPush) return
    if (!settings.pushEnabled) return
    const showPushText = () => {
      void (async () => {
        const s = settingsRef.current
        if (blockScheduledPushRef.current) return
        if (!s.pushEnabled || !canPushNow(s)) return
        const fetchId = startCompanionCopyRequest()
        const avoidPush = recentCompanionLinesRef.current
        const result = await fetchCompanionCopy(
          s,
          undefined,
          undefined,
          avoidPush.length > 0 ? avoidPush : undefined,
        )
        if (!shouldApplyCompanionCopyResult(fetchId, result.source)) return
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
          await window.sidekickDesktop!.showToastWindow({
            message: result.text,
            anchor,
            dwellSeconds: dwell,
            ...(newId ? { textId: newId, favorite: false } : {}),
          })
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
        if (!detachedToast) {
          const tts = settingsRef.current
          void speakCompanionLine(result.text, {
            enabled: tts.companionTtsEnabled,
            model: tts.companionTtsModel,
            voice: tts.companionTtsVoice,
            speechRate: tts.companionTtsSpeechRate,
          })
        }
        setSpriteState('notify')
        window.setTimeout(() => setSpriteState('idle'), 520)
      })()
    }

    showPushTextRef.current = showPushText

    const raw = Number(settings.pushIntervalMinutes)
    const intervalMinutes =
      Number.isFinite(raw) && raw >= 1 && raw <= 60 ? Math.floor(raw) : 10
    const intervalMs = intervalMinutes * 60_000

    if (!companionBootstrapDoneRef.current) {
      if (blockScheduledPushRef.current) {
        bootstrapPendingRef.current = true
      } else {
        companionBootstrapDoneRef.current = true
        showPushText()
      }
    }

    const intervalId = window.setInterval(showPushText, intervalMs)
    return () => {
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
