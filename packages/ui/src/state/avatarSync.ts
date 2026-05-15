/** Broadcast avatar persistence across BrowserWindows (same origin; IndexedDB does not emit storage events). */
const CHANNEL = 'sidekick-avatar-sync'

export function broadcastAvatarSync(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.postMessage({ type: 'reload' as const })
    bc.close()
  } catch {
    /* ignore */
  }
}

export function subscribeAvatarSync(handler: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  try {
    const bc = new BroadcastChannel(CHANNEL)
    bc.onmessage = () => handler()
    return () => bc.close()
  } catch {
    return () => {}
  }
}
