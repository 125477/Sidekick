import { app } from 'electron'

/**
 * @param {boolean} enabled
 */
export function applyLaunchAtLogin(enabled) {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled === true,
      openAsHidden: false,
    })
  } catch (err) {
    console.warn('[sidekick] setLoginItemSettings failed', err)
  }
}
