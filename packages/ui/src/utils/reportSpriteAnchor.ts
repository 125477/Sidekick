/** Widget renderer → main: toast window tracks measured sprite screen bounds. */

let anchorRafId = 0

async function sendSpriteAnchor(
  el: HTMLElement,
  opts?: ReportSpriteAnchorOptions,
) {
  const desktop = window.sidekickDesktop
  if (!desktop?.setSpriteAnchor) return

  const rect = el.getBoundingClientRect()
  if (rect.width < 4 || rect.height < 4) return

  const pct = opts?.avatarSizePercent
  await desktop.setSpriteAnchor({
    centerX: window.screenX + rect.left + rect.width / 2,
    topY: window.screenY + rect.top,
    bottomY: window.screenY + rect.top + rect.height,
    ...(typeof pct === 'number' && Number.isFinite(pct) && pct > 0
      ? { avatarSizePercent: pct }
      : {}),
  })
}

export type ReportSpriteAnchorOptions = {
  /** 为 true 时立即上报并返回 Promise（打开气泡前须与主进程对齐）。默认合并到下一帧，减轻快速拖动时 IPC 压力。 */
  flush?: boolean
  /** 与设置「大小(%)」一致；主进程按比例拉开独立气泡与精灵间距。 */
  avatarSizePercent?: number
}

/**
 * `flush`：须 await 的场景（例如即将 `showToastWindow`）。
 * 默认：合并到每帧最多一次，快速拖动时主进程已用窗体位移同步气泡，此处只作细调。
 */
export function reportSpriteAnchorToMain(
  el: HTMLElement | null,
  opts?: ReportSpriteAnchorOptions,
): Promise<void> | void {
  const desktop = window.sidekickDesktop
  if (!desktop?.setSpriteAnchor || !el) return

  if (opts?.flush) {
    if (anchorRafId) {
      cancelAnimationFrame(anchorRafId)
      anchorRafId = 0
    }
    return sendSpriteAnchor(el, opts)
  }

  if (anchorRafId) cancelAnimationFrame(anchorRafId)
  anchorRafId = requestAnimationFrame(() => {
    anchorRafId = 0
    void sendSpriteAnchor(el, opts)
  })
}
