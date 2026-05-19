import { app, ipcMain, screen } from 'electron'
import { dashscopeTtsFetch } from '../dashscopeTtsFetch.mjs'
import { dashscopeChatCompleteWithFallback } from './dashscopeChat.mjs'
import { clamp } from './geometry.mjs'
import {
  AUX_WINDOW_HEIGHT,
  AUX_WINDOW_WIDTH,
  SPRITE_MENU_ACTIONS,
  TOAST_WINDOW_MIN_WIDTH,
  TOAST_WINDOW_WIDTH,
  WIDGET_WINDOW_MAX_WIDTH,
  WIDGET_WINDOW_MIN_WIDTH,
  WIDGET_WINDOW_WIDTH,
} from './constants.mjs'
import {
  applyToastWindowBounds,
  scheduleCoalescedDetachedToastAnchorRefresh,
} from './detachedToast.mjs'
import { persistWidgetBounds } from './widgetBounds.mjs'
import {
  closeWidgetSpriteMenuWindow,
  normalizeSpriteMenuScreenBounds,
  openWidgetSpriteMenuWindow,
  warmSpriteMenuWindow,
} from './spriteMenu.mjs'
import { state } from './state.mjs'
import {
  applyWidgetWindowSpritePassthrough,
  setToastPassthroughClientRect,
  setWidgetPassthroughClientRect,
} from './toastPassthrough.mjs'
import {
  hideCornerNotificationWindow,
  openCornerNotificationTarget,
  showCornerNotificationWindow,
} from './cornerNotification.mjs'
import { applyLaunchAtLogin } from './launchAtLogin.mjs'
import { updateMoodReminderSnapshot } from './moodReminderState.mjs'
import { showSidekickSystemNotification } from './notification.mjs'
import {
  beginDragTrailSession,
  endDragTrailSession,
  keepSpriteAboveDragTrail,
  pushDragTrailScreenPoint,
} from './dragTrail.mjs'
import {
  createSpriteWindow,
  hideToastWindow,
  openOnboardingWindow,
  openPanelWindow,
  showToastWindow,
} from './windows.mjs'

