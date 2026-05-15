import { BrowserWindow, screen } from 'electron'
import { clamp } from './geometry.mjs'
import {
  APP_DISPLAY_NAME,
  SPRITE_MENU_WINDOW_HEIGHT,
  SPRITE_MENU_WINDOW_WIDTH,
} from './constants.mjs'
import { preloadPath } from './paths.mjs'
import { buildRoute } from './route.mjs'
import { state } from './state.mjs'

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

export function closeWidgetSpriteMenuWindow(opts = {}) {
  const notify = opts.notify === true
  const w = state.spriteMenuWindow
  if (!w || w.isDestroyed()) {
    state.spriteMenuWindow = null
    state.lastSpriteMenuInvoker = null
    return
  }
  state.lastSpriteMenuInvoker = null
  try {
    w.removeAllListeners('blur')
  } catch {
    /* noop */
  }
  const target = w
  w.once('closed', () => {
    if (state.spriteMenuWindow === target) state.spriteMenuWindow = null
    if (notify) {
      if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
        state.spriteWindow.webContents.send('sidekick:widget-sprite-menu-closed')
      }
      if (state.toastWindow && !state.toastWindow.isDestroyed()) {
        state.toastWindow.webContents.send('sidekick:widget-sprite-menu-closed')
      }
    }
  })
  w.close()
}

/**
 * @param {{ left: number; top: number; right: number; bottom: number }} screenBounds
 * @param {'sprite' | 'toast'} invoker
 */
export function openWidgetSpriteMenuWindow(screenBounds, invoker) {
  closeWidgetSpriteMenuWindow({ notify: false })

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

  const win = new BrowserWindow({
    x,
    y,
    width: MENU_W,
    height: MENU_H,
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

  win.on('blur', () => {
    closeWidgetSpriteMenuWindow({ notify: true })
  })

  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })

  void win.loadURL(buildRoute(state.baseUrl, 'sprite-menu')).catch((err) => {
    console.error('[sidekick] sprite-menu loadURL failed', err)
    closeWidgetSpriteMenuWindow({ notify: false })
  })
}
