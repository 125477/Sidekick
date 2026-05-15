import localforage from 'localforage'
import type { SidekickSettings } from './settingsState'
import { defaultSettings } from './settingsState'

const SETTINGS_KEY = 'sidekick.settings.v1'
/** 与 SETTINGS 同库：首次引导完成后写入 `'1'`。 */
const ONBOARDING_DONE_KEY = 'sidekick.onboarding.done'

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'settings',
})

export async function loadSettings(): Promise<SidekickSettings> {
  const raw = await store.getItem<Partial<SidekickSettings>>(SETTINGS_KEY)
  if (!raw) return defaultSettings
  const merged = { ...defaultSettings, ...raw }
  merged.companionInterests = Array.isArray(raw.companionInterests)
    ? raw.companionInterests.filter((x) => typeof x === 'string')
    : []
  if (!merged.toastAlwaysVisible) {
    const n = Number(merged.dwellSeconds)
    merged.dwellSeconds = Math.max(
      60,
      Number.isFinite(n) && n > 0 ? n : defaultSettings.dwellSeconds,
    )
  }
  if (merged.companionTtsModel === 'cosyvoice-v3.5-flash') {
    merged.companionTtsModel = 'qwen3-tts-flash'
  }
  if (typeof merged.pushAutoSwitchAvatar !== 'boolean') {
    merged.pushAutoSwitchAvatar = defaultSettings.pushAutoSwitchAvatar
  }
  if (typeof merged.allowEmoji !== 'boolean') {
    merged.allowEmoji = defaultSettings.allowEmoji
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
