type SidekickPanel = 'skin' | 'settings' | 'emotion' | 'fortune' | 'favorites'

type SidekickSpriteMenuAction =
  | 'skin'
  | 'settings'
  | 'favorites'
  | 'emotion'
  | 'fortune'
  | 'more'
  | 'exit'

/** 精灵热区在屏幕上的矩形（与 `getBoundingClientRect` + `window.screenX/Y` 一致）。 */
type SidekickSpriteMenuAnchor = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}
type SidekickToastAnchor = 'top' | 'bottom'

type SidekickSpriteAnchor = {
  centerX: number
  topY: number
  bottomY: number
  /** 与设置「大小(%)」一致；用于主进程按比例拉开独立气泡与精灵间距。 */
  avatarSizePercent?: number
  /**
   * 仅传给 preload：为 true 时用 `invoke` 与主进程同帧对齐（打开气泡前须 await）。
   * 高频上报（ResizeObserver 等）不传，走 `send` 降低往返延迟。
   */
  _sync?: boolean
}

type ScreenWorkArea = {
  x: number
  y: number
  width: number
  height: number
}

type DashScopeChatPayload = {
  apiKey: string | undefined
  model: string | undefined
  systemPrompt: string
  userPrompt: string
  temperature: number | undefined
  chatCompletionsUrl?: string
  /** 逗号分隔的额外 model 候选（VITE_DASHSCOPE_MODEL_FALLBACK）。 */
  modelFallbackEnv?: string
}

type DashScopeTtsPayload = {
  apiKey: string
  model: 'qwen-tts-2025-05-22' | 'qwen3-tts-flash' | 'cosyvoice-v3.5-flash'
  text: string
  voice: string
  languageType?: string
  speechRate?: number
  requestBasePath?: string
}

type DashScopeTtsResult = {
  /** OSS 直链：渲染进程用 `<audio src>` 播放 */
  url?: string
  base64?: string
  mimeType?: string
}

