import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import {
  appendText,
  companionLineIsNonRewriteTarget,
  buildRegenerateAvoidForPrompt,
  loadData,
  logCompanionRegenerate,
  pickCompanionRegenerateLineDistinct,
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
import { buildShowToastWindowPayload } from '../utils/toastWindowPayload'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'
import { usesDetachedToastWindow } from '../utils/companionTts'
import { SIDEKICK_MORE_FEATURES_PLACEHOLDER } from '../constants/toastCopy'
import { openEmotionPanel } from './openEmotionPanel'
import {
  fetchCompanionCopy,
  persistBailianAgentSessionId,
  type FetchCompanionCopyOptions,
} from './companionCopy'
import { pushProactiveCompanionCopy } from './companionProactivePush'
import { openCompanionExportPanel } from './companionExportSession'
import { RECENT_COMPANION_LINES_MAX } from './recentCompanionLines'
import {
  shouldApplyCompanionCopyResult,
  startCompanionCopyRequest,
} from './companionCopySession'
import {
  markRegenerateCopyStarted,
  markRegenerateCopyFinished,
} from './companionRegenerateBridge'

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
    | ((
        keyword?: string,
        emotion?: EmotionKind,
        fetchOptions?: FetchCompanionCopyOptions,
      ) => Promise<void>)
    | undefined
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
  blockScheduledPushRef?: MutableRefObject<boolean>
  setToastCopyTrigger?: Dispatch<SetStateAction<string | null>>
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
  blockScheduledPushRef,
  setToastCopyTrigger,
}: UseCompanionActionsArgs) {
  const companionFetchBusyRef = useRef(false)
  const regenerateSeqRef = useRef(0)
  /** 屏上句未刷新时，仍避免连点换句打出相同 model 句。 */
  const lastRegenerateModelOutputsRef = useRef<string[]>([])
  const regenerateInFlightRef = useRef(false)

  const showToastMessage = async (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string | null
      favorite?: boolean
      toastMode?: 'normal' | 'intro'
      /** 收藏刷新等须强制同步主进程时设为 true */
      forceRefresh?: boolean
      copyMeta?: { trigger: string; source: 'model' | 'fallback' }
    },
  ) => {
    if (moreRestoreToastTimerRef.current != null) {
      window.clearTimeout(moreRestoreToastTimerRef.current)
      moreRestoreToastTimerRef.current = null
    }
    const normalized = message.replace(/\s+/g, ' ').trim()
    const prevShown = lastShownToastMessageRef.current.replace(/\s+/g, ' ').trim()
    setToastCopyTrigger?.(
      opts?.toastMode === 'intro' ? null : (opts?.copyMeta?.trigger ?? null),
    )
    if (
      normalized &&
      normalized === prevShown &&
      opts?.toastMode !== 'intro' &&
      !opts?.forceRefresh
    ) {
      return
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
      await window.sidekickDesktop.showToastWindow(
        buildShowToastWindowPayload(
          settingsRef.current,
          {
            message,
            anchor: uiState.toastAnchor,
            dwellSeconds,
            ...(opts?.copyMeta ? { copyMeta: opts.copyMeta } : {}),
            ...(opts?.forceRefresh ? { forceToastContentReload: true } : {}),
            ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
            ...(opts?.textId
              ? {
                  textId: opts.textId,
                  favorite: opts.favorite ?? false,
                }
              : {}),
          },
          opts?.toastMode === 'intro' ? { autoTts: false } : undefined,
        ),
      )
      lastShownToastMessageRef.current = message
      if (!usesDetachedToastWindow()) {
        dispatch({
          type: 'SHOW_TOAST',
          message,
          ...(opts?.toastMode ? { toastMode: opts.toastMode } : {}),
        })
      }
      return
    }
    if (isToastMode && window.sidekickDesktop?.showToastWindow) {
      setToastMeta(null)
      await window.sidekickDesktop.showToastWindow(
        buildShowToastWindowPayload(
          settingsRef.current,
          {
            message,
            anchor: toastDetachAnchor,
            dwellSeconds,
            ...(opts?.copyMeta ? { copyMeta: opts.copyMeta } : {}),
            ...(opts?.forceRefresh ? { forceToastContentReload: true } : {}),
            ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
            ...(opts?.textId
              ? {
                  textId: opts.textId,
                  favorite: opts.favorite ?? false,
                }
              : {}),
          },
          opts?.toastMode === 'intro' ? { autoTts: false } : undefined,
        ),
      )
      lastShownToastMessageRef.current = message
      return
    }
    /** 独立设置/换肤等 Panel 窗：须走主进程独立气泡，本地 dispatch 用户看不见。 */
    if (isPanelMode && window.sidekickDesktop?.showToastWindow) {
      setToastMeta(null)
      await window.sidekickDesktop.showToastWindow(
        buildShowToastWindowPayload(
          settingsRef.current,
          {
            message,
            anchor: settingsRef.current.toastAnchor,
            dwellSeconds,
            ...(opts?.copyMeta ? { copyMeta: opts.copyMeta } : {}),
            ...(opts?.forceRefresh ? { forceToastContentReload: true } : {}),
            ...(opts?.toastMode === 'intro' ? { toastIntro: true } : {}),
            ...(opts?.textId
              ? {
                  textId: opts.textId,
                  favorite: opts.favorite ?? false,
                }
              : {}),
          },
          opts?.toastMode === 'intro' ? { autoTts: false } : undefined,
        ),
      )
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

  async function requestCompanionText(
    keyword?: string,
    emotion?: EmotionKind,
    fetchOptions?: FetchCompanionCopyOptions,
  ) {
    const isRegenerate =
      fetchOptions?.trigger === 'regenerate' ||
      keyword?.trim() === '换一句'
    if (!isRegenerate && companionFetchBusyRef.current) return
    if (isRegenerate && regenerateInFlightRef.current) {
      logCompanionRegenerate('widget regenerate skipped (in flight)')
      return
    }
    if (isRegenerate) {
      const locked = await window.sidekickDesktop?.getSpriteInteractionLocked?.()
      if (locked) {
        logCompanionRegenerate('widget regenerate skipped (locked)')
        return
      }
      logCompanionRegenerate('widget requestCompanionText start', {
        keyword,
        replaceTargetLine: fetchOptions?.replaceTargetLine,
        seed: fetchOptions?.seed,
      })
    }
    companionFetchBusyRef.current = true
    if (isRegenerate) regenerateInFlightRef.current = true
    if (isRegenerate) markRegenerateCopyStarted()
    let regenNotified = false
    const finishRegenerateNotify = (message?: string) => {
      if (!isRegenerate || regenNotified) return
      regenNotified = true
      markRegenerateCopyFinished()
      window.sidekickDesktop?.notifyRegenerateCopyDone?.({
        ...(message?.trim() ? { message: message.trim() } : {}),
      })
    }
    try {
      const fetchId = startCompanionCopyRequest()
      const trigger =
        fetchOptions?.trigger ??
        (emotion
          ? ('emotion' as const)
          : keyword?.trim() === '换一句'
            ? ('regenerate' as const)
            : keyword?.trim() === '类似这句'
              ? ('similar' as const)
              : ('manual' as const))
      /** 独立气泡换句：主进程转发屏上句；否则用 lastShown / widget 状态。 */
      const screenLineFromRequest = fetchOptions?.replaceTargetLine
        ?.replace(/\s+/g, ' ')
        .trim()
      const currentToast = (
        screenLineFromRequest ||
        lastShownToastMessageRef.current ||
        uiState.toastMessage ||
        (isToastMode ? toastMessageFromQuery : '')
      )
        .replace(/\s+/g, ' ')
        .trim()
      const avoid = isRegenerate
        ? buildRegenerateAvoidForPrompt({
            ...(currentToast ? { screenLine: currentToast } : {}),
            lastRegenerateOutputs: lastRegenerateModelOutputsRef.current,
          })
        : [...recentCompanionLinesRef.current]
      regenerateSeqRef.current += 1
      const rewriteTarget =
        currentToast &&
        (trigger === 'regenerate' || trigger === 'similar') &&
        currentToast !== SIDEKICK_MORE_FEATURES_PLACEHOLDER &&
        !companionLineIsNonRewriteTarget(currentToast)
          ? currentToast
          : undefined
      const regenSeed =
        fetchOptions?.seed ??
        (Date.now() ^
          Math.floor(Math.random() * 1_000_000_000) ^
          regenerateSeqRef.current * 1_048_583)
      if (isRegenerate) {
        logCompanionRegenerate('widget fetch params', {
          fetchId,
          currentToast,
          avoid,
          lastRegenerateOutputs: [...lastRegenerateModelOutputsRef.current],
          seed: regenSeed,
          companionInterests: settingsRef.current.companionInterests,
        })
      }
      const result = await fetchCompanionCopy(
        settingsRef.current,
        keyword,
        emotion,
        avoid.length > 0 ? avoid : undefined,
        {
          ...fetchOptions,
          trigger,
          fetchKind: 'interactive',
          ...(isRegenerate && currentToast
            ? { replaceTargetLine: currentToast }
            : rewriteTarget
              ? { replaceTargetLine: rewriteTarget }
              : {}),
          seed: regenSeed,
        },
      )
      if (isRegenerate) {
        logCompanionRegenerate('widget fetchCompanionCopy returned', {
          fetchId,
          source: result.source,
          text: result.text,
          skipped: result.skipped === true,
        })
      }
      if (isRegenerate && result.skipped) {
        finishRegenerateNotify()
        return
      }
      await persistBailianAgentSessionId(settingsRef, result.sessionId)
      if (!shouldApplyCompanionCopyResult(fetchId, result.source)) {
        if (isRegenerate) {
          logCompanionRegenerate('widget stale fetchId → discard (keep latest)', {
            fetchId,
            source: result.source,
            text: result.text,
          })
        }
        finishRegenerateNotify()
        return
      }
      let displayText = result.text.trim()
      if (!displayText && isRegenerate) {
        displayText = pickCompanionRegenerateLineDistinct({
          maxChars: settingsRef.current.textMaxChars,
          style: settingsRef.current.textStyle,
          ...(currentToast ? { mustDifferFrom: currentToast } : {}),
          seed:
            fetchOptions?.seed ??
            (Date.now() ^
              Math.floor(Math.random() * 1_000_000_000) ^
              regenerateSeqRef.current * 1_048_583),
          ...(avoid.length ? { avoidRecent: avoid } : {}),
        }).trim()
      }
      if (!displayText) {
        finishRegenerateNotify()
        return
      }

      if (isRegenerate) {
        const trimmed = displayText.replace(/\s+/g, ' ').trim()
        if (trimmed) {
          lastRegenerateModelOutputsRef.current = [
            ...lastRegenerateModelOutputsRef.current.filter((line) => line !== trimmed),
            trimmed,
          ].slice(-6)
        }
      }

      if (
        isRegenerate &&
        currentToast &&
        displayText.replace(/\s+/g, ' ').trim() === currentToast
      ) {
        for (let attempt = 0; attempt < 32; attempt++) {
          displayText = pickCompanionRegenerateLineDistinct({
            maxChars: settingsRef.current.textMaxChars,
            style: settingsRef.current.textStyle,
            mustDifferFrom: currentToast,
            seed:
              (fetchOptions?.seed ??
                (Date.now() ^
                  Math.floor(Math.random() * 1_000_000_000) ^
                  regenerateSeqRef.current * 1_048_583)) +
              attempt * 1_048_583,
            ...(avoid.length ? { avoidRecent: avoid } : {}),
          }).trim()
          if (displayText.replace(/\s+/g, ' ').trim() !== currentToast) break
        }
      }

      const next = await appendText({
        id: `text-${Date.now()}`,
        content: displayText,
        createdAt: new Date().toISOString(),
        source: result.source,
        favorite: false,
      })
      const newId = next.texts.history[0]?.id
      await showToastMessage(
        displayText,
        newId
          ? {
              textId: newId,
              favorite: false,
              forceRefresh: isRegenerate,
              copyMeta: {
                trigger: isRegenerate ? 'regenerate' : (fetchOptions?.trigger ?? 'manual'),
                source: result.source,
              },
            }
          : {
              forceRefresh: isRegenerate,
              copyMeta: {
                trigger: isRegenerate ? 'regenerate' : (fetchOptions?.trigger ?? 'manual'),
                source: result.source,
              },
            },
      )
      finishRegenerateNotify(displayText)
      recentCompanionLinesRef.current = [
        ...recentCompanionLinesRef.current,
        displayText,
      ].slice(-RECENT_COMPANION_LINES_MAX)
      setSpriteState('notify')
      window.setTimeout(() => setSpriteState('idle'), 520)
    } finally {
      companionFetchBusyRef.current = false
      if (isRegenerate) regenerateInFlightRef.current = false
      finishRegenerateNotify()
    }
  }

  async function requestCompanionSimilar(similarToLine?: string) {
    const line = (similarToLine ?? uiState.toastMessage).replace(/\s+/g, ' ').trim()
    if (!line || line === SIDEKICK_MORE_FEATURES_PLACEHOLDER) return
    await requestCompanionText('类似这句', undefined, {
      trigger: 'similar',
      similarToLine: line,
    })
  }

  async function pushProactiveCompanion(fetchOptions: FetchCompanionCopyOptions) {
    const autoTriggers = new Set([
      'scheduled',
      'yesterday-greeting',
      'unlock',
      'focus-end',
      'streak-nudge',
      'interest-deepen',
    ])
    const requireAutoPushGate = autoTriggers.has(
      fetchOptions.trigger ?? 'manual',
    )
    return pushProactiveCompanionCopy({
      settingsRef,
      recentCompanionLinesRef,
      ...(blockScheduledPushRef ? { blockScheduledPushRef } : {}),
      showToastMessage,
      setToastMeta,
      setSpriteState,
      widgetMeasureRef,
      isWidgetMode,
      fetchOptions,
      requireAutoPushGate,
    })
  }

  requestCompanionTextRef.current = requestCompanionText

  useEffect(() => {
    if (!isWidgetMode) return
    const unRegen = window.sidekickDesktop?.onRegenerateCopyRequested?.(
      (payload) => {
        void requestCompanionTextRef.current?.('换一句', undefined, {
          trigger: 'regenerate',
          ...(payload?.replaceTargetLine
            ? { replaceTargetLine: payload.replaceTargetLine }
            : {}),
        })
      },
    )
    const unSimilar = window.sidekickDesktop?.onSimilarCopyRequested?.(() => {
      void requestCompanionSimilar()
    })
    const unGlobal = window.sidekickDesktop?.onGlobalShortcut?.(({ action }) => {
      if (action === 'regenerate') {
        void requestCompanionTextRef.current?.('换一句', undefined, {
          trigger: 'regenerate',
        })
      }
      if (action === 'export-card') {
        const msg =
          uiState.toastMessage.trim() ||
          lastShownToastMessageRef.current.trim()
        if (msg) {
          openCompanionExportPanel(msg)
        }
      }
    })
    return () => {
      unRegen?.()
      unSimilar?.()
      unGlobal?.()
    }
  }, [isWidgetMode, uiState.toastMessage, settingsRef])

  return {
    showToastMessage,
    hideEmotionToast,
    restartOnboarding,
    handleMenuAction,
    completeOnboarding,
    requestCompanionText,
    requestCompanionSimilar,
    pushProactiveCompanion,
  }
}
