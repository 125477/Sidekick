/** 独立气泡窗与卡片共用：卡片 min 288px；窗宽 = 卡片 + 边缘留白，避免圆角被裁切。 */
export const TOAST_CARD_MAX_PX = 340
export const TOAST_CARD_MIN_PX = 288
export const TOAST_CARD_MIN_CLASS = 'min-w-[288px]'
/** 勿用 100vw：独立 toast 窗体窄时 max 会小于 min，圆角被 #root overflow 裁切。 */
export const TOAST_CARD_MAX_CLASS = 'max-w-[340px]'
export const TOAST_CARD_MAX_CLASS_DETACHED = 'max-w-full'
/** 独立 toast 壳 `px-1` + 边框/阴影余量，须计入 Electron 窗宽。 */
export const TOAST_WINDOW_EDGE_PAD_PX = 16

export function clampToastWindowWidthPx(cardContentWidth: number): number {
  const content = Math.max(
    TOAST_CARD_MIN_PX,
    Math.ceil(cardContentWidth),
  )
  return Math.min(
    TOAST_CARD_MAX_PX + TOAST_WINDOW_EDGE_PAD_PX,
    content + TOAST_WINDOW_EDGE_PAD_PX,
  )
}
