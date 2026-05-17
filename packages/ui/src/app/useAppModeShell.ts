import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import { useEffect, useLayoutEffect } from 'react'
import type { AvatarPreset } from '@sidekick/core'
import { APP_DISPLAY_NAME } from '../constants/brand'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState, UiAction, UiState } from '../state/uiState'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'

export type UseAppModeShellArgs = {
  isWidgetMode: boolean
  isToastMode: boolean
  isPanelMode: boolean
  isOnboardingMode: boolean
  isDragTrailMode: boolean
  themeSyncApplies: boolean
  settings: SidekickSettings
  settingsRef: MutableRefObject<SidekickSettings>
  settingsReady: boolean
  uiState: UiState
  panelTitle: string
  onboardingDone: boolean | null
  spriteAvatarSize: number
  selectedAvatarId: string
  selectedAvatar: AvatarPreset | undefined
  spriteInteractionLocked: boolean
  menuOpen: boolean
  fortuneWidgetSheetOpen: boolean
  toastMessageFromQuery: string
  toastSearch: string
  toastDetachTailPointsDown: boolean
  spriteMenuSurface: 'sprite' | 'toast-bubble'
  toastShellRef: RefObject<HTMLDivElement | null>
  widgetMeasureRef: RefObject<HTMLDivElement | null>
  lastShownToastMessageRef: MutableRefObject<string>
  onboardingOpenSentRef: MutableRefObject<boolean>
  dispatch: Dispatch<UiAction>
  setDetachPlacementFromMain: Dispatch<
    SetStateAction<{
      anchor: 'top' | 'bottom'
      placement: 'above' | 'below'
    } | null>
  >
  setToastDetachFavorite: Dispatch<SetStateAction<boolean>>
  setOnboardingDone: Dispatch<SetStateAction<boolean | null>>
  setSpriteInteractionLocked: Dispatch<SetStateAction<boolean>>
  setSpriteState: Dispatch<SetStateAction<SpriteState>>
}

