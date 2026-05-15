import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useLayoutEffect } from 'react'
import type { EmotionKind } from '@sidekick/core'
import type { MenuAction } from '../components/menu/SpriteMenu'
import type { SidekickSettings } from '../state/settingsState'
import type { UiAction, UiState } from '../state/uiState'
import { canPushNow } from './companionCopy'
import { parseMenuActionFromMessage } from '../components/menu/SpriteMenu'

export type UseDetachedSpriteMenuArgs = {
  isToastMode: boolean
  menuOpen: boolean
  spriteMenuSurface: 'sprite' | 'toast-bubble'
  detachedWidgetSpriteMenu: boolean
  uiState: UiState
  settingsRef: MutableRefObject<SidekickSettings>
  requestCompanionTextRef: MutableRefObject<
    ((keyword?: string, emotion?: EmotionKind) => Promise<void>) | undefined
  >
  handleMenuActionRef: MutableRefObject<(action: MenuAction) => void>
  dispatch: Dispatch<UiAction>
  setSpriteMenuSurface: Dispatch<SetStateAction<'sprite' | 'toast-bubble'>>
  setSpriteMenuUsesBrowserPopup: Dispatch<SetStateAction<boolean>>
  browserSpriteMenuWindowRef: MutableRefObject<Window | null>
}

