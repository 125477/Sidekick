import { screen } from 'electron'
import { state } from './state.mjs'

function stopPassthroughPollIfIdle() {
  if (state.toastPassthroughClientRect || state.widgetPassthroughClientRect) return
  if (state.passthroughPollId != null) {
    clearInterval(state.passthroughPollId)
    state.passthroughPollId = null
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
  const inside =
    p.x >= ax &&
    p.x < ax + clientRect.width &&
    p.y >= ay &&
    p.y < ay + clientRect.height
  try {
    win.setIgnoreMouseEvents(!inside, { forward: true })
  } catch {
    /* noop */
  }
}

export function tickPassthroughHitTests() {
  if (state.toastWindow && !state.toastWindow.isDestroyed() && state.toastPassthroughClientRect) {
    tickWindowPassthrough(state.toastWindow, state.toastPassthroughClientRect)
  } else if (state.toastWindow && !state.toastWindow.isDestroyed()) {
    try {
      state.toastWindow.setIgnoreMouseEvents(false)
    } catch {
      /* noop */
    }
  }

  if (
    state.spriteWindow &&
    !state.spriteWindow.isDestroyed() &&
    !state.lastSpriteInteractionLocked &&
    state.widgetPassthroughClientRect
  ) {
    tickWindowPassthrough(state.spriteWindow, state.widgetPassthroughClientRect)
  } else if (
    state.spriteWindow &&
    !state.spriteWindow.isDestroyed() &&
    !state.lastSpriteInteractionLocked
  ) {
    try {
      state.spriteWindow.setIgnoreMouseEvents(false)
    } catch {
      /* noop */
    }
  }
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
  if (state.widgetPassthroughClientRect && !state.lastSpriteInteractionLocked) {
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

/** 精灵锁定：整窗穿透。未锁：由 `widgetPassthroughClientRect` 控制可点区域。 */
export function applyWidgetWindowSpritePassthrough(wantPassthrough) {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
  if (wantPassthrough) {
    state.widgetPassthroughClientRect = null
    stopPassthroughPollIfIdle()
    try {
      state.spriteWindow.setIgnoreMouseEvents(true, { forward: true })
    } catch {
      /* noop */
    }
    return
  }
  try {
    state.spriteWindow.setIgnoreMouseEvents(false)
  } catch {
    /* noop */
  }
  tickPassthroughHitTests()
}
