/**
 * `loadURL` resolve 后偶发仍有一帧旧内容；show 前等到导航结束并多让出一拍微任务。
 * @param {import('electron').WebContents | null | undefined} wc
 * @param {{ timeoutMs?: number }} [opts]
 */
export function awaitWebContentsNavigationSettled(wc, opts = {}) {
  if (!wc || wc.isDestroyed()) return Promise.resolve()
  const timeoutMs = opts.timeoutMs
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      wc.removeListener('did-finish-load', onDone)
      wc.removeListener('did-fail-load', onDone)
      if (timeoutId != null) clearTimeout(timeoutId)
      setImmediate(() => {
        resolve()
      })
    }
    const onDone = () => done()
    let timeoutId = null
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[sidekick] webContents 导航等待超时 ${timeoutMs}ms，继续后续步骤`,
          )
        }
        done()
      }, timeoutMs)
    }
    if (!wc.isLoading()) {
      done()
      return
    }
    wc.once('did-finish-load', onDone)
    wc.once('did-fail-load', onDone)
  })
}
