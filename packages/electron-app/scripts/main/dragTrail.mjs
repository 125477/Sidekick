import { BrowserWindow, screen } from 'electron'
import { buildRoute } from './route.mjs'
import { preloadPath } from './paths.mjs'
import { state } from './state.mjs'
import { awaitWebContentsNavigationSettled } from './navigationWait.mjs'
import { clamp } from './geometry.mjs'
import {
  DRAG_TRAIL_WINDOW_HEIGHT,
  DRAG_TRAIL_WINDOW_WIDTH,
} from './constants.mjs'

const DRAG_TRAIL_HIDE_DELAY_MS = 2400
/** 合并打点 IPC，减轻 Win 上主↔渲染往返 */
const FLUSH_INTERVAL_MS = 40
const TRAIL_FRAME_RATE = 24
const REPOSITION_MIN_MS = 240
const TRAIL_EDGE_MARGIN = 52

function shiftTrailParticles(dx, dy) {
  if (dx === 0 && dy === 0) return
  shiftPendingTrailPoints(dx, dy)
  sendToDragTrail('sidekick:drag-trail-shift', { dx, dy })
}

/** 小窗 reposition 时，尚未 flush 的局部坐标须与 origin 同步平移。 */
function shiftPendingTrailPoints(dx, dy) {
  if (dx === 0 && dy === 0) return
  const batch = state.dragTrailPendingPoints
  if (!batch || batch.length === 0) return
  for (const p of batch) {
    p.x += dx
    p.y += dy
  }
}

/** 拖尾小窗 setBounds / show 后须把精灵窗压回最前，避免星星叠在形象上。 */
export function keepSpriteAboveDragTrail() {
  const sprite = state.spriteWindow
  const trail = state.dragTrailWindow
  if (!sprite || sprite.isDestroyed()) return
  if (trail && !trail.isDestroyed()) {
    trail.setAlwaysOnTop(true, 'normal')
  }
  sprite.setAlwaysOnTop(true, 'screen-saver')
  if (typeof sprite.moveTop === 'function') {
    sprite.moveTop()
  }
}

function getDisplayForSpriteWindow() {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return null
  const b = state.spriteWindow.getBounds()
  return screen.getDisplayNearestPoint({
    x: b.x + Math.round(b.width / 2),
    y: b.y + Math.round(b.height / 2),
  })
}

function clearDragTrailHideTimer() {
  if (state.dragTrailHideTimer) {
    clearTimeout(state.dragTrailHideTimer)
    state.dragTrailHideTimer = null
  }
}

function clearDragTrailFlushTimer() {
  if (state.dragTrailFlushTimer) {
    clearTimeout(state.dragTrailFlushTimer)
    state.dragTrailFlushTimer = null
  }
}

function scheduleHideDragTrailWindow() {
  clearDragTrailHideTimer()
  state.dragTrailHideTimer = setTimeout(() => {
    state.dragTrailHideTimer = null
    if (state.dragTrailDragging) return
    hideDragTrailWindow()
  }, DRAG_TRAIL_HIDE_DELAY_MS)
}

function sendToDragTrail(channel, payload) {
  const w = state.dragTrailWindow
  if (!w || w.isDestroyed()) return
  const wc = w.webContents
  if (!wc || wc.isDestroyed()) return
  if (payload === undefined) wc.send(channel)
  else wc.send(channel, payload)
}

export function hideDragTrailWindow() {
  clearDragTrailHideTimer()
  const w = state.dragTrailWindow
  if (!w || w.isDestroyed()) return
  w.hide()
}

function applyTrailFrameRate(win) {
  try {
    win.webContents.setFrameRate(TRAIL_FRAME_RATE)
  } catch {
    /* older Electron */
  }
}

async function getOrCreateDragTrailWindow() {
  if (state.dragTrailWindow && !state.dragTrailWindow.isDestroyed()) {
    return state.dragTrailWindow
  }

  const display = getDisplayForSpriteWindow()
  if (!display) return null
  const wa = display.workArea

  const win = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: DRAG_TRAIL_WINDOW_WIDTH,
    height: DRAG_TRAIL_WINDOW_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true,
    },
  })
  win.setIgnoreMouseEvents(true, { forward: true })
  win.setAlwaysOnTop(true, 'normal')
  applyTrailFrameRate(win)
  win.on('closed', () => {
    state.dragTrailWindow = null
    state.dragTrailOrigin = null
    state.dragTrailLoaded = false
    clearDragTrailHideTimer()
    clearDragTrailFlushTimer()
  })
  state.dragTrailWindow = win
  state.dragTrailLoaded = false
  return win
}

/** 精灵窗就绪后预加载拖尾页，避免首次拖动卡在 loadURL */
export async function warmDragTrailWindow() {
  if (state.dragTrailLoaded) return true
  const win = await getOrCreateDragTrailWindow()
  if (!win) return false
  if (state.dragTrailLoaded) return true
  await win.loadURL(buildRoute(state.baseUrl, 'drag-trail'))
  await awaitWebContentsNavigationSettled(win.webContents)
  state.dragTrailLoaded = true
  applyTrailFrameRate(win)
  return true
}

