import fs from 'node:fs'

import { app, BrowserWindow, nativeImage } from 'electron'
import { APP_DISPLAY_NAME } from './main/constants.mjs'
import { createSpriteWindow, registerSidekickIpcHandlers } from './main/ipcHandlers.mjs'
import { registerDailyMoodReminderWatchdog } from './main/dailyMoodReminderWatchdog.mjs'
import { registerPowerMonitorResume } from './main/powerMonitor.mjs'
import { appDockIconPath } from './main/paths.mjs'
import { state } from './main/state.mjs'
import { persistWidgetBounds } from './main/widgetBounds.mjs'

registerSidekickIpcHandlers()

app.on('before-quit', () => {
  if (state.spriteWindow && !state.spriteWindow.isDestroyed()) {
    persistWidgetBounds(state.spriteWindow)
  }
})

app.whenReady().then(() => {
  app.setName(APP_DISPLAY_NAME)

  if (process.platform === 'darwin' && app.dock && fs.existsSync(appDockIconPath)) {
    app.dock.setIcon(nativeImage.createFromPath(appDockIconPath))
  }

  createSpriteWindow()
  registerPowerMonitorResume()
  registerDailyMoodReminderWatchdog()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSpriteWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
