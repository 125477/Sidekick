import { app, BrowserWindow, screen } from 'electron'
import { clamp } from './geometry.mjs'
import {
  APP_DISPLAY_NAME,
  SPRITE_MENU_WINDOW_HEIGHT,
  SPRITE_MENU_WINDOW_WIDTH,
} from './constants.mjs'
import { devBaseUrlCandidates, resolveLiveBaseUrl } from './resolveLiveBaseUrl.mjs'
import { preloadPath } from './paths.mjs'
import { buildRoute } from './route.mjs'
import { state } from './state.mjs'

const SPRITE_MENU_BLUR_GRACE_MS = 400

/** @type {number} */
let spriteMenuIgnoreBlurUntil = 0

export function normalizeSpriteMenuScreenBounds(payload) {
  if (!payload || typeof payload !== 'object') return null
  const left = Number(payload.left)
  const top = Number(payload.top)
  const right = Number(payload.right)
  const bottom = Number(payload.bottom)
  if (![left, top, right, bottom].every(Number.isFinite)) return null
  if (right - left < 8 || bottom - top < 8) {
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const pad = 20
    return {
      left: cx - pad,
      top: cy - pad,
      right: cx + pad,
      bottom: cy + pad,
    }
  }
  return { left, top, right, bottom }
}

function normalizeSpriteMenuTheme(payload) {
  const t = payload?.theme
  return t === 'dark' || t === 'light' ? t : null
}

function spriteMenuRoute(baseUrl, theme) {
  const t = theme === 'dark' || theme === 'light' ? theme : 'light'
  return buildRoute(baseUrl, 'sprite-menu', { theme: t })
}

/**
 * @param {'sprite' | 'toast'} invoker
 * @returns {Promise<'dark' | 'light' | null>}
 */
