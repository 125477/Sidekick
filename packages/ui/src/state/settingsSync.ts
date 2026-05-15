/** 多 BrowserWindow 间同步设置（IndexedDB 无 storage 事件；保存后广播以刷新其它窗体内存态）。 */
const CHANNEL = 'sidekick-settings-sync'

export function broadcastSettingsSync(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage({ type: 'reload' as const })
    bc.close()
  } catch {
    /* ignore */
  }
}

export function subscribeSettingsSync(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = () => handler()
    return () => bc.close()
  } catch {
    return () => {}
  }
}
