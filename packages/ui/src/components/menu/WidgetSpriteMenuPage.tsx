import { useEffect, useLayoutEffect } from 'react'
import {
  applyEffectiveThemeToDocument,
  readThemeFromLocationSearch,
} from '../../state/themeBootstrap'
import {
  SpriteMenuPanel,
  type MenuAction,
} from './SpriteMenu'

/**
 * Electron `mode=sprite-menu`：独立无边框窗体，避免在窄挂件窗内被裁切。
 */
export function WidgetSpriteMenuPage() {
  useLayoutEffect(() => {
    const urlTheme = readThemeFromLocationSearch()
    if (urlTheme) applyEffectiveThemeToDocument(urlTheme)
    document.documentElement.classList.remove('sk-sprite-menu-pending')
  }, [])

  useEffect(() => {
    document.documentElement.classList.add('sidekick-toast-root')
    document.body.classList.add('sidekick-toast-root')
    return () => {
      document.documentElement.classList.remove('sidekick-toast-root')
      document.body.classList.remove('sidekick-toast-root')
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (window.sidekickDesktop?.closeWidgetSpriteMenu) {
        void window.sidekickDesktop.closeWidgetSpriteMenu({ notify: true })
        return
      }
      try {
        window.opener?.postMessage(
          { type: 'sidekick-sprite-menu-dismiss' },
          window.location.origin,
        )
      } catch {
        /* noop */
      }
      window.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      try {
        window.focus()
      } catch {
        /* noop */
      }
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  const onPick = (action: MenuAction) => {
    const submit = window.sidekickDesktop?.submitWidgetSpriteMenuAction
    if (submit) {
      void submit(action)
      return
    }
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: 'sidekick-sprite-menu-pick', action },
          window.location.origin,
        )
      }
    } catch {
      /* noop */
    }
    window.close()
  }

  return (
    <main className="box-border flex h-full min-h-0 w-full flex-col items-start bg-transparent p-0 outline-none [-webkit-app-region:no-drag]">
      {/** 勿对菜单 `flex-1`：会占满固定窗高，视觉上像各行被拉高（含「设置」）。按内容高度即可。 */}
      <SpriteMenuPanel onPick={onPick} className="w-full shrink-0" />
    </main>
  )
}