type SidekickDesktopApi = {
  openPanelWindow: (
    panel: SidekickPanel,
    opts?: { emotionTab?: 'moment' | 'summary' },
  ) => Promise<void>
  /** 系统通知（点击可打开情绪面板并定位到今日小结）。 */
  showSystemNotification?: (payload: {
    title?: string
    body: string
    panel?: 'emotion'
    emotionTab?: 'moment' | 'summary'
  }) => Promise<boolean>
  /** 屏幕右下角自定义提醒（不依赖 macOS 系统通知）。 */
  showCornerNotification?: (payload: {
    title?: string
    body: string
    panel?: 'emotion'
    emotionTab?: 'moment' | 'summary'
  }) => Promise<boolean>
  hideCornerNotification?: () => Promise<void>
  openCornerNotificationTarget?: () => Promise<void>
  updateMoodReminderSnapshot?: (snapshot: {
    settingsReady: boolean
    onboardingComplete: boolean
    dailyMoodEnabled: boolean
    dailyMoodReminderEnabled: boolean
    dailyMoodReminderTime: string
    hasMoodEntryToday: boolean
  }) => void
  /** 打开独立「首次引导」窗口（与精灵悬浮窗分离）。 */
  openOnboardingWindow?: () => Promise<void>
  /** 引导窗内保存完成后调用：通知精灵窗并关闭引导窗口。 */
  notifyOnboardingComplete?: () => Promise<void>
  /** 精灵窗订阅：引导在独立窗口中完成时触发。 */
  onOnboardingFinished?: (callback: () => void) => () => void
  showToastWindow: (payload: {
    message: string
    anchor: SidekickToastAnchor
    dwellSeconds: number
    /** 与本地 `texts.history` 对应，用于独立气泡内收藏 */
    textId?: string
    favorite?: boolean
    /** App 自我介绍：长文案 + 知道了 */
    toastIntro?: boolean
  }) => Promise<void>
  /**
   * 已展示独立气泡时，主进程优先用 IPC 同步版式；仅在页面未就绪时整页重载。无气泡则仅更新主进程偏好。
   * 精灵窗与独立 Panel 设置窗均可调用（不依赖各窗的 `lastShownToastMessageRef`）。
   */
  setToastAnchorPreference?: (payload: {
    anchor: SidekickToastAnchor
    /** 与当前偏好相同仍重载独立气泡（设置里重复点当前分段时的「退场再进场」）。 */
    forceReplay?: boolean
  }) => Promise<void>
  hideToastWindow: () => Promise<void>
  /** 系统休眠恢复 / 解锁屏幕（仅 Electron 桌面端）。 */
  onSystemResume?: (callback: () => void) => () => void
  /** 主进程定时唤醒，用于今日心情提醒（macOS 休眠后 renderer 计时可能滞后）。 */
  onMoodReminderTick?: (callback: () => void) => () => void
  /**
   * Electron 独立气泡：锁定后整窗 `setIgnoreMouseEvents(forward)` 穿透；
   * 渲染进程上报解锁按钮（或换句 loading 时整张卡）的视口矩形，主进程轮询光标是否在矩形内。
   */
  reportToastPassthroughInteractRect?: (
    rect: { left: number; top: number; width: number; height: number } | null,
  ) => void
  /**
   * 精灵悬浮窗：锁定且无可点浮层时整窗 `setIgnoreMouseEvents(forward)`，鼠标落到下层应用（与歌词锁一致）。
   * `false` 恢复接收鼠标。
   */
  setWidgetPointerPassthrough?: (enabled: boolean) => void
  /** 与精灵窗同步：独立气泡工具栏锁定/解锁形象交互。 */
  setSpriteInteractionLocked?: (locked: boolean) => Promise<void>
  getSpriteInteractionLocked?: () => Promise<boolean>
  /** 精灵窗订阅：主进程在锁定状态变化时广播（含从气泡 invoke 写入）。 */
  onSpriteInteractionLocked?: (callback: (locked: boolean) => void) => () => void
  /** 独立气泡窗订阅：主进程在不重载页面的情况下推送与 URL 一致的上下锚与 placement。 */
  onDetachedToastPlacementSync?: (
    callback: (payload: {
      anchor: SidekickToastAnchor
      placement: 'above' | 'below'
    }) => void,
  ) => () => void
  resizeToastWindow?: (payload: {
    height: number
    width?: number
  }) => Promise<void>
  /** Fit desktop sprite window to measured content (avatar + menu). `width` 用于引导等需加宽的场景；省略则恢复紧凑宽度。 */
  resizeWidgetWindow?: (payload: { height: number; width?: number }) => Promise<void>
  /** 挂件精灵窗：在形象 `no-drag` 热区内拖动时，由主进程按增量平移窗口（避免 `-webkit-app-region: drag` 吞点击）。 */
  moveWidgetBy?: (payload: { dx: number; dy: number }) => Promise<void>
  /** 打开/复用全屏拖尾 overlay，在拖动开始时调用。 */
  beginDragTrail?: (payload: {
    screenX: number
    screenY: number
  }) => Promise<boolean | void>
  pushDragTrailPoint?: (payload: {
    screenX: number
    screenY: number
  }) => void
  endDragTrail?: () => void
  /** `mode=drag-trail` overlay 窗订阅 */
  onDragTrailPoint?: (
    callback: (payload: { x: number; y: number }) => void,
  ) => () => void
  onDragTrailPoints?: (
    callback: (points: Array<{ x: number; y: number }>) => void,
  ) => () => void
  onDragTrailShift?: (
    callback: (payload: { dx: number; dy: number }) => void,
  ) => () => void
  onDragTrailReset?: (callback: () => void) => () => void
  onDragTrailResetSampler?: (callback: () => void) => () => void
  onDragTrailSync?: (
    callback: (payload: {
      originX: number
      originY: number
      width: number
      height: number
    }) => void,
  ) => () => void
  /** 将 panel 窗内容区设回与主进程 `AUX_WINDOW_*` 一致（payload 已忽略，可传任意占位）。 */
  resizePanelWindow?: (payload?: { width?: number; height?: number }) => Promise<void>
  /** Widget only: measured sprite bounds in screen coordinates for toast placement. */
  setSpriteAnchor?: (anchor: SidekickSpriteAnchor) => Promise<void>
  /** Toast window → main → widget: ask for a new companion line; resolves when widget finishes. */
  /** Fire-and-forget: main forwards to widget; do not invoke from toast (loadURL would break the promise). */
  requestRegenerateCopy?: () => Promise<void>
  /** Widget only: main forwards clicks from the detached toast. */
  onRegenerateCopyRequested?: (callback: () => void) => () => void
  getWorkArea?: () => Promise<ScreenWorkArea | null>
  /** Main-process DashScope call (no renderer CORS). */
  dashscopeChat?: (payload: DashScopeChatPayload) => Promise<string>
  dashscopeTts?: (payload: DashScopeTtsPayload) => Promise<DashScopeTtsResult>
  /** 退出桌面应用（主进程 `app.quit()`）。纯 Web 无注入时不存在。 */
  quitApp?: () => Promise<void>
  /** 挂件：打开独立菜单窗（`mode=sprite-menu`），`bounds` 为屏幕坐标。 */
  openWidgetSpriteMenu?: (bounds: SidekickSpriteMenuAnchor) => Promise<void>
  /** 关闭独立菜单窗。`notify: true` 时向精灵窗发 `onWidgetSpriteMenuClosed`（失焦等）。 */
  closeWidgetSpriteMenu?: (opts?: { notify?: boolean }) => Promise<void>
  /** 独立菜单窗内：用户点选某一项。 */
  submitWidgetSpriteMenuAction?: (
    action: SidekickSpriteMenuAction,
  ) => Promise<void>
  /** 精灵窗：订阅菜单窗提交的选项（与内联 `SpriteMenu` 的 `onAction` 一致）。 */
  onWidgetSpriteMenuPick?: (
    callback: (action: SidekickSpriteMenuAction) => void,
  ) => () => void
  /** 精灵窗：菜单窗被关闭（失焦、移动挂件等）时同步 UI。 */
  onWidgetSpriteMenuClosed?: (callback: () => void) => () => void
}

declare global {
  interface Window {
    sidekickDesktop?: SidekickDesktopApi
  }
}

export {}
