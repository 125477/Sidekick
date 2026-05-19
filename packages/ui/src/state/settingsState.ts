import type { ToastAnchor } from './uiState'
import type { CompanionCopyStyle, DashScopeTtsModel } from '@sidekick/core'

/** 默认推送间隔（分钟）；气泡默认停留时长与之相同。 */
export const DEFAULT_PUSH_INTERVAL_MINUTES = 3

export const MIN_INTERVAL_MINUTES = 1
export const MAX_INTERVAL_MINUTES = 60

/** 旧版持久化字段：停留秒数。 */
export const LEGACY_DEFAULT_DWELL_SECONDS = 60

export function clampIntervalMinutes(minutes: number): number {
  const m = Number(minutes)
  if (!Number.isFinite(m)) return DEFAULT_PUSH_INTERVAL_MINUTES
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.floor(m)))
}

export function clampDwellMinutes(minutes: number): number {
  return clampIntervalMinutes(minutes)
}

export function isFocusPresetMinutesValid(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes > 0
}

/** 加载设置时：无效或非正数回退默认；不设上限。 */
export function normalizeFocusPresetMinutes(minutes: number): number {
  const m = Number(minutes)
  if (!isFocusPresetMinutesValid(m)) return defaultSettings.focusPresetMinutes
  return m
}

/** 气泡 / IPC 计时仍用秒，由分钟设置换算。 */
export function dwellMinutesToSeconds(minutes: number): number {
  return clampDwellMinutes(minutes) * 60
}

export type SidekickSettings = {
  pushEnabled: boolean
  pushIntervalMinutes: number
  pushStart: string
  pushEnd: string
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
  toastAnchor: ToastAnchor
  /** 气泡停留时长（分钟）；与推送间隔默认同值。 */
  dwellMinutes: number
  toastAlwaysVisible: boolean
  clickToFetchEnabled: boolean
  avatarSize: number
  avatarOpacity: number
  /** 生成陪伴短句（千问等）时的采样温度；越高输出越多样，越低越稳。 */
  textTemperature: number
  /** 预留：文生图 / 形象生成等接入后可作图像侧 temperature；当前仅持久化，生成链路未读取。 */
  imageTemperature: number
  textStyle: CompanionCopyStyle
  allowEmoji: boolean
  textMaxChars: number
  /** 手动开关：仅 `darkModeSource === 'manual'` 时生效。 */
  darkMode: boolean
  /** 夜间模式来源：手动 / 跟随系统 / 自定义时段。 */
  darkModeSource: 'manual' | 'system' | 'schedule'
  /** 定时夜间：开始时刻（本地 `HH:mm`）。 */
  darkModeScheduleStart: string
  /** 定时夜间：结束时刻（本地 `HH:mm`）。 */
  darkModeScheduleEnd: string
  motionEnabled: boolean
  language: 'zh-CN' | 'en-US'
  /** After companion copy is generated and shown (toast / panel / desktop bubble). */
  companionTtsEnabled: boolean
  /** DashScope TTS 模型（可被设置覆盖；未配置时 companionTts 仍可读 env）。 */
  companionTtsModel: DashScopeTtsModel
  /**
   * Qwen：系统音色名（如 Cherry）；CosyVoice：控制台 voice id。
   */
  companionTtsVoice: string
  /** CosyVoice SpeechSynthesizer 语速 0.5–2；Qwen 路径当前不生效但会保存。 */
  companionTtsSpeechRate: number
  /**
   * 为 true：仅当「定时推送」的新句在气泡成功展示后自动切到下一形象（顺序同换肤，末位后回到首位）。
   * 本会话内首次定时推送成功展示不切；点正文换句、互动等不切。
   */
  pushAutoSwitchAvatar: boolean
  /**
   * 用户标记的兴趣（如 音乐、影视）；写入 system prompt 作轻微偏好参考。
   */
  companionInterests: string[]
  /** 今日心情：总开关（含面板与本地记录）。 */
  dailyMoodEnabled: boolean
  /** 到点系统通知提醒写今日小结（需 Electron 通知权限）。 */
  dailyMoodReminderEnabled: boolean
  /** 本地时区「HH:mm」提醒时间。 */
  dailyMoodReminderTime: string
  /** 专注会话结束时间戳（毫秒）；未到时间则暂停定时陪伴推送。 */
  focusSessionUntilEpochMs: number | null
  /** 设置页「开始专注」默认时长（分钟）。 */
  focusPresetMinutes: number
  /** 辅面板共用自定义背景（媒体存 panelBackground store）。 */
  panelBackgroundEnabled: boolean
  panelBackgroundOverlayOpacity: number
  /** 底图本身不透明度，1 为完全显示。 */
  panelBackgroundImageOpacity: number
  panelBackgroundBlurPx: number
  /** 登录时自动启动应用（Electron `setLoginItemSettings`）。 */
  launchAtLogin: boolean
}

