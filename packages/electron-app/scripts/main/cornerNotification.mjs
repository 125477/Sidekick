import { app, BrowserWindow, screen } from 'electron'
import {
  CORNER_NOTIFICATION_HEIGHT,
  CORNER_NOTIFICATION_MARGIN,
  CORNER_NOTIFICATION_WIDTH,
} from './constants.mjs'
import { awaitWebContentsNavigationSettled } from './navigationWait.mjs'
import { preloadPath } from './paths.mjs'
import { buildRoute, cornerNotificationWebContentsReady } from './route.mjs'
import { devBaseUrlCandidates } from './resolveLiveBaseUrl.mjs'
import { state } from './state.mjs'
import { openPanelWindow } from './windows.mjs'

/**
 * @param {number} width
 * @param {number} height
 * @param {number} [margin]
 */
export function computeCornerNotificationBounds(
  width,
  height,
  margin = CORNER_NOTIFICATION_MARGIN,
) {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: Math.round(workArea.x + workArea.width - width - margin),
    y: Math.round(workArea.y + workArea.height - height - margin),
    width,
    height,
  }
}

export function hideCornerNotificationWindow() {
  const win = state.cornerNotificationWindow
  if (!win || win.isDestroyed()) return
  win.hide()
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {string} url
 */
async function loadCornerNotificationRoute(win, url) {
  await win.loadURL(url)
  await awaitWebContentsNavigationSettled(win.webContents)
  return cornerNotificationWebContentsReady(win.webContents)
}

/**
 * @param {{ title?: string; body: string; panel?: string; emotionTab?: string }} payload
 */
export async function showCornerNotificationWindow(payload) {
  const body = String(payload?.body ?? '').trim()
  if (!body) return false

  const title = String(payload?.title ?? '灵伴 · 今日心情').trim() || '灵伴 · 今日心情'
  const panel = payload?.panel === 'emotion' ? 'emotion' : 'emotion'
  const emotionTab = payload?.emotionTab === 'summary' ? 'summary' : 'summary'

  state.cornerNotificationPayload = { panel, emotionTab }

  const width = CORNER_NOTIFICATION_WIDTH
  const height = CORNER_NOTIFICATION_HEIGHT

  if (!state.cornerNotificationWindow || state.cornerNotificationWindow.isDestroyed()) {
    state.cornerNotificationWindow = new BrowserWindow({
      width,
      height,
      frame: false,
      transparent: true,
      hasShadow: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      show: false,
      backgroundColor: '#00000000',
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    })
    state.cornerNotificationWindow.setAlwaysOnTop(true, 'screen-saver')
    state.cornerNotificationWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
    })
    state.cornerNotificationWindow.on('closed', () => {
      state.cornerNotificationWindow = null
      state.cornerNotificationPayload = null
    })
  }

  state.cornerNotificationWindow.setBounds(
    computeCornerNotificationBounds(width, height),
  )

  const routeParams = {
    title,
    message: body,
    t: String(Date.now()),
  }

  let loaded = false
  for (const baseUrl of devBaseUrlCandidates()) {
    const url = buildRoute(baseUrl, 'corner-notification', routeParams)
    try {
      loaded = await loadCornerNotificationRoute(state.cornerNotificationWindow, url)
      if (loaded) {
        if (!app.isPackaged) state.baseUrl = baseUrl
        break
      }
    } catch (err) {
      console.warn('[sidekick] corner notification load failed', baseUrl, err)
    }
  }

  if (!loaded) {
    console.warn(
      '[sidekick] corner notification page not ready',
      state.cornerNotificationWindow.webContents.getURL(),
    )
    return false
  }

  if (process.platform === 'darwin') {
    state.cornerNotificationWindow.show()
  } else {
    state.cornerNotificationWindow.showInactive()
  }

  return true
}

export function openCornerNotificationTarget() {
  const payload = state.cornerNotificationPayload
  hideCornerNotificationWindow()
  openPanelWindow('emotion', {
    emotionTab: payload?.emotionTab === 'summary' ? 'summary' : 'summary',
  })
}
