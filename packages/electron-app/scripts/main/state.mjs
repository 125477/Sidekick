import { app } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { EXPLICIT_UI_URL, DEV_SERVER_URL_CANDIDATES } from './constants.mjs'

export function resolveInitialBaseUrl() {
  if (app.isPackaged) {
    const root = path.join(process.resourcesPath, 'ui-dist')
    return pathToFileURL(root).href + '/'
  }
  return EXPLICIT_UI_URL ?? DEV_SERVER_URL_CANDIDATES[0]
}

/**
 * 主进程可变状态（单例）。窗口工厂、气泡几何、IPC 共用此对象，避免隐式全局散落。
 * @type {{
 *   baseUrl: string
 *   candidateIndex: number
 *   spriteWindow: import('electron').BrowserWindow | null
 *   panelWindow: import('electron').BrowserWindow | null
 *   onboardingWindow: import('electron').BrowserWindow | null
 *   toastWindow: import('electron').BrowserWindow | null
 *   cornerNotificationWindow: import('electron').BrowserWindow | null
 *   cornerNotificationPayload: null | { panel: string; emotionTab: string }
 *   moodReminderSnapshot: null | {
 *     settingsReady: boolean
 *     onboardingComplete: boolean
 *     dailyMoodEnabled: boolean
 *     dailyMoodReminderEnabled: boolean
 *     dailyMoodReminderTime: string
 *     hasMoodEntryToday: boolean
 *     updatedAt: number
 *   }
 *   spriteMenuWindow: import('electron').BrowserWindow | null
 *   spriteMenuLoadedUrl: string | null
 *   spriteMenuWarmInFlight: Promise<boolean> | null
 *   lastSpriteMenuInvoker: 'sprite' | 'toast' | null
 *   toastTimerId: ReturnType<typeof setTimeout> | null
 *   passthroughPollId: ReturnType<typeof setInterval> | null
 *   toastPassthroughClientRect: { left: number; top: number; width: number; height: number } | null
 *   widgetPassthroughClientRect: { left: number; top: number; width: number; height: number } | null
 *   lastPreferredToastAnchor: 'top' | 'bottom'
 *   lastToastTailDown: boolean
 *   lastToastSession: null | {
 *     message: string
 *     effectiveAnchor: string
 *     dwellSeconds: number
 *     textId?: string
 *     favorite?: boolean
 *   }
 *   detachToastAnchorRefreshRunning: boolean
 *   detachToastAnchorRefreshQueued: boolean
 *   lastSpriteAnchor: null | { centerX: number; topY: number; bottomY: number }
 *   spriteAnchorBase: null | { centerX: number; topY: number; bottomY: number }
 *   spriteBoundsAtAnchorSet: import('electron').Rectangle | null
 *   lastAvatarSizePercent: number
 *   lastSpriteInteractionLocked: boolean
 *   widgetBoundsSaveTimer: ReturnType<typeof setTimeout> | null
 *   dragTrailWindow: import('electron').BrowserWindow | null
 *   dragTrailOrigin: null | { x: number; y: number }
 *   dragTrailLoaded: boolean
 *   dragTrailDragging: boolean
 *   dragTrailHideTimer: ReturnType<typeof setTimeout> | null
 *   dragTrailPendingPoints: Array<{ x: number; y: number }>
 *   dragTrailFlushScheduled: boolean
 *   dragTrailRepositionLocked: boolean
 *   dragTrailFlushTimer: ReturnType<typeof setTimeout> | null
 *   dragTrailStarWidth: number
 *   dragTrailStarHeight: number
 *   dragTrailLastRepositionMs: number
 *   dragTrailSessionStarting: boolean
 *   dragTrailQueuedScreen: Array<{ screenX: number; screenY: number }>
 * }}
 */
export const state = {
  baseUrl: '',
  candidateIndex: 0,
  spriteWindow: null,
  panelWindow: null,
  onboardingWindow: null,
  toastWindow: null,
  cornerNotificationWindow: null,
  cornerNotificationPayload: null,
  moodReminderSnapshot: null,
  spriteMenuWindow: null,
  spriteMenuLoadedUrl: null,
  spriteMenuWarmInFlight: null,
  lastSpriteMenuInvoker: null,
  toastTimerId: null,
  passthroughPollId: null,
  toastPassthroughClientRect: null,
  widgetPassthroughClientRect: null,
  lastPreferredToastAnchor: /** @type {'top' | 'bottom'} */ ('top'),
  lastToastTailDown: true,
  lastToastSession: null,
  detachToastAnchorRefreshRunning: false,
  detachToastAnchorRefreshQueued: false,
  lastSpriteAnchor: null,
  spriteAnchorBase: null,
  spriteBoundsAtAnchorSet: null,
  lastAvatarSizePercent: 80,
  lastSpriteInteractionLocked: false,
  widgetBoundsSaveTimer: null,
  dragTrailWindow: null,
  dragTrailOrigin: null,
  dragTrailLoaded: false,
  dragTrailDragging: false,
  dragTrailHideTimer: null,
  dragTrailPendingPoints: [],
  dragTrailFlushScheduled: false,
  dragTrailRepositionLocked: false,
  dragTrailFlushTimer: null,
  dragTrailStarWidth: 144,
  dragTrailStarHeight: 144,
  dragTrailLastRepositionMs: 0,
  dragTrailSessionStarting: false,
  dragTrailQueuedScreen: [],
}

state.baseUrl = resolveInitialBaseUrl()
