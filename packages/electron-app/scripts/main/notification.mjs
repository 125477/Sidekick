import { Notification } from 'electron'
import { openPanelWindow } from './windows.mjs'

/**
 * @param {{ title: string; body: string; panel?: string; emotionTab?: string }} payload
 */
export function showSidekickSystemNotification(payload) {
  const title = String(payload?.title ?? '').trim() || 'Sidekick'
  const body = String(payload?.body ?? '').trim()
  if (!body) return false
  if (!Notification.isSupported()) return false

  const n = new Notification({ title, body })
  n.on('click', () => {
    const panel = payload?.panel === 'emotion' ? 'emotion' : 'emotion'
    const emotionTab =
      payload?.emotionTab === 'summary' ? 'summary' : 'summary'
    openPanelWindow(panel, { emotionTab })
  })
  n.show()
  return true
}