async function readThemeFromInvokerWindow(invoker) {
  const win =
    invoker === 'toast' ? state.toastWindow : state.spriteWindow
  if (!win || win.isDestroyed()) return null
  try {
    const raw = await win.webContents.executeJavaScript(
      `(function () {
        var t = document.documentElement.getAttribute('data-theme')
        if (t === 'dark' || t === 'light') return t
        try {
          var c = localStorage.getItem('sidekick.effectiveTheme')
          if (c === 'dark' || c === 'light') return c
        } catch (e) {}
        return window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      })()`,
      true,
    )
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

function notifySpriteMenuClosed() {
  if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
    state.spriteWindow.webContents.send('sidekick:widget-sprite-menu-closed')
  }
  if (state.toastWindow && !state.toastWindow.isDestroyed()) {
    state.toastWindow.webContents.send('sidekick:widget-sprite-menu-closed')
  }
}

/** @type {{ onAppWindowFocus: (event: unknown, win: import('electron').BrowserWindow) => void } | null} */
let spriteMenuDismissHooks = null

function detachSpriteMenuDismissHooks() {
  if (!spriteMenuDismissHooks) return
  app.removeListener('browser-window-focus', spriteMenuDismissHooks.onAppWindowFocus)
  spriteMenuDismissHooks = null
}

function shouldDismissSpriteMenu(menuWin) {
  if (!menuWin || menuWin.isDestroyed() || !menuWin.isVisible()) return false
  if (Date.now() < spriteMenuIgnoreBlurUntil) return false
  return BrowserWindow.getFocusedWindow() !== menuWin
}

function dismissSpriteMenuIfNeeded(menuWin) {
  if (!shouldDismissSpriteMenu(menuWin)) return
  closeWidgetSpriteMenuWindow({ notify: true })
}

/** 失焦或点到其它窗口（含桌面 / 其它 App）时关闭菜单。 */
function attachSpriteMenuDismissHandlers(menuWin) {
  detachSpriteMenuDismissHooks()
  try {
    menuWin.removeAllListeners('blur')
  } catch {
    /* noop */
  }
  menuWin.on('blur', () => dismissSpriteMenuIfNeeded(menuWin))

  const onAppWindowFocus = (_event, focusedWin) => {
    if (focusedWin === menuWin) return
    dismissSpriteMenuIfNeeded(menuWin)
  }
  app.on('browser-window-focus', onAppWindowFocus)
  spriteMenuDismissHooks = { onAppWindowFocus }
  menuWin.once('closed', () => detachSpriteMenuDismissHooks())
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {'dark' | 'light' | null} theme
 */
async function loadSpriteMenuPage(win, theme) {
  const primary = resolveLiveBaseUrl()
  const candidates = app.isPackaged
    ? [primary]
    : devBaseUrlCandidates()

  let lastErr
  for (const baseUrl of candidates) {
    if (!baseUrl || win.isDestroyed()) break
    const url = spriteMenuRoute(baseUrl, theme)
    try {
      await win.loadURL(url)
      if (!app.isPackaged) state.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
      return url
    } catch (err) {
      lastErr = err
      if (win.isDestroyed()) break
      console.warn('[sidekick] sprite-menu load failed', baseUrl, err)
    }
  }
  throw lastErr ?? new Error('sprite-menu: load failed')
}

export function closeWidgetSpriteMenuWindow(opts = {}) {
  detachSpriteMenuDismissHooks()
  const notify = opts.notify === true
  const w = state.spriteMenuWindow
  if (!w || w.isDestroyed()) {
    state.spriteMenuWindow = null
    state.lastSpriteMenuInvoker = null
    return
  }
  const wasVisible = w.isVisible()
  state.lastSpriteMenuInvoker = null
  try {
    w.removeAllListeners('blur')
  } catch {
    /* noop */
  }
  const target = w
  w.once('closed', () => {
    if (state.spriteMenuWindow === target) state.spriteMenuWindow = null
    if (notify && wasVisible) notifySpriteMenuClosed()
  })
  w.close()
}

export function hideWidgetSpriteMenuWindow(opts = {}) {
  closeWidgetSpriteMenuWindow(opts)
}

export function destroyWidgetSpriteMenuWindow() {
  closeWidgetSpriteMenuWindow({ notify: false })
}

export async function warmSpriteMenuWindow() {
  return true
}

function computeSpriteMenuBounds(screenBounds, invoker) {
  const MENU_W = SPRITE_MENU_WINDOW_WIDTH
  const MENU_H = SPRITE_MENU_WINDOW_HEIGHT
  const gap = 6
  const margin = 4

  let x
  let y

  if (invoker === 'toast' && state.toastWindow && !state.toastWindow.isDestroyed()) {
    const tb = state.toastWindow.getBounds()
    const { workArea: wa } = screen.getDisplayNearestPoint({
      x: tb.x + tb.width / 2,
      y: tb.y + tb.height / 2,
    })
    x = Math.round(tb.x + tb.width + gap)
    if (x + MENU_W > wa.x + wa.width - margin) {
      x = Math.round(tb.x - MENU_W - gap)
    }
    x = clamp(x, wa.x + margin, wa.x + wa.width - MENU_W - margin)
    y = Math.round(tb.y + tb.height - MENU_H)
    y = clamp(y, wa.y + margin, wa.y + wa.height - MENU_H - margin)
  } else {
    const b = screenBounds
    const { workArea: wa } = screen.getDisplayNearestPoint({
      x: b.left,
      y: b.top,
    })
    x = Math.round(b.left - MENU_W - gap)
    if (x < wa.x + margin) {
      x = Math.round(b.right + gap)
    }
    y = Math.round(b.bottom - MENU_H)
    x = clamp(x, wa.x + margin, wa.x + wa.width - MENU_W - margin)
    y = clamp(y, wa.y + margin, wa.y + wa.height - MENU_H - margin)
  }

  return { x, y, width: MENU_W, height: MENU_H }
}

/**
 * @param {{ left: number; top: number; right: number; bottom: number; theme?: 'dark' | 'light' }} payload
 * @param {'sprite' | 'toast'} invoker
 */
export function openWidgetSpriteMenuWindow(payload, invoker) {
  const anchor = normalizeSpriteMenuScreenBounds(payload)
  if (!anchor) return
  const bounds = computeSpriteMenuBounds(anchor, invoker)

  void (async () => {
    let theme = normalizeSpriteMenuTheme(payload)
    if (!theme) theme = await readThemeFromInvokerWindow(invoker)

    closeWidgetSpriteMenuWindow({ notify: false })

    const win = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      hasShadow: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      title: `${APP_DISPLAY_NAME} · 菜单`,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
      },
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    state.spriteMenuWindow = win
    state.lastSpriteMenuInvoker = invoker

    const reveal = () => {
      if (win.isDestroyed() || state.spriteMenuWindow !== win) return
      spriteMenuIgnoreBlurUntil = Date.now() + SPRITE_MENU_BLUR_GRACE_MS
      attachSpriteMenuDismissHandlers(win)
      win.show()
      win.focus()
      spriteMenuIgnoreBlurUntil = Date.now() + SPRITE_MENU_BLUR_GRACE_MS
    }

    win.once('ready-to-show', reveal)

    try {
      await loadSpriteMenuPage(win, theme)
    } catch (err) {
      console.error('[sidekick] sprite-menu open failed', err)
      if (!win.isDestroyed() && state.spriteMenuWindow === win) {
        closeWidgetSpriteMenuWindow({ notify: false })
      }
    }
  })()
}
