import { screen } from 'electron'
import { tickWidgetDockHoverPassthrough, isWidgetDockActive } from './widgetEdgeDock.mjs'
import { state } from './state.mjs'

function stopPassthroughPollIfIdle() {
  if (
    state.toastPassthroughClientRect ||
    state.widgetPassthroughClientRect ||
    state.lastSpriteInteractionLocked ||
    isWidgetDockActive()
  ) {
    return
  }
  if (state.passthroughPollId != null) {
    clearInterval(state.passthroughPollId)
    state.passthroughPollId = null
  }
}

function pointInScreenRect(p, rect) {
  return (
    p.x >= rect.left &&
    p.x < rect.left + rect.width &&
    p.y >= rect.top &&
    p.y < rect.top + rect.height
  )
}

/** `clientRect` 为窗口客户区坐标。 */
function tickWindowPassthrough(win, clientRect) {
  if (!win || win.isDestroyed() || !clientRect) return
  let cb
  try {
    cb = win.getContentBounds()
  } catch {
    return
  }
  const ax = cb.x + clientRect.left
  const ay = cb.y + clientRect.top
  const p = screen.getCursorScreenPoint()
  const inside = pointInScreenRect(p, {
    left: ax,
    top: ay,
    width: clientRect.width,
    height: clientRect.height,
  })
  try {
    win.setIgnoreMouseEvents(!inside, { forward: true })
  } catch {
    /* noop */
  }
}

/** `screenRect` 为屏幕坐标（边缘吸附 hover 条带）。 */
function tickWindowPassthroughScreen(win, screenRect) {
  if (!win || win.isDestroyed() || !screenRect) return
  const p = screen.getCursorScreenPoint()
  const inside = pointInScreenRect(p, screenRect)
  try {
    win.setIgnoreMouseEvents(!inside, { forward: true })
  } catch {
    /* noop */
  }
}

function ensurePassthroughPoll() {
  if (state.passthroughPollId == null) {
    state.passthroughPollId = setInterval(tickPassthroughHitTests, 32)
  }
}

function normalizeClientRect(payload) {
  if (payload == null || typeof payload !== 'object') return null
  const left = Number(payload.left)
  const top = Number(payload.top)
  const width = Number(payload.width)
  const height = Number(payload.height)
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null
  }
  return { left, top, width, height }
}

function applyToastWindowMousePolicy() {
  if (!state.toastWindow || state.toastWindow.isDestroyed()) return
  if (state.toastPassthroughClientRect) {
    tickWindowPassthrough(state.toastWindow, state.toastPassthroughClientRect)
    return
  }
  /** 独立气泡已显示但尚未上报热区（或锁定态暂无可点条）：透明区域应穿透，避免挡住右下角提醒等其它窗。 */
  const detachedVisible =
    state.toastWindow.isVisible() && state.lastToastSession != null
  try {
    if (detachedVisible) {
      state.toastWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      state.toastWindow.setIgnoreMouseEvents(false)
    }
  } catch {
    /* noop */
  }
}

function applyWidgetWindowMousePolicy() {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return

  const dockHit = tickWidgetDockHoverPassthrough()
  if (dockHit) {
    tickWindowPassthroughScreen(state.spriteWindow, dockHit)
    return
  }

  if (state.lastSpriteInteractionLocked) {
    try {
      state.spriteWindow.setIgnoreMouseEvents(true, { forward: true })
    } catch {
      /* noop */
    }
    return
  }

  if (state.widgetPassthroughClientRect) {
    tickWindowPassthrough(state.spriteWindow, state.widgetPassthroughClientRect)
    return
  }

  try {
    state.spriteWindow.setIgnoreMouseEvents(false)
  } catch {
    /* noop */
  }
}

export function tickPassthroughHitTests() {
  applyToastWindowMousePolicy()
  applyWidgetWindowMousePolicy()
}

export function setToastPassthroughClientRect(payload) {
  state.toastPassthroughClientRect = normalizeClientRect(payload)
  if (state.toastPassthroughClientRect) {
    ensurePassthroughPoll()
  } else {
    stopPassthroughPollIfIdle()
  }
  tickPassthroughHitTests()
}

export function setWidgetPassthroughClientRect(payload) {
  state.widgetPassthroughClientRect = normalizeClientRect(payload)
  if (
    state.widgetPassthroughClientRect ||
    state.lastSpriteInteractionLocked ||
    isWidgetDockActive()
  ) {
    ensurePassthroughPoll()
  } else {
    stopPassthroughPollIfIdle()
  }
  tickPassthroughHitTests()
}

/** @deprecated */
export function stopToastPassthroughHitTest() {
  setToastPassthroughClientRect(null)
}

/** @deprecated */
export function tickToastPassthroughHitTest() {
  tickPassthroughHitTests()
}

/** 精灵锁定：边缘吸附 + 漏出条带可 hover 展开；未锁：由 `widgetPassthroughClientRect` 控制可点区域。 */
export function applyWidgetWindowSpritePassthrough(wantPassthrough) {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
  if (wantPassthrough) {
    state.widgetPassthroughClientRect = null
    ensurePassthroughPoll()
    tickPassthroughHitTests()
    return
  }
  try {
    state.spriteWindow.setIgnoreMouseEvents(false)
  } catch {
    /* noop */
  }
  tickPassthroughHitTests()
}
