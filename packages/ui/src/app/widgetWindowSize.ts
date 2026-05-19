/** Renderer ↔ main: widget window width clamps (keep in sync with electron `constants.mjs`). */
export const WIDGET_WINDOW_MIN_WIDTH_PX = 160
export const WIDGET_WINDOW_MAX_WIDTH_PX = 620

export function clampWidgetWindowWidthPx(width: number): number {
  return Math.min(
    WIDGET_WINDOW_MAX_WIDTH_PX,
    Math.max(WIDGET_WINDOW_MIN_WIDTH_PX, Math.round(width)),
  )
}