function positionTrailWindowAt(screenX, screenY) {
  const display = getDisplayForSpriteWindow()
  if (!display) return false
  const wa = display.workArea
  const w = DRAG_TRAIL_WINDOW_WIDTH
  const h = DRAG_TRAIL_WINDOW_HEIGHT
  let nx = Math.round(screenX - w / 2)
  let ny = Math.round(screenY - h / 2)
  nx = clamp(nx, wa.x, wa.x + wa.width - w)
  ny = clamp(ny, wa.y, wa.y + wa.height - h)

  const prev = state.dragTrailOrigin
  if (prev && (prev.x !== nx || prev.y !== ny)) {
    shiftTrailParticles(prev.x - nx, prev.y - ny)
  }

  const win = state.dragTrailWindow
  if (!win || win.isDestroyed()) return false
  const bounds = win.getBounds()
  if (
    bounds.x !== nx ||
    bounds.y !== ny ||
    bounds.width !== w ||
    bounds.height !== h
  ) {
    win.setBounds({ x: nx, y: ny, width: w, height: h })
  }
  state.dragTrailOrigin = { x: nx, y: ny }
  sendToDragTrail('sidekick:drag-trail-sync', {
    originX: nx,
    originY: ny,
    width: w,
    height: h,
  })
  if (state.dragTrailDragging) keepSpriteAboveDragTrail()
  return true
}

/** 指针靠近拖尾窗边缘时再平移（节流），保证长轨迹仍在窗内 */
function maybeRepositionTrailWindow(screenX, screenY) {
  const win = state.dragTrailWindow
  if (!win || win.isDestroyed() || !state.dragTrailOrigin) return
  const b = win.getBounds()
  const lx = screenX - b.x
  const ly = screenY - b.y
  const m = TRAIL_EDGE_MARGIN
  if (
    lx >= m &&
    lx <= b.width - m &&
    ly >= m &&
    ly <= b.height - m
  ) {
    return
  }
  const now = Date.now()
  if (now - (state.dragTrailLastRepositionMs ?? 0) < REPOSITION_MIN_MS) return
  state.dragTrailLastRepositionMs = now
  positionTrailWindowAt(screenX, screenY)
}

export async function ensureDragTrailWindow(screenX, screenY) {
  const win = await getOrCreateDragTrailWindow()
  if (!win) return false

  if (!state.dragTrailLoaded) {
    await win.loadURL(buildRoute(state.baseUrl, 'drag-trail'))
    await awaitWebContentsNavigationSettled(win.webContents)
    state.dragTrailLoaded = true
    applyTrailFrameRate(win)
  }

  const sx = Number.isFinite(screenX)
    ? screenX
    : state.spriteWindow.getBounds().x
  const sy = Number.isFinite(screenY)
    ? screenY
    : state.spriteWindow.getBounds().y
  positionTrailWindowAt(sx, sy)

  if (!win.isVisible()) win.showInactive()
  if (state.dragTrailDragging) keepSpriteAboveDragTrail()
  return true
}

export async function beginDragTrailSession(screenX, screenY) {
  clearDragTrailHideTimer()
  clearDragTrailFlushTimer()
  state.dragTrailDragging = true
  state.dragTrailPendingPoints = []
  const ok = await ensureDragTrailWindow(screenX, screenY)
  if (ok) {
    keepSpriteAboveDragTrail()
    sendToDragTrail('sidekick:drag-trail-reset')
  }
  return ok
}

function flushPendingTrailPoints() {
  state.dragTrailFlushTimer = null
  state.dragTrailFlushScheduled = false
  const batch = state.dragTrailPendingPoints
  if (!batch || batch.length === 0) return
  state.dragTrailPendingPoints = []
  sendToDragTrail('sidekick:drag-trail-points', batch)
}

function scheduleFlushTrailPoints() {
  if (state.dragTrailFlushScheduled) return
  state.dragTrailFlushScheduled = true
  if (state.dragTrailFlushTimer != null) return
  state.dragTrailFlushTimer = setTimeout(flushPendingTrailPoints, FLUSH_INTERVAL_MS)
}

export function pushDragTrailScreenPoint(screenX, screenY) {
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return
  if (!state.dragTrailWindow || state.dragTrailWindow.isDestroyed()) {
    void ensureDragTrailWindow(screenX, screenY).then((ok) => {
      if (ok) pushDragTrailScreenPoint(screenX, screenY)
    })
    return
  }
  maybeRepositionTrailWindow(screenX, screenY)
  const origin = state.dragTrailOrigin
  if (!origin) return
  const localX = Math.round(screenX - origin.x)
  const localY = Math.round(screenY - origin.y)
  if (!state.dragTrailPendingPoints) state.dragTrailPendingPoints = []
  const batch = state.dragTrailPendingPoints
  const last = batch[batch.length - 1]
  if (last && last.x === localX && last.y === localY) return
  batch.push({ x: localX, y: localY })
  if (batch.length > 24) {
    batch.splice(0, batch.length - 24)
  }
  scheduleFlushTrailPoints()
}

export function endDragTrailSession() {
  state.dragTrailDragging = false
  state.dragTrailRepositionLocked = false
  flushPendingTrailPoints()
  sendToDragTrail('sidekick:drag-trail-reset-sampler')
  scheduleHideDragTrailWindow()
}

export function destroyDragTrailWindow() {
  clearDragTrailHideTimer()
  clearDragTrailFlushTimer()
  state.dragTrailDragging = false
  state.dragTrailRepositionLocked = false
  state.dragTrailPendingPoints = []
  if (state.dragTrailWindow && !state.dragTrailWindow.isDestroyed()) {
    state.dragTrailWindow.destroy()
  }
  state.dragTrailWindow = null
  state.dragTrailOrigin = null
  state.dragTrailLoaded = false
}
