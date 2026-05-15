import { screen } from 'electron'
import { state } from './state.mjs'

export function stopToastPassthroughHitTest() {
  state.toastPassthroughClientRect = null
  if (state.toastPassthroughPollId != null) {
    clearInterval(state.toastPassthroughPollId)
    state.toastPassthroughPollId = null
  }
  if (state.toastWindow && !state.toastWindow.isDestroyed()) {
    try {
      state.toastWindow.setIgnoreMouseEvents(false)
    } catch {
      /* noop */
    }
  }
}

export function tickToastPassthroughHitTest() {
  if (!state.toastWindow || state.toastWindow.isDestroyed() || !state.toastPassthroughClientRect) {
    stopToastPassthroughHitTest()
    return
  }
  const r = state.toastPassthroughClientRect
  if (!(r.width > 0 && r.height > 0)) {
    stopToastPassthroughHitTest()
    return
  }
  let cb
  try {
    cb = state.toastWindow.getContentBounds()
  } catch {
    return
  }
  const ax = cb.x + r.left
  const ay = cb.y + r.top
  const p = screen.getCursorScreenPoint()
  const inside = p.x >= ax && p.x < ax + r.width && p.y >= ay && p.y < ay + r.height
  try {
    state.toastWindow.setIgnoreMouseEvents(!inside, { forward: true })
  } catch {
    /* noop */
  }
}

/** 精灵悬浮窗：锁定后整窗穿透（与 `widget-pointer-passthrough` IPC 一致）。 */
export function applyWidgetWindowSpritePassthrough(wantPassthrough) {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
  try {
    if (wantPassthrough) {
      state.spriteWindow.setIgnoreMouseEvents(true, { forward: true })
    } else {
      state.spriteWindow.setIgnoreMouseEvents(false)
    }
  } catch {
    /* noop */
  }
}