/** 用于跨窗口同步后避免 `setSettings` 无变化仍换新引用，触发 `saveSettings` 死循环。 */
export function areSettingsEqual(a: SidekickSettings, b: SidekickSettings): boolean {
  for (const k of Object.keys(a) as (keyof SidekickSettings)[]) {
    const va = a[k]
    const vb = b[k]
    if (k === 'companionInterests') {
      const aa = va as string[]
      const bb = vb as string[]
      if (aa.length !== bb.length) return false
      for (let i = 0; i < aa.length; i++) {
        if (aa[i] !== bb[i]) return false
      }
      continue
    }
    if (va !== vb) return false
  }
  return true
}

/** 除形象大小、透明度外是否与 b 一致（用于滑条拖动单独防抖落盘）。 */
export function settingsEqualExceptAvatarSliders(
  a: SidekickSettings,
  b: SidekickSettings,
): boolean {
  for (const k of Object.keys(a) as (keyof SidekickSettings)[]) {
    if (k === 'avatarSize' || k === 'avatarOpacity') continue
    const va = a[k]
    const vb = b[k]
    if (k === 'companionInterests') {
      const aa = va as string[]
      const bb = vb as string[]
      if (aa.length !== bb.length) return false
      for (let i = 0; i < aa.length; i++) {
        if (aa[i] !== bb[i]) return false
      }
      continue
    }
    if (va !== vb) return false
  }
  return true
}

/** 是否仅大小/透明度相对 prev 发生变化（其它字段一致）。 */
export function onlyAvatarSlidersChanged(
  prev: SidekickSettings,
  next: SidekickSettings,
): boolean {
  if (!settingsEqualExceptAvatarSliders(prev, next)) return false
  return prev.avatarSize !== next.avatarSize || prev.avatarOpacity !== next.avatarOpacity
}

export const defaultSettings: SidekickSettings = {
  pushEnabled: true,
  pushIntervalMinutes: DEFAULT_PUSH_INTERVAL_MINUTES,
  pushStart: '08:00',
  pushEnd: '22:00',
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  toastAnchor: 'bottom',
  dwellMinutes: DEFAULT_PUSH_INTERVAL_MINUTES,
  toastAlwaysVisible: false,
  clickToFetchEnabled: true,
  avatarSize: 80,
  avatarOpacity: 90,
  textTemperature: 0.85,
  imageTemperature: 0.5,
  textStyle: '治愈',
  allowEmoji: false,
  textMaxChars: 32,
  darkMode: false,
  darkModeSource: 'system',
  darkModeScheduleStart: '20:00',
  darkModeScheduleEnd: '06:00',
  motionEnabled: true,
  language: 'zh-CN',
  companionTtsEnabled: false,
  companionTtsModel: 'qwen-tts-2025-05-22',
  companionTtsVoice: 'Chelsie',
  companionTtsSpeechRate: 1,
  pushAutoSwitchAvatar: false,
  companionInterests: [],
  dailyMoodEnabled: true,
  dailyMoodReminderEnabled: true,
  dailyMoodReminderTime: '17:00',
  focusSessionUntilEpochMs: null,
  focusPresetMinutes: 25,
  panelBackgroundEnabled: false,
  panelBackgroundOverlayOpacity: 0.45,
  panelBackgroundImageOpacity: 1,
  panelBackgroundBlurPx: 0,
  launchAtLogin: true,
}
