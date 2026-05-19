/** 独立气泡窗：悬停展开工具栏后通知主进程按 scrollHeight 同步窗高。 */
export const TOAST_LAYOUT_SYNC_EVENT = 'sidekick-toast-layout-sync'

export type ToastLayoutSyncDetail = {
  /** 在 DOM 仍收起时，临时按完全展开测量，用于一次性跳到目标窗高。 */
  measureExpanded?: boolean
}

export function requestToastLayoutSync(
  detail?: ToastLayoutSyncDetail,
): void {
  if (detail) {
    window.dispatchEvent(
      new CustomEvent<ToastLayoutSyncDetail>(TOAST_LAYOUT_SYNC_EVENT, {
        detail,
      }),
    )
    return
  }
  window.dispatchEvent(new Event(TOAST_LAYOUT_SYNC_EVENT))
}
