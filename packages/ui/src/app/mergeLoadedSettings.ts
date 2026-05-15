import type { SidekickData } from '@sidekick/core'
import { defaultSettings, type SidekickSettings } from '../state/settingsState'

export function mergeLoadedSettings(
  saved: SidekickSettings,
  data: SidekickData,
): SidekickSettings {
  return {
    ...defaultSettings,
    ...saved,
    avatarSize:
      saved.avatarSize ?? data.avatar.size ?? defaultSettings.avatarSize,
    avatarOpacity:
      saved.avatarOpacity ??
      data.avatar.opacity ??
      defaultSettings.avatarOpacity,
  }
}