export function useAppModeShell({
  isWidgetMode,
  isToastMode,
  isPanelMode,
  isOnboardingMode,
  isDragTrailMode = false,
  themeSyncApplies,
  settings,
  settingsRef,
  settingsReady,
  uiState,
  panelTitle,
  onboardingDone,
  spriteAvatarSize,
  selectedAvatarId,
  selectedAvatar,
  spriteInteractionLocked,
  menuOpen,
  fortuneWidgetSheetOpen,
  toastMessageFromQuery,
  toastSearch,
  toastDetachTailPointsDown,
  spriteMenuSurface,
  toastShellRef,
  widgetMeasureRef,
  lastShownToastMessageRef,
  onboardingOpenSentRef,
  dispatch,
  setDetachPlacementFromMain,
  setToastDetachFavorite,
  setOnboardingDone,
  setSpriteInteractionLocked,
  setSpriteState,
}: UseAppModeShellArgs) {
  useLayoutEffect(() => {
    if (!isToastMode || !toastMessageFromQuery) return
    const shell = toastShellRef.current
    if (!shell) return
    let roRaf = 0
    const applySize = () => {
      const h = Math.ceil(shell.getBoundingClientRect().height) + 8
      void window.sidekickDesktop?.resizeToastWindow?.({
        height: Math.min(480, Math.max(52, h)),
      })
    }
    const scheduleSize = () => {
      if (roRaf) return
      roRaf = requestAnimationFrame(() => {
        roRaf = 0
        applySize()
      })
    }
    applySize()
    const ro = new ResizeObserver(() => {
      scheduleSize()
    })
    ro.observe(shell)
    const id = requestAnimationFrame(() => {
      applySize()
      requestAnimationFrame(applySize)
    })
    return () => {
      cancelAnimationFrame(id)
      if (roRaf) cancelAnimationFrame(roRaf)
      ro.disconnect()
    }
  }, [isToastMode, toastMessageFromQuery, toastDetachTailPointsDown, menuOpen, spriteMenuSurface, toastShellRef])

  useEffect(() => {
    if (!isToastMode) return
    const unsub = window.sidekickDesktop?.onDetachedToastPlacementSync?.((p) => {
      setDetachPlacementFromMain(p)
    })
    return () => {
      unsub?.()
    }
  }, [isToastMode, setDetachPlacementFromMain])

  useLayoutEffect(() => {
    if (!isToastMode) return
    setToastDetachFavorite(new URLSearchParams(toastSearch).get('favorite') === '1')
  }, [isToastMode, toastSearch, setToastDetachFavorite])

  useLayoutEffect(() => {
    if (!isToastMode) return
    const t = toastMessageFromQuery.trim()
    if (t) lastShownToastMessageRef.current = t
  }, [isToastMode, toastMessageFromQuery, lastShownToastMessageRef])

  useLayoutEffect(() => {
    if (!isWidgetMode || !window.sidekickDesktop?.resizeWidgetWindow) return
    const el = widgetMeasureRef.current
    if (!el) return

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h < 40) return
      reportSpriteAnchorToMain(el, {
        avatarSizePercent: settingsRef.current.avatarSize,
      })
      void window.sidekickDesktop?.resizeWidgetWindow?.({
        height: Math.min(720, Math.max(168, h + 12)),
      })
    }

    apply()
    const ro = new ResizeObserver(() => apply())
    ro.observe(el)
    const id = requestAnimationFrame(() => {
      apply()
      requestAnimationFrame(apply)
    })
    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
    }
  }, [
    isWidgetMode,
    onboardingDone,
    spriteAvatarSize,
    settings.avatarOpacity,
    selectedAvatarId,
    settingsRef,
    widgetMeasureRef,
  ])

  useLayoutEffect(() => {
    if (!isPanelMode || !window.sidekickDesktop?.resizePanelWindow) return
    void window.sidekickDesktop.resizePanelWindow({})
  }, [isPanelMode, uiState.activePanel])

  useEffect(() => {
    if (!isPanelMode) return
    if (uiState.activePanel === 'settings') return
    const next = panelTitle.trim() || APP_DISPLAY_NAME
    document.title = next
    return () => {
      document.title = APP_DISPLAY_NAME
    }
  }, [isPanelMode, panelTitle, uiState.activePanel])

  useEffect(() => {
    const randomActions: Array<SpriteState> =
      selectedAvatar?.motionProfile === 'enhanced'
        ? ['jump', 'wave', 'laugh', 'stretch']
        : ['jump', 'wave']

    const id = window.setInterval(() => {
      if (randomActions.length === 0) return
      const next = randomActions[Math.floor(Math.random() * randomActions.length)]
      if (!next) return
      setSpriteState(next)
      window.setTimeout(() => setSpriteState('idle'), 1100)
    }, 7000)

    return () => window.clearInterval(id)
  }, [selectedAvatar?.motionProfile, setSpriteState])

  useEffect(() => {
    if (!isWidgetMode) return
    return window.sidekickDesktop?.onOnboardingFinished?.(() => {
      setOnboardingDone(true)
      onboardingOpenSentRef.current = false
    })
  }, [isWidgetMode, onboardingOpenSentRef, setOnboardingDone])

  useEffect(() => {
    if (!isWidgetMode) return
    if (onboardingDone === true) {
      onboardingOpenSentRef.current = false
      return
    }
    if (!settingsReady || onboardingDone !== false) return
    if (!window.sidekickDesktop?.openOnboardingWindow) return
    if (onboardingOpenSentRef.current) return
    onboardingOpenSentRef.current = true
    void window.sidekickDesktop.openOnboardingWindow()
  }, [isWidgetMode, settingsReady, onboardingDone, onboardingOpenSentRef])

  useEffect(() => {
    if (!isWidgetMode) return
    document.documentElement.classList.add('sidekick-widget-root')
    document.body.classList.add('sidekick-widget-root')
    return () => {
      document.documentElement.classList.remove('sidekick-widget-root')
      document.body.classList.remove('sidekick-widget-root')
    }
  }, [isWidgetMode])

  useEffect(() => {
    if (!isWidgetMode) return
    const d = window.sidekickDesktop
    if (!d?.getSpriteInteractionLocked || !d.onSpriteInteractionLocked) return
    void d.getSpriteInteractionLocked().then((v) => {
      if (typeof v === 'boolean') {
        setSpriteInteractionLocked(v)
        if (v) dispatch({ type: 'MENU_CLOSE' })
      }
    })
    return d.onSpriteInteractionLocked((locked) => {
      setSpriteInteractionLocked(locked)
      if (locked) dispatch({ type: 'MENU_CLOSE' })
    })
  }, [isWidgetMode, dispatch, setSpriteInteractionLocked])

  useEffect(() => {
    if (!isWidgetMode) return
    const setPw = window.sidekickDesktop?.setWidgetPointerPassthrough
    if (!setPw) return

    const onboardingEmbeddedBlocks =
      onboardingDone === false &&
      typeof window !== 'undefined' &&
      !window.sidekickDesktop?.openOnboardingWindow

    const blockPassthrough =
      menuOpen || fortuneWidgetSheetOpen || onboardingEmbeddedBlocks

    const wantPassthrough = spriteInteractionLocked && !blockPassthrough

    setPw(wantPassthrough)

    return () => {
      setPw(false)
    }
  }, [
    isWidgetMode,
    spriteInteractionLocked,
    menuOpen,
    fortuneWidgetSheetOpen,
    onboardingDone,
  ])

  useEffect(() => {
    if (!isToastMode) return
    void window.sidekickDesktop?.getSpriteInteractionLocked?.().then((v) => {
      if (typeof v === 'boolean') setSpriteInteractionLocked(v)
    })
  }, [isToastMode, setSpriteInteractionLocked])

  useEffect(() => {
    if (!isToastMode) return
    document.documentElement.classList.add('sidekick-toast-root')
    document.body.classList.add('sidekick-toast-root')
    return () => {
      document.documentElement.classList.remove('sidekick-toast-root')
      document.body.classList.remove('sidekick-toast-root')
    }
  }, [isToastMode])

  useEffect(() => {
    if (!isDragTrailMode) return
    document.documentElement.classList.add('sidekick-drag-trail-root')
    document.body.classList.add('sidekick-drag-trail-root')
    return () => {
      document.documentElement.classList.remove('sidekick-drag-trail-root')
      document.body.classList.remove('sidekick-drag-trail-root')
    }
  }, [isDragTrailMode])

  useEffect(() => {
    if (!themeSyncApplies) {
      document.documentElement.removeAttribute('data-theme')
      return
    }
    document.documentElement.dataset.theme = settings.darkMode ? 'dark' : 'light'
    return () => {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [themeSyncApplies, settings.darkMode])

  useEffect(() => {
    if (!isPanelMode && !isOnboardingMode) return
    document.documentElement.classList.add('sidekick-panel-root')
    document.body.classList.add('sidekick-panel-root')
    return () => {
      document.documentElement.classList.remove('sidekick-panel-root')
      document.body.classList.remove('sidekick-panel-root')
    }
  }, [isPanelMode, isOnboardingMode])

  useEffect(() => {
    if (!settingsReady) return
    if (isToastMode) return
    void window.sidekickDesktop?.setToastAnchorPreference?.({
      anchor: uiState.toastAnchor,
    })
  }, [settingsReady, uiState.toastAnchor, isToastMode])
}
