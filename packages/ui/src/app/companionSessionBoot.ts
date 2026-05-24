/** 应用会话内仅允许一次「启动首句」生成，并在一段时间内压住其它 proactive 调用。 */

const SESSION_START_MS = Date.now()
/** 启动后这段时间内不跑兴趣深化 / 解锁问候等（避免与定时首句叠 3 次 completion）。 */
export const STARTUP_GRACE_MS = 120_000

let startupCopyClaimed = false

/** 定时推送 bootstrap 专用：全进程只放行一次。 */
export function tryClaimStartupCompanionCopy(): boolean {
  if (startupCopyClaimed) return false
  startupCopyClaimed = true
  return true
}

export function markStartupCompanionCopyFinished(): void {
  /* 启动首句已完成；保留钩子供 fetch 协调链路调用。 */
}

export function isInStartupGraceWindow(): boolean {
  return Date.now() - SESSION_START_MS < STARTUP_GRACE_MS
}

/** 启动后 2 分钟内不跑兴趣深化 / 解锁问候等（避免与定时首句叠多次 completion）。 */
export function shouldDeferExtraProactiveCopy(): boolean {
  return isInStartupGraceWindow()
}
