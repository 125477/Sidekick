import { powerMonitor } from 'electron'
import { state } from './state.mjs'

export function registerPowerMonitorResume() {
  const notify = () => {
    const win = state.spriteWindow
    if (!win || win.isDestroyed()) return
    win.webContents.send('sidekick:system-resume')
  }
  powerMonitor.on('resume', notify)
  powerMonitor.on('unlock-screen', notify)
}
