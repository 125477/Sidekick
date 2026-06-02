import { BrowserWindow, screen } from 'electron'
import { preloadPath } from './paths.mjs'

/** @type {import('electron').BrowserWindow[]} */
let overlayWindows = []

/** @type {(() => void) | null} */
let dismissHandler = null

export function setSpriteMenuOutsideDismissHandler(handler) {
  dismissHandler = typeof handler === 'function' ? handler : null
}

function destroySpriteMenuDismissOverlays() {
  for (const win of overlayWindows) {
    if (!win || win.isDestroyed()) continue
    try {
      win.close()
    } catch {
      /* noop */
    }
  }
  overlayWindows = []
}

function bindOverlayDismissPointer(win) {
  if (!win || win.isDestroyed()) return
  const script = `(function () {
    if (window.__sidekickMenuDismissBound) return
    window.__sidekickMenuDismissBound = true
    var body = document.body
    body.style.margin = '0'
    body.style.width = '100vw'
    body.style.height = '100vh'
    body.style.background = 'transparent'
    var notify = function () {
      if (window.sidekickDesktop && window.sidekickDesktop.dismissSpriteMenuOutsideClick) {
        window.sidekickDesktop.dismissSpriteMenuOutsideClick()
      }
    }
    body.addEventListener('pointerdown', notify, true)
  })()`
  const run = () => {
    if (win.isDestroyed()) return
    void win.webContents.executeJavaScript(script, true).catch(() => {})
  }
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', run)
  } else {
    run()
  }
}

/**
 * 菜单下方铺透明全屏层：点菜单外任意处先关菜单（菜单窗在其上，不受影响）。
 * 第一次点击用于关菜单，随后遮罩立即销毁，不再挡屏。
 */
export function showSpriteMenuDismissOverlays(menuWin) {
  destroySpriteMenuDismissOverlays()
  if (!menuWin || menuWin.isDestroyed()) return

  for (const display of screen.getAllDisplays()) {
    const { x, y, width, height } = display.workArea
    const win = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      acceptFirstMouse: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
      },
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    void win.loadURL('about:blank')
    bindOverlayDismissPointer(win)
    win.show()
    overlayWindows.push(win)
  }

  if (!menuWin.isDestroyed()) {
    menuWin.setAlwaysOnTop(true, 'screen-saver')
    menuWin.moveTop()
  }
}

export function hideSpriteMenuDismissOverlays() {
  destroySpriteMenuDismissOverlays()
}

export function onSpriteMenuOutsideClick() {
  hideSpriteMenuDismissOverlays()
  dismissHandler?.()
}
