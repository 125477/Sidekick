import { powerMonitor } from 'electron'
import { evaluateMoodReminderFromMain } from './moodReminderState.mjs'
import { state } from './state.mjs'

export function registerPowerMonitorResume() {
  const notify = () => {
    void evaluateMoodReminderFromMain()
    for (const win of [state.spriteWindow, state.panelWindow]) {
      if (!win || win.isDestroyed()) continue
      win.webContents.send('sidekick:system-resume')
      win.webContents.send('sidekick:mood-reminder-tick')
    }
  }
  powerMonitor.on('resume', notify)
  powerMonitor.on('unlock-screen', notify)
}
