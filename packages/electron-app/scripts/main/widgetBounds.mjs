import { app, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { clamp, rectsIntersect } from './geometry.mjs'
import {
  WIDGET_WINDOW_WIDTH,
  WIDGET_WINDOW_HEIGHT,
  WIDGET_MIN_WIDTH,
  WIDGET_MAX_WIDTH,
  WIDGET_MIN_HEIGHT,
  WIDGET_MAX_HEIGHT,
} from './constants.mjs'
import { state } from './state.mjs'

export function widgetBoundsFilePath() {
  return path.join(app.getPath('userData'), 'widget-bounds.json')
}

export function readSavedWidgetBounds() {
  try {
    const raw = fs.readFileSync(widgetBoundsFilePath(), 'utf8')
    const o = JSON.parse(raw)
    const x = Number(o.x)
    const y = Number(o.y)
    const width = Number(o.width)
    const height = Number(o.height)
    if (![x, y, width, height].every(Number.isFinite)) return null
    return { x, y, width, height }
  } catch {
    return null
  }
}

/** 首次启动：主显示器工作区右下角；右缘多留空，避免气泡以精灵为中心时超出屏幕。 */
export function defaultWidgetBounds(
  prefW = WIDGET_WINDOW_WIDTH,
  prefH = WIDGET_WINDOW_HEIGHT,
) {
  const { workArea } = screen.getPrimaryDisplay()
  const marginBottom = 10
  const marginRight = 48
  const w = clamp(Math.round(prefW), WIDGET_MIN_WIDTH, WIDGET_MAX_WIDTH)
  const h = clamp(Math.round(prefH), WIDGET_MIN_HEIGHT, WIDGET_MAX_HEIGHT)
  return {
    x: workArea.x + workArea.width - w - marginRight,
    y: workArea.y + workArea.height - h - marginBottom,
    width: w,
    height: h,
  }
}

export function ensureWidgetBoundsVisible(bounds) {
  let { x, y, width, height } = bounds
  width = clamp(Math.round(width), WIDGET_MIN_WIDTH, WIDGET_MAX_WIDTH)
  height = clamp(Math.round(height), WIDGET_MIN_HEIGHT, WIDGET_MAX_HEIGHT)
  const rect = { x, y, width, height }
  const intersectsAny = screen.getAllDisplays().some((d) => rectsIntersect(rect, d.workArea))
  if (!intersectsAny) return defaultWidgetBounds(width, height)
  const cx = x + width / 2
  const cy = y + height / 2
  const d = screen.getDisplayNearestPoint({ x: cx, y: cy })
  const wa = d.workArea
  const inset = 16
  const minX = wa.x - width + inset
  const maxX = wa.x + wa.width - inset
  const minY = wa.y - height + inset
  const maxY = wa.y + wa.height - inset
  if (minX <= maxX) x = clamp(x, minX, maxX)
  else x = wa.x + (wa.width - width) / 2
  if (minY <= maxY) y = clamp(y, minY, maxY)
  else y = wa.y + (wa.height - height) / 2
  return { x, y, width, height }
}

export function resolveInitialWidgetBounds() {
  const saved = readSavedWidgetBounds()
  if (saved) return ensureWidgetBoundsVisible(saved)
  return defaultWidgetBounds()
}

export function schedulePersistWidgetBounds(win) {
  if (!win || win.isDestroyed()) return
  if (state.widgetBoundsSaveTimer) clearTimeout(state.widgetBoundsSaveTimer)
  state.widgetBoundsSaveTimer = setTimeout(() => {
    state.widgetBoundsSaveTimer = null
    persistWidgetBounds(win)
  }, 500)
}

export function persistWidgetBounds(win) {
  if (!win || win.isDestroyed()) return
  try {
    fs.writeFileSync(widgetBoundsFilePath(), JSON.stringify(win.getBounds()), 'utf8')
  } catch (e) {
    console.error('[sidekick] persist widget bounds failed', e)
  }
}
