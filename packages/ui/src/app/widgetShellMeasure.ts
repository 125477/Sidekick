/** Matches widget `pr-3` on the flex shell in `App.tsx`. */
const WIDGET_SHELL_PAD_X = 12
/** Matches widget `pt-2 pb-2`. */
const WIDGET_SHELL_PAD_Y = 8

function unionViewportBounds(root: HTMLElement): DOMRect | null {
  const rootRect = root.getBoundingClientRect()
  if (rootRect.width < 4 || rootRect.height < 4) return null

  let left = rootRect.left
  let top = rootRect.top
  let right = rootRect.right
  let bottom = rootRect.bottom

  for (const node of root.querySelectorAll('[data-widget-layout-bound]')) {
    if (!(node instanceof HTMLElement)) continue
    const r = node.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }

  return new DOMRect(left, top, right - left, bottom - top)
}

/** 精灵可点区域（视口坐标），用于 Electron 窗体透明区点击穿透。 */
export function measureWidgetInteractClientRect(
  root: HTMLElement,
): { left: number; top: number; width: number; height: number } | null {
  const union = unionViewportBounds(root)
  if (!union || union.width < 1 || union.height < 1) return null
  return {
    left: union.left,
    top: union.top,
    width: union.width,
    height: union.height,
  }
}

/** Content box for `resizeWidgetWindow` (includes shell padding). */
export function measureWidgetShellBounds(
  root: HTMLElement,
): { width: number; height: number } | null {
  const union = unionViewportBounds(root)
  if (!union) return null
  return {
    width: Math.ceil(union.width + WIDGET_SHELL_PAD_X),
    height: Math.ceil(union.height + WIDGET_SHELL_PAD_Y),
  }
}
