/** 桌面级拖动星星拖尾（小窗 overlay + 屏幕坐标）。 */

const MIN_SCREEN_PUSH_PX = 10
const WIDGET_FLUSH_MS = 48

let lastPushScreenX = NaN
let lastPushScreenY = NaN
let pendingScreenX = NaN
let pendingScreenY = NaN
let flushTimer: number | null = null

function flushPendingScreenPoint() {
  flushTimer = null
  if (!Number.isFinite(pendingScreenX)) return
  window.sidekickDesktop?.pushDragTrailPoint?.({
    screenX: pendingScreenX,
    screenY: pendingScreenY,
  })
  pendingScreenX = NaN
  pendingScreenY = NaN
}

function scheduleScreenFlush() {
  if (flushTimer != null) return
  flushTimer = window.setTimeout(flushPendingScreenPoint, WIDGET_FLUSH_MS)
}

export function beginDesktopDragTrail(screenX: number, screenY: number): void {
  lastPushScreenX = NaN
  lastPushScreenY = NaN
  pendingScreenX = NaN
  pendingScreenY = NaN
  if (flushTimer != null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  void (async () => {
    try {
      await window.sidekickDesktop?.beginDragTrail?.({ screenX, screenY })
    } finally {
      pushDesktopDragTrailPoint(screenX, screenY)
    }
  })()
}

export function pushDesktopDragTrailPoint(
  screenX: number,
  screenY: number,
): void {
  if (Number.isFinite(lastPushScreenX)) {
    const dist = Math.hypot(screenX - lastPushScreenX, screenY - lastPushScreenY)
    if (dist < MIN_SCREEN_PUSH_PX) return
  }
  lastPushScreenX = screenX
  lastPushScreenY = screenY
  pendingScreenX = screenX
  pendingScreenY = screenY
  scheduleScreenFlush()
}

export function endDesktopDragTrail(): void {
  if (flushTimer != null) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  flushPendingScreenPoint()
  lastPushScreenX = NaN
  lastPushScreenY = NaN
  window.sidekickDesktop?.endDragTrail?.()
}
