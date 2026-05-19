import { app, BrowserWindow } from 'electron'
import {
  APP_DISPLAY_NAME,
  AUX_WINDOW_HEIGHT,
  AUX_WINDOW_MIN_HEIGHT,
  AUX_WINDOW_MIN_WIDTH,
  AUX_WINDOW_WIDTH,
  DEV_SERVER_URL_CANDIDATES,
  PANEL_WINDOW_TITLE,
  TOAST_WINDOW_HEIGHT,
  TOAST_WINDOW_WIDTH,
  WIDGET_WINDOW_HEIGHT,
  WIDGET_WINDOW_MAX_WIDTH,
  WIDGET_WINDOW_MIN_WIDTH,
  WIDGET_WINDOW_WIDTH,
} from './constants.mjs'
import {
  applyToastWindowBounds,
} from './detachedToast.mjs'
import { preloadPath } from './paths.mjs'
import { buildRoute } from './route.mjs'
import { state } from './state.mjs'
import { closeWidgetSpriteMenuWindow } from './spriteMenu.mjs'
import { stopToastPassthroughHitTest } from './toastPassthrough.mjs'
import { computeToastPlacement } from './toastPlacement.mjs'
import { awaitWebContentsNavigationSettled } from './navigationWait.mjs'
import { destroyDragTrailWindow, warmDragTrailWindow } from './dragTrail.mjs'
import {
  persistWidgetBounds,
  resolveInitialWidgetBounds,
  schedulePersistWidgetBounds,
} from './widgetBounds.mjs'

export function createSpriteWindow() {
  const window = new BrowserWindow({
    width: WIDGET_WINDOW_WIDTH,
    height: WIDGET_WINDOW_HEIGHT,
    minWidth: WIDGET_WINDOW_MIN_WIDTH,
    maxWidth: WIDGET_WINDOW_MAX_WIDTH,
    minHeight: WIDGET_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    thickFrame: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: APP_DISPLAY_NAME,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  })

  window.setBounds(resolveInitialWidgetBounds())

  state.spriteWindow = window
  window.setAlwaysOnTop(true, 'screen-saver')

  const tryLoadSprite = () => {
    if (!app.isPackaged) {
      state.baseUrl =
        DEV_SERVER_URL_CANDIDATES[state.candidateIndex] ?? DEV_SERVER_URL_CANDIDATES[0]
      state.candidateIndex = (state.candidateIndex + 1) % DEV_SERVER_URL_CANDIDATES.length
    }
    void window.loadURL(buildRoute(state.baseUrl, 'widget'))
  }

  window.webContents.on('did-fail-load', () => {
    if (!app.isPackaged) {
      window.setTitle(`${APP_DISPLAY_NAME}（等待 UI 开发服务器…）`)
      setTimeout(() => {
        tryLoadSprite()
      }, 1000)
    }
  })

  window.webContents.once('did-finish-load', () => {
    void warmDragTrailWindow()
  })

  window.on('move', () => {
    closeWidgetSpriteMenuWindow({ notify: true })
    schedulePersistWidgetBounds(window)
    if (state.toastWindow && !state.toastWindow.isDestroyed()) {
      applyToastWindowBounds()
    }
  })

  window.on('moved', () => {
    if (state.widgetBoundsSaveTimer) {
      clearTimeout(state.widgetBoundsSaveTimer)
      state.widgetBoundsSaveTimer = null
    }
    persistWidgetBounds(window)
  })

  window.on('resize', () => {
    schedulePersistWidgetBounds(window)
    state.spriteAnchorBase = null
    state.spriteBoundsAtAnchorSet = null
    state.lastSpriteAnchor = null
    if (state.toastWindow && !state.toastWindow.isDestroyed()) {
      applyToastWindowBounds()
    }
  })

  window.on('close', () => {
    if (state.widgetBoundsSaveTimer) {
      clearTimeout(state.widgetBoundsSaveTimer)
      state.widgetBoundsSaveTimer = null
    }
    persistWidgetBounds(window)
  })

  window.on('closed', () => {
    destroyDragTrailWindow()
    closeWidgetSpriteMenuWindow({ notify: false })
    try {
      if (!window.isDestroyed()) {
        window.setIgnoreMouseEvents(false)
      }
    } catch {
      /* noop */
    }
    state.spriteWindow = null
    state.lastSpriteAnchor = null
    state.spriteAnchorBase = null
    state.spriteBoundsAtAnchorSet = null
    if (state.panelWindow && !state.panelWindow.isDestroyed()) state.panelWindow.close()
    if (state.onboardingWindow && !state.onboardingWindow.isDestroyed()) {
      state.onboardingWindow.close()
    }
    if (state.toastWindow && !state.toastWindow.isDestroyed()) state.toastWindow.close()
  })

  tryLoadSprite()
}

