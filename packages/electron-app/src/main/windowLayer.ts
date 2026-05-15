export const WINDOW_Z_LAYERS = {
  sprite: 20,
  toast: 30,
  menu: 40,
} as const

export const SAFE_MARGINS = {
  top: 20,
  right: 20,
  bottom: 28,
  left: 20,
} as const

export type ToastAnchor = 'top' | 'bottom'

export function resolveToastY(anchor: ToastAnchor, viewportHeight: number): number {
  if (anchor === 'top') return SAFE_MARGINS.top
  return Math.max(0, viewportHeight - SAFE_MARGINS.bottom)
}
