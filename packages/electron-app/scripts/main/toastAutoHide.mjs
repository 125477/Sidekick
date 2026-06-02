import { state } from './state.mjs'
import { stopToastPassthroughHitTest } from './toastPassthrough.mjs'
import { finishDockPushReveal } from './widgetEdgeDock.mjs'

function hideToastWindowNow() {
  if (state.toastWindow && !state.toastWindow.isDestroyed()) {
    stopToastPassthroughHitTest()
    state.toastWindow.hide()
  }
  state.toastTimerId = null
  void finishDockPushReveal()
}

/** 清除主进程气泡自动隐藏计时（不隐藏窗口）。锁定期间保留截止时刻，解锁后按剩余时间继续。 */
export function pauseToastAutoHide() {
  if (state.toastTimerId) {
    clearTimeout(state.toastTimerId)
    state.toastTimerId = null
  }
}

export function clearToastAutoHideSchedule() {
  pauseToastAutoHide()
  state.toastAutoHideAtMs = null
}

function armToastAutoHideTimer() {
  pauseToastAutoHide()
  if (state.lastSpriteInteractionLocked) return
  const at = state.toastAutoHideAtMs
  if (at == null || !Number.isFinite(at)) return
  const remaining = at - Date.now()
  if (remaining <= 0) {
    hideToastWindowNow()
    state.toastAutoHideAtMs = null
    return
  }
  state.toastTimerId = setTimeout(() => {
    hideToastWindowNow()
    state.toastAutoHideAtMs = null
  }, remaining)
}

/**
 * 独立气泡自动隐藏。`dwellSeconds <= 0` 表示一直显示直至手动关闭。
 * 新推送/换句会重置截止时刻；锁定仅暂停计时，不阻止换句与推送上屏。
 * @param {{ resetDwell?: boolean }} [opts] 换句/新句须 `resetDwell: true` 以重置完整停留。
 */
export function scheduleToastAutoHide(dwellSeconds, opts) {
  const dwell = Number(dwellSeconds)
  if (!Number.isFinite(dwell) || dwell <= 0) {
    clearToastAutoHideSchedule()
    return
  }
  const nextAt = Date.now() + dwell * 1000
  const resetDwell = opts?.resetDwell === true
  if (
    !resetDwell &&
    state.lastSpriteInteractionLocked &&
    state.toastAutoHideAtMs != null
  ) {
    state.toastAutoHideAtMs = Math.min(state.toastAutoHideAtMs, nextAt)
    return
  }
  state.toastAutoHideAtMs = nextAt
  armToastAutoHideTimer()
}

/** 解锁后按剩余停留时间继续；若无截止时刻则沿用上条会话时长。 */
export function resumeToastAutoHide() {
  if (state.toastAutoHideAtMs == null) {
    const session = state.lastToastSession
    if (session?.dwellSeconds > 0) {
      scheduleToastAutoHide(session.dwellSeconds)
      return
    }
  }
  armToastAutoHideTimer()
}

/** showToast 载荷未带停留秒数时：会话 → 主进程已同步的设置 → 不自动隐藏。 */
export function resolveToastDwellSeconds(payload) {
  const raw = payload?.dwellSeconds
  if (raw != null && Number.isFinite(Number(raw))) {
    return Number(raw)
  }
  const prev = state.lastToastSession?.dwellSeconds
  if (prev != null && Number.isFinite(Number(prev)) && Number(prev) > 0) {
    return Number(prev)
  }
  if (state.toastAlwaysVisiblePref === true) return 0
  const fromSettings = state.toastDisplayDwellSeconds
  if (Number.isFinite(fromSettings) && fromSettings > 0) {
    return fromSettings
  }
  return 0
}
