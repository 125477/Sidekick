import { app, Notification } from 'electron'
import { openPanelWindow } from './windows.mjs'

const MAC_UNSIGNED_NOTIFY_TIMEOUT_MS = 800
const DEFAULT_NOTIFY_TIMEOUT_MS = 3000

/**
 * @param {{ title: string; body: string; panel?: string; emotionTab?: string }} payload
 * @returns {Promise<boolean>}
 */
export function showSidekickSystemNotification(payload) {
  const title = String(payload?.title ?? '').trim() || 'Sidekick'
  const body = String(payload?.body ?? '').trim()
  if (!body) return Promise.resolve(false)
  if (!Notification.isSupported()) return Promise.resolve(false)

  return new Promise((resolve) => {
    const n = new Notification({ title, body })
    let settled = false
    const finish = (ok) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    n.on('show', () => finish(true))
    n.on('failed', (_event, error) => {
      console.warn(
        '[sidekick] system notification failed:',
        error ?? 'unknown (macOS dev builds must be code-signed to deliver)',
      )
      finish(false)
    })
    n.on('click', () => {
      const panel = payload?.panel === 'emotion' ? 'emotion' : 'emotion'
      const emotionTab =
        payload?.emotionTab === 'summary' ? 'summary' : 'summary'
      openPanelWindow(panel, { emotionTab })
    })
    n.show()

    const timeoutMs =
      process.platform === 'darwin' && app.isPackaged
        ? MAC_UNSIGNED_NOTIFY_TIMEOUT_MS
        : DEFAULT_NOTIFY_TIMEOUT_MS

    setTimeout(() => {
      if (!settled) {
        console.warn(
          '[sidekick] system notification did not confirm delivery; use in-app toast fallback or enable notifications for 灵伴 in System Settings (unsigned macOS builds may not appear in Notification Center)',
        )
        finish(false)
      }
    }, timeoutMs)
  })
}
