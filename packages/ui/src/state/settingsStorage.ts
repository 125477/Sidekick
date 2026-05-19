import localforage from 'localforage'
import {
  DEFAULT_QWEN_TTS_VOICE,
  QWEN_TTS_VOICE_IDS,
} from '../constants/qwenTtsVoices'
import type { SidekickSettings } from './settingsState'
import {
  DEFAULT_PUSH_INTERVAL_MINUTES,
  LEGACY_DEFAULT_DWELL_SECONDS,
  clampDwellMinutes,
  normalizeFocusPresetMinutes,
  clampIntervalMinutes,
  defaultSettings,
} from './settingsState'

const SETTINGS_KEY = 'sidekick.settings.v1'
/** 与 SETTINGS 同库：首次引导完成后写入 `'1'`。 */
const ONBOARDING_DONE_KEY = 'sidekick.onboarding.done'

type PersistedSettings = Partial<SidekickSettings> & { dwellSeconds?: number }

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'settings',
})

export async function loadSettings(): Promise<SidekickSettings> {
  const raw = await store.getItem<PersistedSettings>(SETTINGS_KEY)
  if (!raw) return defaultSettings
  const merged = { ...defaultSettings, ...raw } as SidekickSettings & {
    dwellSeconds?: number
  }
  merged.companionInterests = Array.isArray(raw.companionInterests)
    ? raw.companionInterests.filter((x) => typeof x === 'string')
    : []

  const legacyDwellSeconds =
    typeof raw.dwellSeconds === 'number' && Number.isFinite(raw.dwellSeconds)
      ? raw.dwellSeconds
      : typeof merged.dwellSeconds === 'number' && Number.isFinite(merged.dwellSeconds)
        ? merged.dwellSeconds
        : null

  if (typeof merged.dwellMinutes !== 'number' || !Number.isFinite(merged.dwellMinutes)) {
    if (legacyDwellSeconds != null && legacyDwellSeconds > 0) {
      merged.dwellMinutes = Math.max(1, Math.round(legacyDwellSeconds / 60))
    } else {
      merged.dwellMinutes = defaultSettings.dwellMinutes
    }
  }
  delete merged.dwellSeconds
  merged.dwellMinutes = clampDwellMinutes(merged.dwellMinutes)
  merged.pushIntervalMinutes = clampIntervalMinutes(merged.pushIntervalMinutes)
  if (
    merged.dwellMinutes === 1 &&
    merged.pushIntervalMinutes === DEFAULT_PUSH_INTERVAL_MINUTES &&
    legacyDwellSeconds === LEGACY_DEFAULT_DWELL_SECONDS
  ) {
    merged.dwellMinutes = merged.pushIntervalMinutes
  }

  if (
    merged.companionTtsModel === 'cosyvoice-v3.5-flash' ||
    merged.companionTtsModel === 'qwen3-tts-flash'
  ) {
    merged.companionTtsModel = 'qwen-tts-2025-05-22'
  }
  if (!QWEN_TTS_VOICE_IDS.has(merged.companionTtsVoice.trim())) {
    merged.companionTtsVoice = DEFAULT_QWEN_TTS_VOICE
  }
  if (merged.companionTtsVoice === 'Cherry') {
    merged.companionTtsVoice = DEFAULT_QWEN_TTS_VOICE
  }
  if (typeof merged.companionTtsEnabled !== 'boolean') {
    merged.companionTtsEnabled = defaultSettings.companionTtsEnabled
  }
  if (typeof merged.pushAutoSwitchAvatar !== 'boolean') {
    merged.pushAutoSwitchAvatar = defaultSettings.pushAutoSwitchAvatar
  }
  merged.allowEmoji = false
  if (typeof merged.dailyMoodEnabled !== 'boolean') {
    merged.dailyMoodEnabled = defaultSettings.dailyMoodEnabled
  }
  if (typeof merged.dailyMoodReminderEnabled !== 'boolean') {
    merged.dailyMoodReminderEnabled = defaultSettings.dailyMoodReminderEnabled
  }
  if (typeof merged.dailyMoodReminderTime !== 'string' || !merged.dailyMoodReminderTime) {
    merged.dailyMoodReminderTime = defaultSettings.dailyMoodReminderTime
  }
  if (
    merged.focusSessionUntilEpochMs != null &&
    typeof merged.focusSessionUntilEpochMs !== 'number'
  ) {
    merged.focusSessionUntilEpochMs = null
  }
  merged.focusPresetMinutes = normalizeFocusPresetMinutes(merged.focusPresetMinutes)
  if (typeof merged.panelBackgroundEnabled !== 'boolean') {
    merged.panelBackgroundEnabled = defaultSettings.panelBackgroundEnabled
  }
  const overlay = Number(merged.panelBackgroundOverlayOpacity)
  merged.panelBackgroundOverlayOpacity =
    Number.isFinite(overlay) && overlay >= 0.3 && overlay <= 0.7
      ? overlay
      : defaultSettings.panelBackgroundOverlayOpacity
  const blur = Number(merged.panelBackgroundBlurPx)
  merged.panelBackgroundBlurPx =
    Number.isFinite(blur) && blur >= 0 && blur <= 12
      ? Math.floor(blur)
      : defaultSettings.panelBackgroundBlurPx
  const imgOp = Number(merged.panelBackgroundImageOpacity)
  merged.panelBackgroundImageOpacity =
    Number.isFinite(imgOp) && imgOp >= 0.2 && imgOp <= 1
      ? imgOp
      : defaultSettings.panelBackgroundImageOpacity

  const darkSource = merged.darkModeSource
  merged.darkModeSource =
    darkSource === 'system' || darkSource === 'schedule' || darkSource === 'manual'
      ? darkSource
      : defaultSettings.darkModeSource
  if (
    typeof merged.darkModeScheduleStart !== 'string' ||
    !/^\d{1,2}:\d{2}$/.test(merged.darkModeScheduleStart)
  ) {
    merged.darkModeScheduleStart = defaultSettings.darkModeScheduleStart
  }
  if (
    typeof merged.darkModeScheduleEnd !== 'string' ||
    !/^\d{1,2}:\d{2}$/.test(merged.darkModeScheduleEnd)
  ) {
    merged.darkModeScheduleEnd = defaultSettings.darkModeScheduleEnd
  }
  if (typeof merged.launchAtLogin !== 'boolean') {
    merged.launchAtLogin = defaultSettings.launchAtLogin
  }

  return merged
}

export async function saveSettings(settings: SidekickSettings): Promise<void> {
  await store.setItem(SETTINGS_KEY, settings)
}

/** `null`：从未记录（新安装或未迁移）；`true`：已完成首次引导。 */
export async function loadOnboardingComplete(): Promise<boolean | null> {
  const v = await store.getItem<string>(ONBOARDING_DONE_KEY)
  if (v === '1') return true
  return null
}

export async function saveOnboardingComplete(): Promise<void> {
  await store.setItem(ONBOARDING_DONE_KEY, '1')
}
