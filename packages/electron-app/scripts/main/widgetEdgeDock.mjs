import { screen } from 'electron'
import { clamp } from './geometry.mjs'
import { spriteSizeForPercent } from './constants.mjs'
import { persistWidgetBounds } from './widgetBounds.mjs'
import { syncLastSpriteAnchorToWindowMotion } from './spriteAnchor.mjs'
import { applyWidgetWindowSpritePassthrough } from './toastPassthrough.mjs'
import { state } from './state.mjs'

/** 距工作区边缘小于该值（px）时触发吸附。 */
const SNAP_THRESHOLD_PX = 80
/** 吸附后露出的精灵宽度/高度占比（约三分之一）。 */
const PEEK_VISIBLE_RATIO = 1 / 3
const DOCK_ANIM_MS = 280
const DOCK_COLLAPSE_DEBOUNCE_MS = 480
/** 吸附半露时推送探头：展示时长（秒），与气泡 auto-hide 同步。 */
export const DOCK_PUSH_PEEK_DWELL_SECONDS = 15
/** 光标靠近露出的条带时额外放宽的感应区（px）。 */
const HOVER_SLOP_PX = 20

/** @typedef {'right'} DockSide */
/** @typedef {'free' | 'docking' | 'docked' | 'expanding' | 'expanded'} DockPhase */

/**
 * @type {{
 *   side: DockSide | null
 *   phase: DockPhase
 *   isDragging: boolean
 *   animating: boolean
 *   collapseTimer: ReturnType<typeof setTimeout> | null
 * }}
 */
const dock = {
  side: null,
  phase: 'free',
  isDragging: false,
  animating: false,
  collapseTimer: null,
}

/** 推送触发的临时展开；气泡关闭后恢复半露。 */
let pushRevealActive = false

/** 与 ui 挂件 `pr-3` / `pb-2` 及精灵在窗内位置对齐。 */
const SPRITE_INSET_RIGHT = 12
const SPRITE_INSET_BOTTOM = 8

/** @param {import('electron').Rectangle} bounds */
function spriteMetrics(bounds) {
  const spritePx = spriteSizeForPercent(state.lastAvatarSizePercent)
  const peek = Math.max(
    40,
    Math.round(spritePx * PEEK_VISIBLE_RATIO),
  )
  const spriteLeftInWindow = Math.max(
    0,
    bounds.width - spritePx - SPRITE_INSET_RIGHT,
  )
  const spriteTopInWindow = Math.max(
    0,
    bounds.height - spritePx - SPRITE_INSET_BOTTOM,
  )
  return { spritePx, peek, spriteLeftInWindow, spriteTopInWindow }
}

/** @param {import('electron').Rectangle} bounds */
function spriteScreenRect(bounds) {
  const { spritePx, spriteLeftInWindow, spriteTopInWindow } = spriteMetrics(bounds)
  const anchor = state.lastSpriteAnchor
  if (anchor && Number.isFinite(anchor.centerX) && Number.isFinite(anchor.topY)) {
    const half = spritePx / 2
    return {
      left: anchor.centerX - half,
      top: anchor.topY,
      right: anchor.centerX + half,
      bottom: Number.isFinite(anchor.bottomY)
        ? anchor.bottomY
        : anchor.topY + spritePx,
      width: spritePx,
      height: Number.isFinite(anchor.bottomY)
        ? anchor.bottomY - anchor.topY
        : spritePx,
    }
  }
  return {
    left: bounds.x + spriteLeftInWindow,
    top: bounds.y + spriteTopInWindow,
    right: bounds.x + spriteLeftInWindow + spritePx,
    bottom: bounds.y + spriteTopInWindow + spritePx,
    width: spritePx,
    height: spritePx,
  }
}

/**
 * 右缘吸附后屏幕上可见条带的屏幕坐标（含 hover 感应外扩）。
 * @param {import('electron').Rectangle} bounds
 */
function computeRightPeekScreenHit(bounds) {
  const { peek } = spriteMetrics(bounds)
  const slop = HOVER_SLOP_PX
  const wa = workAreaForBounds(bounds)
  const sprite = spriteScreenRect(bounds)
  const visibleLeft = wa.x + wa.width - peek
  return {
    left: visibleLeft - slop,
    top: sprite.top - slop,
    width: peek + slop * 2,
    height: sprite.height + slop * 2,
  }
}