/** Register before `ready` so renderer `invoke` never races an empty IPC table (Electron guidance). */
export function registerSidekickIpcHandlers() {
  ipcMain.handle('sidekick:open-panel', (_event, payload) => {
    const panel =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload === 'object'
          ? payload.panel
          : undefined
    const emotionTab =
      payload && typeof payload === 'object' ? payload.emotionTab : undefined
    if (
      panel === 'skin' ||
      panel === 'settings' ||
      panel === 'emotion' ||
      panel === 'fortune' ||
      panel === 'favorites'
    ) {
      openPanelWindow(
        panel,
        emotionTab === 'summary' || emotionTab === 'moment'
          ? { emotionTab }
          : {},
      )
    }
    return undefined
  })
  ipcMain.handle('sidekick:show-system-notification', (_event, payload) => {
    return showSidekickSystemNotification(payload ?? {})
  })
  ipcMain.handle('sidekick:show-corner-notification', async (_event, payload) => {
    return showCornerNotificationWindow(payload ?? {})
  })
  ipcMain.handle('sidekick:hide-corner-notification', () => {
    hideCornerNotificationWindow()
    return undefined
  })
  ipcMain.handle('sidekick:corner-notification-open-target', () => {
    openCornerNotificationTarget()
    return undefined
  })
  ipcMain.on('sidekick:update-mood-reminder-snapshot', (_event, snapshot) => {
    try {
      updateMoodReminderSnapshot(snapshot ?? {})
    } catch (err) {
      console.warn('[sidekick] mood reminder snapshot failed', err)
    }
  })
  ipcMain.on('sidekick:set-launch-at-login', (_event, enabled) => {
    applyLaunchAtLogin(enabled === true)
  })
  ipcMain.handle('sidekick:open-onboarding', () => {
    openOnboardingWindow()
    return undefined
  })
  ipcMain.handle('sidekick:onboarding-complete', () => {
    if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
      state.spriteWindow.webContents.send('sidekick:onboarding-finished')
    }
    if (state.onboardingWindow && !state.onboardingWindow.isDestroyed()) {
      state.onboardingWindow.close()
    }
    return undefined
  })
  ipcMain.handle('sidekick:show-toast', async (_event, payload) => {
    await showToastWindow(payload)
  })
  ipcMain.handle('sidekick:set-toast-anchor-preference', async (_event, payload) => {
    const next = payload?.anchor === 'bottom' ? 'bottom' : 'top'
    const forceReplay = payload?.forceReplay === true
    if (!forceReplay && next === state.lastPreferredToastAnchor) return undefined
    state.lastPreferredToastAnchor = next
    if (!state.lastToastSession) {
      return undefined
    }
    scheduleCoalescedDetachedToastAnchorRefresh()
    return undefined
  })
  ipcMain.handle('sidekick:hide-toast', () => {
    hideToastWindow()
  })
  ipcMain.on('sidekick:toast-passthrough-interact-rect', (_event, payload) => {
    if (!state.toastWindow || state.toastWindow.isDestroyed()) return
    setToastPassthroughClientRect(payload)
  })
  ipcMain.on('sidekick:widget-passthrough-interact-rect', (_event, payload) => {
    if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
    setWidgetPassthroughClientRect(payload)
  })
  ipcMain.on('sidekick:widget-pointer-passthrough', (_event, enabled) => {
    const on =
      enabled === true ||
      enabled === 1 ||
      enabled === 'true' ||
      enabled === '1'
    applyWidgetWindowSpritePassthrough(on)
  })
  ipcMain.handle('sidekick:set-sprite-interaction-locked', (_event, locked) => {
    state.lastSpriteInteractionLocked = locked === true
    if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
      state.spriteWindow.webContents.send(
        'sidekick:sprite-interaction-locked',
        state.lastSpriteInteractionLocked,
      )
      applyWidgetWindowSpritePassthrough(state.lastSpriteInteractionLocked)
    }
    return undefined
  })
  ipcMain.handle('sidekick:get-sprite-interaction-locked', () => {
    return state.lastSpriteInteractionLocked
  })
  ipcMain.handle('sidekick:open-widget-sprite-menu', (event, payload) => {
    const fromSprite =
      state.spriteWindow &&
      !state.spriteWindow.isDestroyed() &&
      event.sender === state.spriteWindow.webContents
    const fromToast =
      state.toastWindow &&
      !state.toastWindow.isDestroyed() &&
      event.sender === state.toastWindow.webContents
    if (!fromSprite && !fromToast) return undefined
    const b = normalizeSpriteMenuScreenBounds(payload)
    if (!b) return undefined
    const invoker = fromSprite ? 'sprite' : 'toast'
    openWidgetSpriteMenuWindow(payload, invoker)
    return undefined
  })
  ipcMain.handle('sidekick:warm-widget-sprite-menu', (event, payload) => {
    const fromSprite =
      state.spriteWindow &&
      !state.spriteWindow.isDestroyed() &&
      event.sender === state.spriteWindow.webContents
    const fromToast =
      state.toastWindow &&
      !state.toastWindow.isDestroyed() &&
      event.sender === state.toastWindow.webContents
    if (!fromSprite && !fromToast) return undefined
    const theme = payload?.theme === 'dark' || payload?.theme === 'light' ? payload.theme : undefined
    void warmSpriteMenuWindow(theme ? { theme } : {})
    return undefined
  })
  ipcMain.handle('sidekick:close-widget-sprite-menu', (event, opts) => {
    const allowed =
      (state.spriteWindow &&
        !state.spriteWindow.isDestroyed() &&
        event.sender === state.spriteWindow.webContents) ||
      (state.toastWindow &&
        !state.toastWindow.isDestroyed() &&
        event.sender === state.toastWindow.webContents) ||
      (state.spriteMenuWindow &&
        !state.spriteMenuWindow.isDestroyed() &&
        event.sender === state.spriteMenuWindow.webContents)
    if (!allowed) return undefined
    closeWidgetSpriteMenuWindow({ notify: opts?.notify === true })
    return undefined
  })
  ipcMain.handle('sidekick:widget-sprite-menu-submit', (event, action) => {
    const a = typeof action === 'string' ? action : ''
    if (!SPRITE_MENU_ACTIONS.has(a)) {
      console.warn('[sidekick] sprite menu action ignored (restart app if you added a new item):', a)
      return undefined
    }
    if (
      !state.spriteMenuWindow ||
      state.spriteMenuWindow.isDestroyed() ||
      event.sender !== state.spriteMenuWindow.webContents
    ) {
      return undefined
    }
    const invoker = state.lastSpriteMenuInvoker
    if (invoker === 'toast' && state.toastWindow && !state.toastWindow.isDestroyed()) {
      state.toastWindow.webContents.send('sidekick:widget-sprite-menu-pick', a)
    } else if (invoker === 'sprite' && state.spriteWindow && !state.spriteWindow.isDestroyed()) {
      state.spriteWindow.webContents.send('sidekick:widget-sprite-menu-pick', a)
    } else if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
      state.spriteWindow.webContents.send('sidekick:widget-sprite-menu-pick', a)
    } else if (state.toastWindow && !state.toastWindow.isDestroyed()) {
      state.toastWindow.webContents.send('sidekick:widget-sprite-menu-pick', a)
    }
    closeWidgetSpriteMenuWindow({ notify: false })
    return undefined
  })
  ipcMain.handle('sidekick:resize-widget', (_event, payload) => {
    const raw = Number(payload?.height)
    if (!state.spriteWindow || state.spriteWindow.isDestroyed() || !Number.isFinite(raw)) return
    const minH = 168
    const maxH = 720
    const newH = clamp(Math.round(raw), minH, maxH)
    const b = state.spriteWindow.getBounds()
    const rawW = payload?.width
    let newW = b.width
    if (rawW !== undefined && rawW !== null) {
      const parsed = Number(rawW)
      if (Number.isFinite(parsed)) {
        newW = clamp(
          Math.round(parsed),
          WIDGET_WINDOW_MIN_WIDTH,
          WIDGET_WINDOW_MAX_WIDTH,
        )
      }
    } else if (!Number.isFinite(newW) || newW <= 0) {
      newW = WIDGET_WINDOW_WIDTH
    }
    state.spriteWindow.setBounds({ ...b, width: newW, height: newH })
    state.spriteAnchorBase = null
    state.spriteBoundsAtAnchorSet = null
    state.lastSpriteAnchor = null
    persistWidgetBounds(state.spriteWindow)
    if (state.toastWindow && !state.toastWindow.isDestroyed()) {
      applyToastWindowBounds()
    }
  })
  ipcMain.handle('sidekick:move-widget-by', (_event, payload) => {
    const dx = Math.round(Number(payload?.dx))
    const dy = Math.round(Number(payload?.dy))
    if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return undefined
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
      return undefined
    }
    const b = state.spriteWindow.getBounds()
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const display = screen.getDisplayNearestPoint({ x: cx, y: cy })
    const wa = display.workArea
    const margin = 48
    let nx = b.x + dx
    let ny = b.y + dy
    nx = clamp(nx, wa.x - b.width + margin, wa.x + wa.width - margin)
    ny = clamp(ny, wa.y - b.height + margin, wa.y + wa.height - margin)
    state.spriteWindow.setBounds({ ...b, x: nx, y: ny })
    persistWidgetBounds(state.spriteWindow)
    if (state.dragTrailDragging) keepSpriteAboveDragTrail()
    // 气泡位置由 `spriteWindow` 的 `move` 事件里 `applyToastWindowBounds` 同步，避免与 `move` 重复 setBounds。
    return undefined
  })
  ipcMain.handle('sidekick:begin-drag-trail', (_event, payload) => {
    const screenX = Number(payload?.screenX)
    const screenY = Number(payload?.screenY)
    return beginDragTrailSession(
      Number.isFinite(screenX) ? screenX : undefined,
      Number.isFinite(screenY) ? screenY : undefined,
    )
  })
  ipcMain.on('sidekick:drag-trail-point', (_event, payload) => {
    const screenX = Number(payload?.screenX)
    const screenY = Number(payload?.screenY)
    pushDragTrailScreenPoint(screenX, screenY)
  })
  ipcMain.on('sidekick:end-drag-trail', () => {
    endDragTrailSession()
  })
  ipcMain.handle('sidekick:resize-panel', (_event, _payload) => {
    if (!state.panelWindow || state.panelWindow.isDestroyed()) return
    state.panelWindow.setContentSize(AUX_WINDOW_WIDTH, AUX_WINDOW_HEIGHT)
  })
  function applySetSpriteAnchorFromRenderer(anchor) {
    const centerX = Number(anchor?.centerX)
    const topY = Number(anchor?.topY)
    const bottomY = Number(anchor?.bottomY)
    if (!Number.isFinite(centerX) || !Number.isFinite(topY) || !Number.isFinite(bottomY)) {
      return
    }
    const rawPct = Number(anchor?.avatarSizePercent)
    if (Number.isFinite(rawPct) && rawPct > 0) {
      state.lastAvatarSizePercent = clamp(rawPct, 40, 200)
    }
    state.lastSpriteAnchor = { centerX, topY, bottomY }
    state.spriteAnchorBase = { centerX, topY, bottomY }
    if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
      state.spriteBoundsAtAnchorSet = state.spriteWindow.getBounds()
    }
    if (state.toastWindow && !state.toastWindow.isDestroyed() && state.toastWindow.isVisible()) {
      applyToastWindowBounds()
    }
  }

  ipcMain.handle('sidekick:set-sprite-anchor', (_event, anchor) => {
    applySetSpriteAnchorFromRenderer(anchor)
    return undefined
  })
  ipcMain.on('sidekick:set-sprite-anchor-push', (_event, anchor) => {
    applySetSpriteAnchorFromRenderer(anchor)
  })
  ipcMain.handle('sidekick:resize-toast', (_event, payload) => {
    const rawH = Number(payload?.height)
    if (!state.toastWindow || state.toastWindow.isDestroyed() || !Number.isFinite(rawH)) {
      return
    }
    const minH = 52
    const maxH = 480
    const minW = TOAST_WINDOW_MIN_WIDTH
    const maxW = 360
    const newH = clamp(Math.round(rawH), minH, maxH)
    const b = state.toastWindow.getBounds()
    const rawW = Number(payload?.width)
    const newW = Number.isFinite(rawW)
      ? clamp(Math.round(rawW), minW, maxW)
      : b.width
    const centerX = state.lastSpriteAnchor?.centerX
    const newX =
      typeof centerX === 'number' && Number.isFinite(centerX)
        ? Math.round(centerX - newW / 2)
        : b.x
    // 顶边锚定：悬停展开/收起只改变高度，避免底边固定导致文案区跳动。
    state.toastWindow.setBounds({
      x: newX,
      y: b.y,
      width: newW,
      height: newH,
    })
    applyToastWindowBounds()
  })
  ipcMain.on('sidekick:toast-regenerate-request', () => {
    if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
    state.spriteWindow.webContents.send('sidekick:regenerate-copy')
  })
  ipcMain.handle('sidekick:get-work-area', () => {
    if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return null
    const b = state.spriteWindow.getBounds()
    const { workArea } = screen.getDisplayNearestPoint({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
    })
    return {
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
    }
  })

  ipcMain.handle('sidekick:dashscope-chat', async (_event, payload) => {
    const { content } = await dashscopeChatCompleteWithFallback(payload)
    return content
  })

  ipcMain.handle('sidekick:dashscope-tts', async (_event, payload) => {
    return dashscopeTtsFetch(payload)
  })
  ipcMain.handle('sidekick:quit-app', () => {
    app.quit()
    return undefined
  })
}

export { createSpriteWindow }
