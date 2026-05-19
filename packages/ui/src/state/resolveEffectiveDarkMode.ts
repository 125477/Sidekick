import { isWithinScheduledInterval } from '@sidekick/core'
import type { SidekickSettings } from './settingsState'

export type EffectiveDarkModeInput = Pick<
  SidekickSettings,
  | 'darkMode'
  | 'darkModeSource'
  | 'darkModeScheduleStart'
  | 'darkModeScheduleEnd'
>

export function resolveEffectiveDarkMode(
  settings: EffectiveDarkModeInput,
  opts: { prefersDark: boolean; now?: Date },
): boolean {
  switch (settings.darkModeSource) {
    case 'system':
      return opts.prefersDark
    case 'schedule':
      return isWithinScheduledInterval(
        opts.now ?? new Date(),
        settings.darkModeScheduleStart,
        settings.darkModeScheduleEnd,
      )
    case 'manual':
    default:
      return settings.darkMode
  }
}
