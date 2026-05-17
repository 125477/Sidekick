const CHANNEL = 'sidekick-panel-background-sync'

export function broadcastPanelBackgroundSync(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage({ type: 'reload' as const })
    bc.close()
  } catch {
    /* ignore */
  }
}

export function subscribePanelBackgroundSync(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = () => handler()
    return () => bc.close()
  } catch {
    return () => {}
  }
}