export function isWidgetDockCollapsed() {
  return (
    dock.side === 'right' &&
    (dock.phase === 'docked' || dock.phase === 'docking')
  )
}

export function isDockPushRevealActive() {
  return pushRevealActive
}

/**
 * 非勿扰 + 右缘半露：推送前滑出完整形象。
 * @returns {Promise<boolean>}
 */
export async function maybeRevealDockForPush() {
  if (state.lastSpriteInteractionLocked) return false
  if (!isWidgetDockCollapsed()) return false
  pushRevealActive = true
  clearCollapseTimer()
  await expandWidgetDock({ animated: true })
  return true
}

/** 气泡关闭后：推送临时展开 → 恢复半露。 */
export async function finishDockPushReveal() {
  if (!pushRevealActive) return
  pushRevealActive = false
  clearCollapseTimer()
  if (state.lastSpriteInteractionLocked) return
  if (!dock.side) return
  if (dock.phase === 'docked' || dock.phase === 'docking') return
  await collapseWidgetDock({ animated: true })
}

function clearPushRevealState() {
  pushRevealActive = false
}

function getWidgetWindow() {
  const win = state.spriteWindow
  if (!win || win.isDestroyed()) return null
  return win
}

function workAreaForBounds(bounds) {
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  return screen.getDisplayNearestPoint({ x: cx, y: cy }).workArea
}

/** macOS workArea 上/左/下缘无法真正贴屏，仅右缘做半露吸附。 */
function nearestRightSnapEdge(bounds, wa) {
  const distance = wa.x + wa.width - (bounds.x + bounds.width)
  if (distance > SNAP_THRESHOLD_PX) return null
  return { side: 'right', distance }
}

function computeRightDockedBounds(bounds, wa, expanded) {
  const { peek, spriteLeftInWindow } = spriteMetrics(bounds)
  const { y, width, height } = bounds
  const spriteLeftScreen = expanded
    ? wa.x + wa.width - width + spriteLeftInWindow
    : wa.x + wa.width - peek
  const nx = spriteLeftScreen - spriteLeftInWindow
  return { x: Math.round(nx), y, width, height }
}

function broadcastDockVisual() {
  const win = getWidgetWindow()
  if (!win) return
  const payload = {
    side: dock.side,
    phase: dock.phase,
  }
  try {
    win.webContents.send('sidekick:widget-dock-visual', payload)
  } catch {
    /* noop */
  }
}

function setDock(side, phase) {
  dock.side = side
  dock.phase = phase
  broadcastDockVisual()
}

function clearCollapseTimer() {
  if (dock.collapseTimer) {
    clearTimeout(dock.collapseTimer)
    dock.collapseTimer = null
  }
}

function animateWidgetBounds(target, phaseStart, phaseEnd) {
  const win = getWidgetWindow()
  if (!win) return Promise.resolve()
  if (dock.animating) return Promise.resolve()

  dock.animating = true
  setDock(dock.side, phaseStart)
  const start = win.getBounds()
  const startTime = Date.now()

  return new Promise((resolve) => {
    const step = () => {
      if (win.isDestroyed()) {
        dock.animating = false
        resolve()
        return
      }
      const t = Math.min(1, (Date.now() - startTime) / DOCK_ANIM_MS)
      const ease = 1 - (1 - t) ** 3
      const nx = Math.round(start.x + (target.x - start.x) * ease)
      const ny = Math.round(start.y + (target.y - start.y) * ease)
      win.setBounds({ ...start, x: nx, y: ny })
      if (t < 1) {
        setTimeout(step, 16)
        return
      }
      dock.animating = false
      setDock(dock.side, phaseEnd)
      persistWidgetBounds(win)
      resolve()
    }
    step()
  })
}

/**
 * @param {{ animated?: boolean; forceSide?: 'right' }} [opts]
 */
