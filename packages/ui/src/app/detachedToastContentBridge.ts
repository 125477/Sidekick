/** 独立气泡：主进程 soft-sync 文案（IPC 单通道）。 */

export type DetachedToastContentPayload = {
  message: string
  contentRevision?: number
  textId?: string
  favorite?: boolean
  autoTts?: boolean
}

type DetachedToastContentListener = (payload: DetachedToastContentPayload) => void

const listeners = new Set<DetachedToastContentListener>()

let lastAppliedContentRevision = -1

function emitDetachedToastContent(payload: DetachedToastContentPayload) {
  const rev = payload.contentRevision
  if (
    typeof rev === 'number' &&
    Number.isFinite(rev) &&
    rev <= lastAppliedContentRevision
  ) {
    return
  }
  if (typeof rev === 'number' && Number.isFinite(rev)) {
    lastAppliedContentRevision = rev
  }
  for (const listener of listeners) {
    listener(payload)
  }
}

let bridgeInstalled = false

/** 在 toast 窗首屏挂载前调用，避免 HMR 卸 listener 丢 soft-sync。 */
export function installDetachedToastContentBridge(): void {
  if (bridgeInstalled || typeof window === 'undefined') return
  bridgeInstalled = true

  window.sidekickDesktop?.onDetachedToastContentSync?.((payload) => {
    emitDetachedToastContent(payload)
  })
}

export function subscribeDetachedToastContent(
  listener: DetachedToastContentListener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
