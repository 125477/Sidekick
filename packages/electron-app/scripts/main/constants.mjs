export const EXPLICIT_UI_URL = process.env.SIDEKICK_UI_URL
export const DEV_SERVER_URL_CANDIDATES = EXPLICIT_UI_URL
  ? [EXPLICIT_UI_URL]
  : [5173, 5174, 5175, 5176, 5177, 5178].map((port) => `http://localhost:${port}`)

export const WIDGET_WINDOW_WIDTH = 360
/** Initial height; renderer measures sprite layer and IPC-resizes to fit. */
export const WIDGET_WINDOW_HEIGHT = 216
/**
 * 菜单打开的独立窗口（设置 / 换肤 / 情绪 / 抽签 / 收藏）与「首次引导」窗共用一套尺寸。
 * 需要统一改大小时：只改下面四个常量即可（主进程创建窗口 + resize-panel 对齐）。
 * 精灵窗、气泡窗尺寸不在此列。
 */
export const AUX_WINDOW_WIDTH = 980
export const AUX_WINDOW_HEIGHT = 780
export const AUX_WINDOW_MIN_WIDTH = 800
export const AUX_WINDOW_MIN_HEIGHT = 600
/** Match EmotionToast `max-w` so the detached bubble window is not wider than the card. */
/** 初始宽；渲染器 `resizeToastWindow` 会按卡片内容收窄。 */
export const TOAST_WINDOW_WIDTH = 304
/** 与 ui `TOAST_CARD_MIN_PX`(288) + 边缘留白对齐 */
export const TOAST_WINDOW_MIN_WIDTH = 304
/** Initial height before renderer measures content; IPC resize fits actual bubble + tail. */
export const TOAST_WINDOW_HEIGHT = 96
/** 屏幕右下角提醒卡片（如今日心情）。 */
export const CORNER_NOTIFICATION_WIDTH = 360
export const CORNER_NOTIFICATION_HEIGHT = 140
export const CORNER_NOTIFICATION_MARGIN = 16
export const TOAST_GAP = 6
/** Sprite block inside the widget (matches SpriteShell `h-36`). */
export const SPRITE_SIZE = 144
/** 与 `SpriteMenuPanel`（`w-39` + 边框）匹配。 */
export const SPRITE_MENU_WINDOW_WIDTH = 172
/** 与 `SpriteMenuPanel` 七行 `h-9` + `divide-y` 对齐（改菜单项数时同步） */
export const SPRITE_MENU_WINDOW_HEIGHT = 272
/** 拖动星星拖尾 overlay（单次拖动内固定位置，略大以减少 Win 上 setBounds）。 */
export const DRAG_TRAIL_WINDOW_WIDTH = 560
export const DRAG_TRAIL_WINDOW_HEIGHT = 400

export const SPRITE_MENU_ACTIONS = new Set([
  'skin',
  'settings',
  'favorites',
  'emotion',
  'fortune',
  'more',
  'exit',
])

/** 与 packages/ui `APP_DISPLAY_NAME`、electron-builder `productName` 一致。 */
export const APP_DISPLAY_NAME = '灵伴'
export const PANEL_WINDOW_TITLE = {
  skin: '更换形象',
  settings: '设置',
  emotion: '情绪反馈',
  fortune: '每日抽签',
  favorites: '收藏历史',
}

export const WIDGET_MIN_WIDTH = 300
export const WIDGET_MAX_WIDTH = 640
export const WIDGET_MIN_HEIGHT = 168
export const WIDGET_MAX_HEIGHT = 720

/** Matches widget shell `pb-2`. Sprite sits bottom-right in the window. */
export const WIDGET_PAD_BOTTOM = 8