export async function snapWidgetToNearestEdge(opts = {}) {
  const place = getWidgetDockPlaceOverride()
  if (place >= 3) {
    return applyWidgetDockPlaceOverride({ animated: opts.animated !== false })
  }
  if (place === 2) {
    opts = { ...opts, forceSide: 'right' }
  }

  const win = getWidgetWindow()
  if (!win || dock.isDragging) return false
  syncLastSpriteAnchorToWindowMotion()
  const bounds = win.getBounds()
  const wa = workAreaForBounds(bounds)
  const pick = opts.forceSide === 'right'
    ? { side: 'right', distance: 0 }
    : nearestRightSnapEdge(bounds, wa)
  if (!pick) {
    if (dock.side) setDock(null, 'free')
    return false
  }
  dock.side = 'right'
  const target = computeRightDockedBounds(bounds, wa, false)
  if (opts.animated !== false) {
    await animateWidgetBounds(target, 'docking', 'docked')
  } else {
    win.setBounds(target)
    setDock('right', 'docked')
    persistWidgetBounds(win)
  }
  return true
}

/**
 * @param {{ animated?: boolean }} [opts]
 */
export async function expandWidgetDock(opts = {}) {
  const win = getWidgetWindow()
  if (!win || !dock.side || dock.phase === 'expanded' || dock.isDragging) return
  clearCollapseTimer()
  syncLastSpriteAnchorToWindowMotion()
  const bounds = win.getBounds()
  const wa = workAreaForBounds(bounds)
  const target = computeRightDockedBounds(bounds, wa, true)
  if (opts.animated !== false) {
    await animateWidgetBounds(target, 'expanding', 'expanded')
  } else {
    win.setBounds(target)
    setDock(dock.side, 'expanded')
    persistWidgetBounds(win)
  }
}

/**
 * @param {{ animated?: boolean }} [opts]
 */
export async function collapseWidgetDock(opts = {}) {
  const win = getWidgetWindow()
  if (!win || !dock.side || dock.phase === 'docked' || dock.isDragging) return
  const bounds = win.getBounds()
  const wa = workAreaForBounds(bounds)
  const target = computeRightDockedBounds(bounds, wa, false)
  if (opts.animated !== false) {
    await animateWidgetBounds(target, 'docking', 'docked')
  } else {
    win.setBounds(target)
    setDock(dock.side, 'docked')
    persistWidgetBounds(win)
  }
}

export function clearWidgetDock() {
  clearCollapseTimer()
  clearPushRevealState()
  dock.side = null
  dock.phase = 'free'
  dock.isDragging = false
  broadcastDockVisual()
}

export function onWidgetDragMove() {
  dock.isDragging = true
  clearCollapseTimer()
  clearPushRevealState()
  if (dock.side) {
    dock.side = null
    dock.phase = 'free'
    broadcastDockVisual()
  }
}

export async function onWidgetDragEnd() {
  dock.isDragging = false
  if (getWidgetDockPlaceOverride() !== 0) {
    await applyWidgetDockPlaceOverride({ animated: true })
    return
  }
  if (state.lastSpriteInteractionLocked) {
    await snapWidgetToNearestEdge({ animated: true })
    return
  }
  await snapWidgetToNearestEdge({ animated: true })
}

export async function onSpriteInteractionLockedChange(locked) {
  if (getWidgetDockPlaceOverride() !== 0 && locked) {
    await applyWidgetDockPlaceOverride({ animated: true })
    return
  }
  if (locked) {
    await snapWidgetToNearestEdge({ animated: true })
    return
  }
  if (dock.side && dock.phase === 'docked') {
    await expandWidgetDock({ animated: true })
  }
}

/**
 * 吸附态下根据光标位置展开/收起，并返回当前可交互屏幕矩形。
 * @returns {{ left: number; top: number; width: number; height: number } | null}
 */
