import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useLayoutEffect } from 'react'
import {
  appendText,
  loadData,
  saveData,
  type AvatarPreset,
  type CompanionCopyStyle,
  type EmotionKind,
} from '@sidekick/core'
import type { MenuAction } from '../components/menu/SpriteMenu'
import { broadcastAvatarSync } from '../state/avatarSync'
import { broadcastSettingsSync } from '../state/settingsSync'
import { saveOnboardingComplete, saveSettings } from '../state/settingsStorage'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState, UiAction, UiState } from '../state/uiState'
import {
  speakCompanionLine,
  usesDetachedToastWindow,
} from '../utils/companionTts'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'
import { SIDEKICK_MORE_FEATURES_PLACEHOLDER } from '../constants/toastCopy'
import { openEmotionPanel } from './openEmotionPanel'
import { fetchCompanionCopy } from './companionCopy'
import { RECENT_COMPANION_LINES_MAX } from './recentCompanionLines'
import {
  shouldApplyCompanionCopyResult,
  startCompanionCopyRequest,
} from './companionCopySession'

export type UseCompanionActionsArgs = {
  isWidgetMode: boolean
  isPanelMode: boolean
  isToastMode: boolean
  isOnboardingMode: boolean
  toastVisible: boolean
  toastDetachAnchor: 'top' | 'bottom'
  toastMessageFromQuery: string
  uiState: UiState
  dispatch: Dispatch<UiAction>
  settingsRef: MutableRefObject<SidekickSettings>
  widgetMeasureRef: RefObject<HTMLDivElement | null>
  lastShownToastMessageRef: MutableRefObject<string>
  moreRestoreToastTimerRef: MutableRefObject<number | null>
  recentCompanionLinesRef: MutableRefObject<string[]>
  requestCompanionTextRef: MutableRefObject<
    ((keyword?: string, emotion?: EmotionKind) => Promise<void>) | undefined
  >
  onboardingOpenSentRef: MutableRefObject<boolean>
  avatars: AvatarPreset[]
  setToastMeta: Dispatch<SetStateAction<{ id: string; favorite: boolean } | null>>
  setSpriteState: Dispatch<SetStateAction<SpriteState>>
  setFortuneWidgetSheetOpen: Dispatch<SetStateAction<boolean>>
  setOnboardingDone: Dispatch<SetStateAction<boolean | null>>
  setSelectedAvatarId: Dispatch<SetStateAction<string>>
  setSettings: Dispatch<SetStateAction<SidekickSettings>>
  handleMenuActionRef: MutableRefObject<(action: MenuAction) => void>
}