export function useDetachedSpriteMenu({
  isToastMode,
  menuOpen,
  spriteMenuSurface,
  detachedWidgetSpriteMenu,
  uiState,
  settingsRef,
  requestCompanionTextRef,
  handleMenuActionRef,
  dispatch,
  setSpriteMenuSurface,
  setSpriteMenuUsesBrowserPopup,
  browserSpriteMenuWindowRef,
}: UseDetachedSpriteMenuArgs) {
  const openDetachedSpriteMenuSupported =
    typeof window.sidekickDesktop?.openWidgetSpriteMenu === 'function'
  const useDetachedSpriteMenuLayout =
    openDetachedSpriteMenuSupported && (detachedWidgetSpriteMenu || isToastMode)

  useLayoutEffect(() => {
    if (!useDetachedSpriteMenuLayout) return
    if (!menuOpen) {
      void window.sidekickDesktop?.closeWidgetSpriteMenu?.({ notify: false })
      return
    }
    let cancelled = false
    let opened = false
    let lateTimer: ReturnType<typeof setTimeout> | null = null

    const invokeBounds = (r: DOMRectReadOnly) => {
      void window.sidekickDesktop?.openWidgetSpriteMenu?.({
        left: window.screenX + r.left,
        top: window.screenY + r.top,
        right: window.screenX + r.right,
        bottom: window.screenY + r.bottom,
        width: r.width,
        height: r.height,
      })
    }

    const invokeCenterFallback = () => {
      if (cancelled || opened) return
      opened = true
      const pad = 28
      const ix = Math.max(
        pad,
        Math.min(window.innerWidth - pad, window.innerWidth / 2),
      )
      const iy = Math.max(
        pad,
        Math.min(window.innerHeight - pad, window.innerHeight / 2),
      )
      const cx = window.screenX + ix
      const cy = window.screenY + iy
      void window.sidekickDesktop?.openWidgetSpriteMenu?.({
        left: cx - pad,
        top: cy - pad,
        right: cx + pad,
        bottom: cy + pad,
        width: pad * 2,
        height: pad * 2,
      })
    }

    const resolveAnchorEl = (useToastToolbarAnchor: boolean) => {
      let el: HTMLElement | null = null
      if (useToastToolbarAnchor) {
        el =
          document.getElementById('sk-toast-sprite-menu-anchor') ??
          document.querySelector('[data-sprite-menu-anchor="toast-toolbar"]')
      } else {
        el = document.querySelector('[data-sprite-menu-trigger]')
      }
      if (el instanceof HTMLElement) {
        const r0 = el.getBoundingClientRect()
        const isFallback =
          el.getAttribute('data-emotion-toast-menu-fallback') != null
        if (
          useToastToolbarAnchor &&
          !isFallback &&
          (r0.width < 8 || r0.height < 8)
        ) {
          const fb = document.querySelector('[data-emotion-toast-menu-fallback]')
          if (fb instanceof HTMLElement) el = fb
        }
      }
      if (!(el instanceof HTMLElement)) {
        const fb = document.querySelector('[data-emotion-toast-menu-fallback]')
        if (fb instanceof HTMLElement) el = fb
      }
      return el
    }

    const tryMeasureAndInvoke = () => {
      if (cancelled || opened) return true
      const useToastToolbarAnchor =
        isToastMode || spriteMenuSurface === 'toast-bubble'
      const el = resolveAnchorEl(useToastToolbarAnchor)
      if (!(el instanceof HTMLElement)) return false
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return false
      opened = true
      invokeBounds(r)
      return true
    }

    let attempts = 0
    const tick = () => {
      if (cancelled) return
      if (tryMeasureAndInvoke()) return
      attempts += 1
      if (attempts < 12) {
        requestAnimationFrame(tick)
      } else {
        invokeCenterFallback()
      }
    }

    requestAnimationFrame(tick)
    lateTimer = window.setTimeout(() => {
      lateTimer = null
      if (cancelled) return
      if (!tryMeasureAndInvoke()) invokeCenterFallback()
    }, 220)

    return () => {
      cancelled = true
      if (lateTimer != null) {
        window.clearTimeout(lateTimer)
        lateTimer = null
      }
      void window.sidekickDesktop?.closeWidgetSpriteMenu?.({ notify: false })
    }
  }, [useDetachedSpriteMenuLayout, menuOpen, isToastMode, spriteMenuSurface])

  useEffect(() => {
    if (!detachedWidgetSpriteMenu && !isToastMode) return
    return window.sidekickDesktop?.onWidgetSpriteMenuPick?.((action) => {
      handleMenuActionRef.current(action as MenuAction)
    })
  }, [detachedWidgetSpriteMenu, isToastMode, handleMenuActionRef])

  useEffect(() => {
    if (!detachedWidgetSpriteMenu && !isToastMode) return
    return window.sidekickDesktop?.onWidgetSpriteMenuClosed?.(() => {
      dispatch({ type: 'MENU_CLOSE' })
    })
  }, [detachedWidgetSpriteMenu, isToastMode, dispatch])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'sidekick-sprite-menu-pick') {
        const action = parseMenuActionFromMessage(e.data?.action)
        if (action == null) return
        handleMenuActionRef.current(action)
        setSpriteMenuUsesBrowserPopup(false)
        browserSpriteMenuWindowRef.current = null
        return
      }
      if (e.data?.type === 'sidekick-sprite-menu-dismiss') {
        dispatch({ type: 'MENU_CLOSE' })
        setSpriteMenuUsesBrowserPopup(false)
        browserSpriteMenuWindowRef.current = null
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [dispatch, setSpriteMenuUsesBrowserPopup, browserSpriteMenuWindowRef])

  const openBrowserSpriteMenuPopup = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.open !== 'function') {
      return
    }
    try {
      const u = new URL(window.location.href)
      u.search = '?mode=sprite-menu'
      const features =
        'popup=yes,width=200,height=280,left=80,top=80,toolbar=0,menubar=0,location=0,status=0'
      const handle = window.open(u.toString(), 'sidekick_sprite_menu', features)
      browserSpriteMenuWindowRef.current = handle
      if (handle) {
        setSpriteMenuUsesBrowserPopup(true)
      }
    } catch {
      /* noop */
    }
  }, [browserSpriteMenuWindowRef, setSpriteMenuUsesBrowserPopup])

  const openSpriteMenuFromToastToolbar = useCallback(() => {
    const s = settingsRef.current
    if (menuOpen && s.clickToFetchEnabled && canPushNow(s)) {
      void requestCompanionTextRef.current?.('点击精灵互动')
    }
    const toolbarMenuExpanded =
      uiState.menuState === 'open' || uiState.menuState === 'opening'
    if (!toolbarMenuExpanded) {
      setSpriteMenuSurface('toast-bubble')
    }
    dispatch({
      type: toolbarMenuExpanded ? 'MENU_CLOSE' : 'MENU_OPEN',
    })
    if (
      !toolbarMenuExpanded &&
      typeof window.sidekickDesktop?.openWidgetSpriteMenu !== 'function'
    ) {
      openBrowserSpriteMenuPopup()
    }
  }, [
    menuOpen,
    uiState.menuState,
    dispatch,
    openBrowserSpriteMenuPopup,
    requestCompanionTextRef,
    setSpriteMenuSurface,
    settingsRef,
  ])

  useEffect(() => {
    if (!menuOpen) {
      setSpriteMenuSurface('sprite')
      setSpriteMenuUsesBrowserPopup(false)
      const w = browserSpriteMenuWindowRef.current
      if (w && !w.closed) {
        try {
          w.close()
        } catch {
          /* noop */
        }
      }
      browserSpriteMenuWindowRef.current = null
    }
  }, [
    menuOpen,
    browserSpriteMenuWindowRef,
    setSpriteMenuSurface,
    setSpriteMenuUsesBrowserPopup,
  ])

  return {
    openDetachedSpriteMenuSupported,
    openSpriteMenuFromToastToolbar,
  }
}
