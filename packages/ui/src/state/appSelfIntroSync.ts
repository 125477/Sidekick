/** 多 BrowserWindow：自我介绍气泡关闭后通知精灵窗恢复定时推送。 */
const CHANNEL = 'sidekick-app-self-intro-dismissed'

export function broadcastAppSelfIntroDismissed(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage({ type: 'dismissed' as const })
    bc.close()
  } catch {
    /* ignore */
  }
}

export function subscribeAppSelfIntroDismissed(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = () => handler()
    return () => bc.close()
  } catch {
    return () => {}
  }
}