export function useCompanionActions({
  isWidgetMode,
  isPanelMode,
  isToastMode,
  isOnboardingMode,
  toastVisible,
  toastDetachAnchor,
  toastMessageFromQuery,
  uiState,
  dispatch,
  settingsRef,
  widgetMeasureRef,
  lastShownToastMessageRef,
  moreRestoreToastTimerRef,
  recentCompanionLinesRef,
  requestCompanionTextRef,
  onboardingOpenSentRef,
  avatars,
  setToastMeta,
  setSpriteState,
  setFortuneWidgetSheetOpen,
  setOnboardingDone,
  setSelectedAvatarId,
  setSettings,
  handleMenuActionRef,
}: UseCompanionActionsArgs) {
  const showToastMessage = async (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string | null
      favorite?: boolean
      toastMode?: 'normal' | 'intro'
    },
  ) => {
    if (moreRestoreToastTimerRef.current != null) {
      window.clearTimeout(moreRestoreToastTimerRef.current)
      moreRestoreToastTimerRef.current = null
    }
    const dwellSeconds =
      opts?.dwellSeconds !== undefined
        ? opts.dwellSeconds
        : settingsRef.current.toastAlwaysVisible
          ? 0
          : settingsRef.current.dwellMinutes * 60
    if (isWidgetMode && window.sidekickDesktop?.showToastWindow) {
      setToastMeta(null)
      await reportSpriteAnchorToMain(widgetMeasureRef.current, {
        flush: true,
        avatarSizePercent: settingsRef.current.avatarSize,
      })
      await window.sidekickDesktop.showToastWindow({
        message,
        anchor: uiState.toastAnchor,
        dwellSeconds,
        ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
        ...(opts?.textId
          ? {
              textId: opts.textId,
              favorite: opts.favorite ?? false,
            }
          : {}),
      })
      lastShownToastMessageRef.current = message
      return
    }
    if (isToastMode && window.sidekickDesktop?.showToastWindow) {
      setToastMeta(null)
      await window.sidekickDesktop.showToastWindow({
        message,
        anchor: toastDetachAnchor,
        dwellSeconds,
        ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
        ...(opts?.textId
          ? {
              textId: opts.textId,
              favorite: opts.favorite ?? false,
            }
          : {}),
      })
      lastShownToastMessageRef.current = message
      return
    }
    /** 独立设置/换肤等 Panel 窗：须走主进程独立气泡，本地 dispatch 用户看不见。 */
    if (isPanelMode && window.sidekickDesktop?.showToastWindow) {
      setToastMeta(null)
      await window.sidekickDesktop.showToastWindow({
        message,
        anchor: settingsRef.current.toastAnchor,
        dwellSeconds,
        ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
        ...(opts?.textId
          ? {
              textId: opts.textId,
              favorite: opts.favorite ?? false,
            }
          : {}),
      })
      lastShownToastMessageRef.current = message
      return
    }
    if (opts?.textId) {
      setToastMeta({
        id: opts.textId,
        favorite: opts.favorite ?? false,
      })
    } else {
      setToastMeta(null)
    }
    dispatch({
      type: 'SHOW_TOAST',
      message,
      ...(opts?.toastMode ? { toastMode: opts.toastMode } : {}),
    })
    lastShownToastMessageRef.current = message
  }

  const hideEmotionToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' })
  }, [dispatch])

  const restartOnboarding = useCallback(() => {
    onboardingOpenSentRef.current = false
    if (window.sidekickDesktop?.openOnboardingWindow) {
      void window.sidekickDesktop.openOnboardingWindow()
      return
    }
    setOnboardingDone(false)
  }, [onboardingOpenSentRef, setOnboardingDone])

  const handleMenuAction = (action: MenuAction) => {
    if (action === 'exit') {
      dispatch({ type: 'MENU_CLOSE' })
      void window.sidekickDesktop?.quitApp?.()
      return
    }
    if (action === 'skin') {
      if (
        (isWidgetMode || isToastMode) &&
        window.sidekickDesktop?.openPanelWindow
      ) {
        void window.sidekickDesktop.openPanelWindow('skin')
      } else {
        dispatch({ type: 'SET_PANEL', panel: 'skin' })
      }
    }
    if (action === 'settings') {
      if (
        (isWidgetMode || isToastMode) &&
        window.sidekickDesktop?.openPanelWindow
      ) {
        void window.sidekickDesktop.openPanelWindow('settings')
      } else {
        dispatch({ type: 'SET_PANEL', panel: 'settings' })
      }
    }
    if (action === 'emotion') {
      openEmotionPanel(dispatch)
    }
    if (action === 'favorites') {
      if (
        (isWidgetMode || isToastMode) &&
        window.sidekickDesktop?.openPanelWindow
      ) {
        void window.sidekickDesktop.openPanelWindow('favorites')
      } else {
        dispatch({ type: 'SET_PANEL', panel: 'favorites' })
      }
    }
    if (action === 'fortune') {
      if (
        (isWidgetMode || isToastMode) &&
        window.sidekickDesktop?.openPanelWindow
      ) {
        void window.sidekickDesktop.openPanelWindow('fortune').catch(() => {
          if (isWidgetMode) setFortuneWidgetSheetOpen(true)
        })
      } else if (isWidgetMode) {
        setFortuneWidgetSheetOpen(true)
      } else {
        dispatch({ type: 'SET_PANEL', panel: 'fortune' })
      }
    }
    if (action === 'more') {
      const moreCopy = SIDEKICK_MORE_FEATURES_PLACEHOLDER
      const fromRef = lastShownToastMessageRef.current.trim()
      const fromUi =
        toastVisible &&
        uiState.toastMessage.trim() &&
        uiState.toastMessage !== moreCopy
          ? uiState.toastMessage.trim()
          : isToastMode &&
              toastMessageFromQuery.trim() &&
              toastMessageFromQuery !== moreCopy
            ? toastMessageFromQuery.trim()
            : ''
      const restore =
        fromRef && fromRef !== moreCopy
          ? fromRef
          : fromUi && fromUi !== moreCopy
            ? fromUi
            : ''
      void (async () => {
        await showToastMessage(moreCopy, { dwellSeconds: 0 })
        if (!restore) return
        moreRestoreToastTimerRef.current = window.setTimeout(() => {
          moreRestoreToastTimerRef.current = null
          void showToastMessage(restore)
        }, 3000)
      })()
    }
    dispatch({ type: 'MENU_CLOSE' })
  }

  useLayoutEffect(() => {
    handleMenuActionRef.current = handleMenuAction
  })

  const completeOnboarding = useCallback(
    async (payload: {
      selectedAvatarId: string
      textStyle: CompanionCopyStyle
      companionInterests: string[]
    }) => {
      setSelectedAvatarId(payload.selectedAvatarId)
      const nextSettings: SidekickSettings = {
        ...settingsRef.current,
        textStyle: payload.textStyle,
        companionInterests: payload.companionInterests,
      }
      setSettings(nextSettings)
      void saveSettings(nextSettings).then(() => broadcastSettingsSync())
      const data = await loadData()
      await saveData({
        ...data,
        avatar: {
          ...data.avatar,
          presets: avatars,
          selectedAvatarId: payload.selectedAvatarId,
          size: settingsRef.current.avatarSize,
          opacity: settingsRef.current.avatarOpacity,
        },
      })
      broadcastAvatarSync()
      await saveOnboardingComplete()
      if (isOnboardingMode) {
        await window.sidekickDesktop?.notifyOnboardingComplete?.()
      } else {
        setOnboardingDone(true)
      }
    },
    [
      avatars,
      isOnboardingMode,
      setOnboardingDone,
      setSelectedAvatarId,
      setSettings,
      settingsRef,
    ],
  )

  async function requestCompanionText(keyword?: string, emotion?: EmotionKind) {
    const fetchId = startCompanionCopyRequest()
    const avoid = recentCompanionLinesRef.current
    const result = await fetchCompanionCopy(
      settingsRef.current,
      keyword,
      emotion,
      avoid.length > 0 ? avoid : undefined,
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
    const detachedToast = isWidgetMode && usesDetachedToastWindow()
    await showToastMessage(
      result.text,
      newId ? { textId: newId, favorite: false } : undefined,
    )
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
  }

  requestCompanionTextRef.current = requestCompanionText

  useEffect(() => {
    if (!isWidgetMode) return
    return window.sidekickDesktop?.onRegenerateCopyRequested?.(() => {
      void requestCompanionTextRef.current?.('换一句')
    })
  }, [isWidgetMode, requestCompanionTextRef])

  return {
    showToastMessage,
    hideEmotionToast,
    restartOnboarding,
    handleMenuAction,
    completeOnboarding,
    requestCompanionText,
  }
}