export function openPanelWindow(panel, opts = {}) {
  const params = { panel }
  if (opts.emotionTab === 'summary' || opts.emotionTab === 'moment') {
    params.emotionTab = opts.emotionTab
  }
  if (state.panelWindow && !state.panelWindow.isDestroyed()) {
    void state.panelWindow.loadURL(buildRoute(state.baseUrl, 'panel', params))
    state.panelWindow.show()
    state.panelWindow.focus()
    return
  }

  state.panelWindow = new BrowserWindow({
    width: AUX_WINDOW_WIDTH,
    height: AUX_WINDOW_HEIGHT,
    minWidth: AUX_WINDOW_MIN_WIDTH,
    minHeight: AUX_WINDOW_MIN_HEIGHT,
    title: `${APP_DISPLAY_NAME} · ${PANEL_WINDOW_TITLE[panel] ?? panel}`,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
    },
  })
  state.panelWindow.once('ready-to-show', () => {
    if (!state.panelWindow || state.panelWindow.isDestroyed()) return
    state.panelWindow.show()
    state.panelWindow.focus()
  })
  void state.panelWindow.loadURL(buildRoute(state.baseUrl, 'panel', params)).catch((err) => {
    console.error('[sidekick] panel loadURL failed', err)
    if (state.panelWindow && !state.panelWindow.isDestroyed()) {
      state.panelWindow.show()
      state.panelWindow.focus()
    }
  })
  state.panelWindow.on('closed', () => {
    state.panelWindow = null
  })
}

export function openOnboardingWindow() {
  if (state.onboardingWindow && !state.onboardingWindow.isDestroyed()) {
    state.onboardingWindow.show()
    state.onboardingWindow.focus()
    return
  }

  state.onboardingWindow = new BrowserWindow({
    width: AUX_WINDOW_WIDTH,
    height: AUX_WINDOW_HEIGHT,
    minWidth: AUX_WINDOW_MIN_WIDTH,
    minHeight: AUX_WINDOW_MIN_HEIGHT,
    title: `${APP_DISPLAY_NAME} · 首次引导`,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
    },
  })
  state.onboardingWindow.once('ready-to-show', () => {
    if (!state.onboardingWindow || state.onboardingWindow.isDestroyed()) return
    state.onboardingWindow.show()
    state.onboardingWindow.center()
    state.onboardingWindow.focus()
  })
  void state.onboardingWindow.loadURL(buildRoute(state.baseUrl, 'onboarding')).catch((err) => {
    console.error('[sidekick] onboarding loadURL failed', err)
    if (state.onboardingWindow && !state.onboardingWindow.isDestroyed()) {
      state.onboardingWindow.show()
      state.onboardingWindow.focus()
    }
  })
  state.onboardingWindow.on('closed', () => {
    state.onboardingWindow = null
  })
}

export async function showToastWindow(payload) {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
  const message = String(payload?.message ?? '').trim()
  if (!message) return
  const textId =
    typeof payload?.textId === 'string' && payload.textId.trim()
      ? payload.textId.trim()
      : undefined
  const favorite =
    typeof payload?.favorite === 'boolean' ? payload.favorite : undefined
  const toastIntro = payload?.toastIntro === true
  state.lastPreferredToastAnchor = payload?.anchor === 'bottom' ? 'bottom' : 'top'
  const dwellSeconds = Number(payload?.dwellSeconds ?? 180)
  state.lastToastSession = null
  stopToastPassthroughHitTest()

  if (!state.toastWindow || state.toastWindow.isDestroyed()) {
    state.toastWindow = new BrowserWindow({
      width: TOAST_WINDOW_WIDTH,
      height: TOAST_WINDOW_HEIGHT,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    })
    state.toastWindow.setAlwaysOnTop(true, 'floating')
    state.toastWindow.on('closed', () => {
      stopToastPassthroughHitTest()
      state.toastWindow = null
      state.lastToastSession = null
    })
  }

  state.toastWindow.setAlwaysOnTop(true, 'floating')
  applyToastWindowBounds()
  const toastH = state.toastWindow.getBounds().height || TOAST_WINDOW_HEIGHT
  const placement = computeToastPlacement(state.lastPreferredToastAnchor, toastH)
  if (!placement) return
  const { effectiveAnchor } = placement
  state.lastToastTailDown = effectiveAnchor === 'top'

  state.toastWindow.setBounds({
    x: placement.x,
    y: placement.y,
    width: TOAST_WINDOW_WIDTH,
    height: toastH,
  })

  await state.toastWindow.loadURL(
    buildRoute(state.baseUrl, 'toast', {
      message,
      ...(textId ? { textId } : {}),
      ...(typeof favorite === 'boolean' ? { favorite: favorite ? '1' : '0' } : {}),
      ...(toastIntro ? { toastIntro: '1' } : {}),
      anchor: effectiveAnchor,
      placement: effectiveAnchor === 'top' ? 'above' : 'below',
      tailDown: effectiveAnchor === 'top' ? '1' : '0',
      t: String(Date.now()),
    }),
  )
  await awaitWebContentsNavigationSettled(state.toastWindow.webContents)
  state.toastWindow.showInactive()

  state.lastToastSession = {
    message,
    effectiveAnchor,
    dwellSeconds,
    textId,
    favorite,
  }

  if (state.toastTimerId) {
    clearTimeout(state.toastTimerId)
    state.toastTimerId = null
  }
  if (dwellSeconds > 0) {
    state.toastTimerId = setTimeout(() => {
      if (state.toastWindow && !state.toastWindow.isDestroyed()) {
        stopToastPassthroughHitTest()
        state.toastWindow.hide()
      }
      state.toastTimerId = null
    }, dwellSeconds * 1000)
  }
}

export function hideToastWindow() {
  stopToastPassthroughHitTest()
  if (state.toastTimerId) {
    clearTimeout(state.toastTimerId)
    state.toastTimerId = null
  }
  state.detachToastAnchorRefreshQueued = false
  state.lastToastSession = null
  if (state.toastWindow && !state.toastWindow.isDestroyed()) {
    state.toastWindow.hide()
  }
}