export function tickWidgetDockHoverPassthrough() {
  const win = getWidgetWindow()
  if (!win || dock.isDragging) return null

  const shouldDockHover =
    state.lastSpriteInteractionLocked || (dock.side != null && dock.phase !== 'free')
  if (!shouldDockHover) return null

  if (state.lastSpriteInteractionLocked && !dock.side) {
    void snapWidgetToNearestEdge({ animated: true })
    return null
  }

  if (!dock.side) return null

  const bounds = win.getBounds()
  const isExpanded = dock.phase === 'expanded' || dock.phase === 'expanding'

  let hit
  if (isExpanded) {
    hit = { left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }
  } else {
    hit = computeRightPeekScreenHit(bounds)
  }

  const p = screen.getCursorScreenPoint()
  const inside =
    p.x >= hit.left &&
    p.x < hit.left + hit.width &&
    p.y >= hit.top &&
    p.y < hit.top + hit.height

  if (inside) {
    clearCollapseTimer()
    if (dock.phase === 'docked' || dock.phase === 'docking') {
      void expandWidgetDock({ animated: true })
    }
  } else if (
    !pushRevealActive &&
    (dock.phase === 'expanded' || dock.phase === 'expanding')
  ) {
    if (!dock.collapseTimer) {
      dock.collapseTimer = setTimeout(() => {
        dock.collapseTimer = null
        void collapseWidgetDock({ animated: true })
      }, DOCK_COLLAPSE_DEBOUNCE_MS)
    }
  }

  return hit
}

export function isWidgetDockActive() {
  return dock.side != null && dock.phase !== 'free'
}

/** 拖动时限制在 workArea 内；右缘允许略超出以便触发吸附。 */
export function clampWidgetPositionDuringDrag(bounds, wa) {
  const { peek } = spriteMetrics(bounds)
  const minX = wa.x
  const maxX = wa.x + wa.width - peek
  const minY = wa.y
  const maxY = wa.y + wa.height - bounds.height
  return {
    ...bounds,
    x: clamp(bounds.x, minX, maxX),
    y: clamp(bounds.y, minY, maxY),
  }
}

/**
 * 开发调试：`SIDEKICK_WIDGET_DOCK_PLACE` ≠ 0 时固定到预设位置（主进程 env）。
 * 0=正常吸附 | 2=右缘半露 | 3=左下角全显 | 4=右下角全显
 */
export function getWidgetDockPlaceOverride() {
  const n = Number.parseInt(String(process.env.SIDEKICK_WIDGET_DOCK_PLACE ?? '0'), 10)
  return Number.isFinite(n) ? n : 0
}

export async function applyWidgetDockPlaceOverride(opts = {}) {
  const place = getWidgetDockPlaceOverride()
  if (place === 0) return false
  const win = getWidgetWindow()
  if (!win) return false

  if (place === 2) {
    return snapWidgetToNearestEdge({
      forceSide: 'right',
      animated: opts.animated !== false,
    })
  }

  clearWidgetDock()
  const b = win.getBounds()
  const wa = screen.getPrimaryDisplay().workArea
  const margin = 16
  if (place === 3) {
    win.setBounds({
      ...b,
      x: Math.round(wa.x + margin),
      y: Math.round(wa.y + wa.height - b.height - margin),
    })
  } else if (place === 4) {
    win.setBounds({
      ...b,
      x: Math.round(wa.x + wa.width - b.width - margin),
      y: Math.round(wa.y + wa.height - b.height - margin),
    })
  } else {
    return false
  }
  persistWidgetBounds(win)
  broadcastDockVisual()
  return true
}

/** @returns {{ dockSide: 'right' | null; dockCollapsed: boolean; interactionLocked: boolean }} */
export function readWidgetSessionSnapshot() {
  return {
    dockSide: dock.side,
    dockCollapsed:
      dock.side === 'right' &&
      (dock.phase === 'docked' || dock.phase === 'docking'),
    interactionLocked: state.lastSpriteInteractionLocked,
  }
}

/**
 * 冷启动恢复吸附态与勿扰锁（在 widget 首屏 load 后调用）。
 * @param {ReturnType<typeof import('./widgetBounds.mjs').readSavedWidgetSession>} saved
 * @param {{ animated?: boolean }} [opts]
 */
export async function restoreWidgetSessionFromSaved(saved, opts = {}) {
  if (!saved || getWidgetDockPlaceOverride() !== 0) return
  const win = getWidgetWindow()
  if (!win) return

  if (saved.interactionLocked) {
    state.lastSpriteInteractionLocked = true
    applyWidgetWindowSpritePassthrough(true)
    try {
      win.webContents.send('sidekick:sprite-interaction-locked', true)
    } catch {
      /* noop */
    }
  }

  if (saved.dockSide === 'right' && saved.dockCollapsed) {
    await snapWidgetToNearestEdge({
      forceSide: 'right',
      animated: opts.animated !== false,
    })
  }
}
