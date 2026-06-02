import { app, globalShortcut } from 'electron'
import { state } from './state.mjs'
import { openPanelWindow } from './windows.mjs'

function sendToSprite(action) {
  const win = state.spriteWindow
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send('sidekick:global-shortcut', { action })
  } catch {
    /* noop */
  }
}

export function registerGlobalShortcuts() {
  const accelRegenerate = 'CommandOrControl+Shift+R'
  const accelEmotion = 'CommandOrControl+Shift+E'
  const accelExport = 'CommandOrControl+Shift+C'

  try {
    globalShortcut.register(accelRegenerate, () => {
      sendToSprite('regenerate')
    })
  } catch (e) {
    console.warn('[sidekick] global shortcut register failed', accelRegenerate, e)
  }

  try {
    globalShortcut.register(accelEmotion, () => {
      openPanelWindow('emotion', { emotionTab: 'summary' })
    })
  } catch (e) {
    console.warn('[sidekick] global shortcut register failed', accelEmotion, e)
  }

  try {
    globalShortcut.register(accelExport, () => {
      sendToSprite('export-card')
    })
  } catch (e) {
    console.warn('[sidekick] global shortcut register failed', accelExport, e)
  }
}

export function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll()
}

app.on('will-quit', () => {
  unregisterGlobalShortcuts()
})
