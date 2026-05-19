import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useLayoutEffect } from 'react'
import type { MenuAction } from '../components/menu/SpriteMenu'
import type { UiAction, UiState } from '../state/uiState'
import { parseMenuActionFromMessage } from '../components/menu/SpriteMenu'
import {
  readThemeForExternalWindow,
  type CachedEffectiveTheme,
  writeCachedEffectiveTheme,
} from '../state/themeBootstrap'

export type UseDetachedSpriteMenuArgs = {
  isToastMode: boolean
  menuOpen: boolean
  /** 与设置里「夜间模式」解析结果一致，避免挂件 `data-theme` 仍是浅色。 */
  menuTheme: CachedEffectiveTheme
  spriteMenuSurface: 'sprite' | 'toast-bubble'
  detachedWidgetSpriteMenu: boolean
  uiState: UiState
  handleMenuActionRef: MutableRefObject<(action: MenuAction) => void>
  dispatch: Dispatch<UiAction>
  setSpriteMenuSurface: Dispatch<SetStateAction<'sprite' | 'toast-bubble'>>
  setSpriteMenuUsesBrowserPopup: Dispatch<SetStateAction<boolean>>
  browserSpriteMenuWindowRef: MutableRefObject<Window | null>
}

function screenBoundsFromClientRect(r: DOMRectReadOnly) {
  return {
    left: window.screenX + r.left,
    top: window.screenY + r.top,
    right: window.screenX + r.right,
    bottom: window.screenY + r.bottom,
    width: r.width,
    height: r.height,
  }
}

function centerFallbackClientRect(): DOMRectReadOnly {
  const pad = 28
  const ix = Math.max(
    pad,
    Math.min(window.innerWidth - pad, window.innerWidth / 2),
  )
  const iy = Math.max(
    pad,
    Math.min(window.innerHeight - pad, window.innerHeight / 2),
  )
  return {
    x: ix - pad,
    y: iy - pad,
    width: pad * 2,
    height: pad * 2,
    left: ix - pad,
    top: iy - pad,
    right: ix + pad,
    bottom: iy + pad,
    toJSON: () => ({}),
  } as DOMRectReadOnly
}

export function useDetachedSpriteMenu({
  isToastMode,
  menuOpen,
  menuTheme,
  spriteMenuSurface,
  detachedWidgetSpriteMenu,
  uiState,
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

    let disposed = false
    const theme = readThemeForExternalWindow(menuTheme)
    writeCachedEffectiveTheme(theme)

    const invokeOpen = (r: DOMRectReadOnly) => {
      if (disposed) return
      void window.sidekickDesktop?.openWidgetSpriteMenu?.({
        ...screenBoundsFromClientRect(r),
        theme,
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

    const measureAndOpen = () => {
      if (disposed) return
      const useToastToolbarAnchor =
        isToastMode || spriteMenuSurface === 'toast-bubble'
      const el = resolveAnchorEl(useToastToolbarAnchor)
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect()
        if (r.width >= 1 && r.height >= 1) {
          invokeOpen(r)
          return
        }
      }
      invokeOpen(centerFallbackClientRect())
    }

    let rafAttempts = 0
    const tryMeasureWithRaf = () => {
      if (disposed) return
      const useToastToolbarAnchor =
        isToastMode || spriteMenuSurface === 'toast-bubble'
      const el = resolveAnchorEl(useToastToolbarAnchor)
      if (el instanceof HTMLElement) {
        const r = el.getBoundingClientRect()
        if (r.width >= 1 && r.height >= 1) {
          invokeOpen(r)
          return
        }
      }
      rafAttempts += 1
      if (rafAttempts < 8) {
        requestAnimationFrame(tryMeasureWithRaf)
        return
      }
      measureAndOpen()
    }

    // StrictMode 会连续 mount/cleanup：用 setTimeout(0) 合并为一次 IPC，避免主进程连开两窗互毁。
    const openTimer = window.setTimeout(() => {
      tryMeasureWithRaf()
    }, 0)

    return () => {
      disposed = true
      window.clearTimeout(openTimer)
    }
  }, [useDetachedSpriteMenuLayout, menuOpen, menuTheme, isToastMode, spriteMenuSurface])

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

  /** 点到挂件/气泡窗其它区域时关闭独立菜单（菜单窗本身收不到这次点击）。 */
  useEffect(() => {
    if (!useDetachedSpriteMenuLayout || !menuOpen) return

    const dismissMenu = () => {
      dispatch({ type: 'MENU_CLOSE' })
      void window.sidekickDesktop?.closeWidgetSpriteMenu?.({ notify: true })
    }

    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-sprite-menu-trigger]')) return
      if (target.closest('[data-sprite-menu-anchor]')) return
      dismissMenu()
    }

    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDownCapture, true)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', onPointerDownCapture, true)
    }
  }, [useDetachedSpriteMenuLayout, menuOpen, dispatch])

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
    uiState.menuState,
    dispatch,
    openBrowserSpriteMenuPopup,
    setSpriteMenuSurface,
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
