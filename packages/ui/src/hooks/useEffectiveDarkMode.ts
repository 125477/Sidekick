import { useEffect, useMemo, useState } from 'react'
import type { SidekickSettings } from '../state/settingsState'
import { resolveEffectiveDarkMode } from '../state/resolveEffectiveDarkMode'

export function useEffectiveDarkMode(settings: SidekickSettings): boolean {
  const [prefersDark, setPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [scheduleTick, setScheduleTick] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setPrefersDark(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (settings.darkModeSource !== 'schedule') return
    const id = window.setInterval(() => setScheduleTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [
    settings.darkModeSource,
    settings.darkModeScheduleStart,
    settings.darkModeScheduleEnd,
  ])

  return useMemo(
    () =>
      resolveEffectiveDarkMode(settings, {
        prefersDark,
        now: new Date(),
      }),
    [
      settings.darkMode,
      settings.darkModeSource,
      settings.darkModeScheduleStart,
      settings.darkModeScheduleEnd,
      prefersDark,
      scheduleTick,
    ],
  )
}
