import { TOAST_WINDOW_WIDTH, TOAST_WINDOW_HEIGHT } from './constants.mjs'
import { buildRoute, toastWebContentsUrlIsDetachedToastMode } from './route.mjs'
import { state } from './state.mjs'
import { stopToastPassthroughHitTest } from './toastPassthrough.mjs'
import { computeToastPlacement } from './toastPlacement.mjs'
import { awaitWebContentsNavigationSettled } from './navigationWait.mjs'

/**
 * 仅更新气泡窗屏幕位置。若因靠近工作区边缘导致 `effectiveAnchor` 与上次不同，
 * 需同步到独立气泡渲染进程（否则拖挂件后尾巴仍按旧上下方向画）。
 */
export function applyToastWindowBounds() {
  if (!state.toastWindow || state.toastWindow.isDestroyed()) return
  const toastH = state.toastWindow.getBounds().height || TOAST_WINDOW_HEIGHT
  const placement = computeToastPlacement(state.lastPreferredToastAnchor, toastH)
  if (!placement) return
  const { x, y, effectiveAnchor } = placement

  state.toastWindow.setBounds({
    x,
    y,
    width: TOAST_WINDOW_WIDTH,
    height: toastH,
  })

  const session = state.lastToastSession
  if (!session) return

  if (session.effectiveAnchor === effectiveAnchor) return

  state.lastToastSession = {
    ...session,
    effectiveAnchor,
  }
  state.lastToastTailDown = effectiveAnchor === 'top'

  const wc = state.toastWindow.webContents
  if (!toastWebContentsUrlIsDetachedToastMode(wc)) return

  if (state.toastWindow.isVisible()) {
    stopToastPassthroughHitTest()
  }
  wc.send('sidekick:detached-toast-placement', {
    anchor: effectiveAnchor,
    placement: effectiveAnchor === 'top' ? 'above' : 'below',
  })
}

/**
 * 任意渲染进程改「气泡上下」后：主进程用已有 `lastToastSession` 重算边界并同步到独立气泡窗。
 */
export async function refreshDetachedToastAfterAnchorPreferenceChange() {
  if (!state.toastWindow || state.toastWindow.isDestroyed()) return
  if (!state.lastToastSession) return
  const toastH = state.toastWindow.getBounds().height || TOAST_WINDOW_HEIGHT
  const placement = computeToastPlacement(state.lastPreferredToastAnchor, toastH)
  if (!placement) return
  const { message, textId, favorite, dwellSeconds } = state.lastToastSession
  const effectiveAnchor = placement.effectiveAnchor
  state.lastToastSession = {
    message,
    effectiveAnchor,
    dwellSeconds,
    textId,
    favorite,
  }
  state.lastToastTailDown = effectiveAnchor === 'top'

  if (state.toastTimerId) {
    clearTimeout(state.toastTimerId)
    state.toastTimerId = null
  }
  const wasVisible = state.toastWindow.isVisible()
  const wc = state.toastWindow.webContents
  const placementPayload = {
    anchor: effectiveAnchor,
    placement: effectiveAnchor === 'top' ? 'above' : 'below',
  }

  state.toastWindow.setBounds({
    x: placement.x,
    y: placement.y,
    width: TOAST_WINDOW_WIDTH,
    height: toastH,
  })

  const canSyncWithoutReload = toastWebContentsUrlIsDetachedToastMode(wc)
  if (canSyncWithoutReload) {
    if (wasVisible) {
      stopToastPassthroughHitTest()
    }
    if (!state.toastWindow.isDestroyed()) {
      wc.send('sidekick:detached-toast-placement', placementPayload)
    }
    if (wasVisible) {
      state.toastWindow.showInactive()
    }
  } else {
    if (wasVisible) {
      stopToastPassthroughHitTest()
      state.toastWindow.hide()
      await new Promise((r) => {
        setTimeout(r, 16)
      })
    }

    await state.toastWindow.loadURL(
      buildRoute(state.baseUrl, 'toast', {
        message,
        ...(textId ? { textId } : {}),
        ...(typeof favorite === 'boolean' ? { favorite: favorite ? '1' : '0' } : {}),
        anchor: effectiveAnchor,
        placement: placementPayload.placement,
        tailDown: effectiveAnchor === 'top' ? '1' : '0',
        t: String(Date.now()),
      }),
    )
    await awaitWebContentsNavigationSettled(state.toastWindow.webContents)
    state.toastWindow.showInactive()
  }

  if (dwellSeconds > 0) {
    state.toastTimerId = setTimeout(() => {
      if (state.toastWindow && !state.toastWindow.isDestroyed()) {
        stopToastPassthroughHitTest()
        state.toastWindow.hide()
      }
      state.toastTimerId = null
    }, dwellSeconds * 1000)
  }
}

async function runDetachedToastAnchorRefreshLoop() {
  if (state.detachToastAnchorRefreshRunning) return
  state.detachToastAnchorRefreshRunning = true
  try {
    do {
      state.detachToastAnchorRefreshQueued = false
      await refreshDetachedToastAfterAnchorPreferenceChange()
    } while (state.detachToastAnchorRefreshQueued)
  } finally {
    state.detachToastAnchorRefreshRunning = false
  }
}

export function scheduleCoalescedDetachedToastAnchorRefresh() {
  if (state.detachToastAnchorRefreshRunning) {
    state.detachToastAnchorRefreshQueued = true
    return
  }
  void runDetachedToastAnchorRefreshLoop()
}
