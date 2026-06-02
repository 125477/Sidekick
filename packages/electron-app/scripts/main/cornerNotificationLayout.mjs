import { screen } from 'electron'
import {
  CORNER_NOTIFICATION_HEIGHT,
  CORNER_NOTIFICATION_MARGIN,
  CORNER_NOTIFICATION_WIDTH,
} from './constants.mjs'
import { clamp, rectsIntersect } from './geometry.mjs'
import { state } from './state.mjs'

/** @returns {import('electron').Rectangle[]} */
function collectSidekickObstacleBounds() {
  /** @type {import('electron').Rectangle[]} */
  const out = []
  for (const win of [state.toastWindow, state.spriteWindow]) {
    if (!win || win.isDestroyed() || !win.isVisible()) continue
    try {
      out.push(win.getBounds())
    } catch {
      /* noop */
    }
  }
  return out
}

function padRect(rect, pad) {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
}

/**
 * @param {import('electron').Rectangle} candidate
 * @param {import('electron').Rectangle[]} obstacles
 * @param {number} gap
 */
function overlapsAny(candidate, obstacles, gap) {
  const padded = padRect(candidate, gap)
  return obstacles.some((ob) => rectsIntersect(padded, ob))
}

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
  const gap = Math.max(8, margin)
  const bottomY = Math.round(workArea.y + workArea.height - height - margin)
  const rightX = Math.round(workArea.x + workArea.width - width - margin)
  /** 提醒应留在屏幕下半区，避免被顶到用户看不到的上方。 */
  const minTopY = Math.round(workArea.y + workArea.height * 0.42)
  const minLeftX = workArea.x + margin

  /** @type {import('electron').Rectangle} */
  let candidate = { x: rightX, y: bottomY, width, height }

  const obstacles = collectSidekickObstacleBounds()
  if (obstacles.length === 0) return candidate

  if (!overlapsAny(candidate, obstacles, gap)) return candidate

  /** 优先向左挪，仍贴屏幕下沿（用户习惯在右下角找）。 */
  for (const ob of obstacles) {
    if (!rectsIntersect(padRect(candidate, gap), ob)) continue
    const leftOf = Math.round(ob.x - width - gap)
    if (leftOf >= minLeftX) {
      candidate = { ...candidate, x: leftOf, y: bottomY }
    }
  }
  if (!overlapsAny(candidate, obstacles, gap)) {
    return { ...candidate, y: clamp(candidate.y, minTopY, bottomY) }
  }

  /** 仍重叠：略向上抬，但限制在屏幕下半区。 */
  const blockingTops = obstacles
    .filter((ob) => rectsIntersect(padRect(candidate, gap), ob))
    .map((ob) => ob.y)
  if (blockingTops.length > 0) {
    const highestTop = Math.min(...blockingTops)
    candidate = {
      ...candidate,
      y: clamp(Math.round(highestTop - height - gap), minTopY, bottomY),
    }
  }

  return candidate
}

export function raiseCornerNotificationWindow() {
  const win = state.cornerNotificationWindow
  if (!win || win.isDestroyed()) return
  try {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  } catch {
    /* noop */
  }
}

/** 陪伴气泡/精灵移动后，已显示的右下角提醒应让开重叠区域。 */
export function refreshCornerNotificationBoundsIfVisible() {
  const win = state.cornerNotificationWindow
  if (!win || win.isDestroyed() || !win.isVisible()) return
  win.setBounds(
    computeCornerNotificationBounds(
      CORNER_NOTIFICATION_WIDTH,
      CORNER_NOTIFICATION_HEIGHT,
    ),
  )
  raiseCornerNotificationWindow()
}
