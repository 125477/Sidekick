import { app, ipcMain, screen } from 'electron'
import { dashscopeTtsFetch } from '../dashscopeTtsFetch.mjs'
import { clamp } from './geometry.mjs'
import {
  AUX_WINDOW_HEIGHT,
  AUX_WINDOW_WIDTH,
  SPRITE_MENU_ACTIONS,
  TOAST_WINDOW_WIDTH,
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
} from './spriteMenu.mjs'
import { state } from './state.mjs'
import {
  applyWidgetWindowSpritePassthrough,
  stopToastPassthroughHitTest,
  tickToastPassthroughHitTest,
} from './toastPassthrough.mjs'
import {
  createSpriteWindow,
  hideToastWindow,
  openOnboardingWindow,
  openPanelWindow,
  showToastWindow,
} from './windows.mjs'

/** Register before `ready` so renderer `invoke` never races an empty IPC table (Electron guidance). */
export function registerSidekickIpcHandlers() {
  ipcMain.handle('sidekick:open-panel', (_event, panel) => {
    if (
      panel === 'skin' ||
      panel === 'settings' ||
      panel === 'emotion' ||
      panel === 'fortune' ||
      panel === 'favorites'
    ) {
      openPanelWindow(panel)
    }
    return undefined
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
    if (payload == null) {
      stopToastPassthroughHitTest()
      return
    }
    if (typeof payload !== 'object') {
      stopToastPassthroughHitTest()
      return
    }
    const left = Number(payload.left)
    const top = Number(payload.top)
    const width = Number(payload.width)
    const height = Number(payload.height)
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      stopToastPassthroughHitTest()
      return
    }
    state.toastPassthroughClientRect = { left, top, width, height }
    if (state.toastPassthroughPollId == null) {
      state.toastPassthroughPollId = setInterval(tickToastPassthroughHitTest, 32)
    }
    tickToastPassthroughHitTest()
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
    openWidgetSpriteMenuWindow(b, invoker)
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
    if (!SPRITE_MENU_ACTIONS.has(a)) return undefined
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
    const compactW = WIDGET_WINDOW_WIDTH
    const rawW = payload?.width
    let newW = b.width
    if (rawW !== undefined && rawW !== null) {
      const parsed = Number(rawW)
      if (Number.isFinite(parsed)) {
        newW = clamp(Math.round(parsed), 300, 620)
      }
    } else {
      newW = compactW
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
    if (state.toastWindow && !state.toastWindow.isDestroyed()) {
      applyToastWindowBounds()
    }
    return undefined
  })
  ipcMain.handle('sidekick:resize-panel', (_event, _payload) => {
    if (!state.panelWindow || state.panelWindow.isDestroyed()) return
    state.panelWindow.setContentSize(AUX_WINDOW_WIDTH, AUX_WINDOW_HEIGHT)
  })
  ipcMain.handle('sidekick:set-sprite-anchor', (_event, anchor) => {
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
  })
  ipcMain.handle('sidekick:resize-toast', (_event, payload) => {
    const raw = Number(payload?.height)
    if (!state.toastWindow || state.toastWindow.isDestroyed() || !Number.isFinite(raw)) return
    const minH = 52
    const maxH = 480
    const newH = clamp(Math.round(raw), minH, maxH)
    const b = state.toastWindow.getBounds()
    if (state.lastToastTailDown) {
      const bottom = b.y + b.height
      state.toastWindow.setBounds({
        x: b.x,
        y: bottom - newH,
        width: TOAST_WINDOW_WIDTH,
        height: newH,
      })
    } else {
      state.toastWindow.setBounds({
        ...b,
        height: newH,
      })
    }
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
    const apiKey = String(payload?.apiKey ?? '').trim()
    if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY')

    const systemPrompt = String(payload?.systemPrompt ?? '')
    const userPrompt = String(payload?.userPrompt ?? '')
    const model = payload?.model ?? 'qwen-turbo'
    const temperature =
      typeof payload?.temperature === 'number' && Number.isFinite(payload.temperature)
        ? payload.temperature
        : 0.7

    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `DashScope ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`,
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty content from DashScope')
    return content
  })

  ipcMain.handle('sidekick:dashscope-tts', async (_event, payload) => {
    const buf = await dashscopeTtsFetch(payload)
    return {
      base64: Buffer.from(buf).toString('base64'),
      mimeType: 'audio/mpeg',
    }
  })
  ipcMain.handle('sidekick:quit-app', () => {
    app.quit()
    return undefined
  })
}

export { createSpriteWindow }
