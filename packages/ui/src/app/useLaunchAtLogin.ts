import { useEffect, useRef } from 'react'
import { subscribeSettingsSync } from '../state/settingsSync'
import type { SidekickSettings } from '../state/settingsState'

export function useLaunchAtLogin(
  settings: SidekickSettings,
  settingsReady: boolean,
  runsLaunchAtLoginSync: boolean,
): void {
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const applyRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!runsLaunchAtLoginSync) return
    if (!window.sidekickDesktop?.setLaunchAtLogin) return

    const apply = () => {
      if (!settingsReady) return
      window.sidekickDesktop?.setLaunchAtLogin?.(settingsRef.current.launchAtLogin)
    }

    applyRef.current = apply
    apply()

    return () => {
      applyRef.current = null
    }
  }, [runsLaunchAtLoginSync, settingsReady, settings.launchAtLogin])

  useEffect(() => {
    if (!runsLaunchAtLoginSync || !settingsReady) return
    return subscribeSettingsSync(() => {
      applyRef.current?.()
    })
  }, [runsLaunchAtLoginSync, settingsReady])
}
