/**
 * `loadURL` resolve 后偶发仍有一帧旧内容；show 前等到导航结束并多让出一拍微任务。
 * @param {import('electron').WebContents | null | undefined} wc
 */
export function awaitWebContentsNavigationSettled(wc) {
  if (!wc || wc.isDestroyed()) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      wc.removeListener('did-finish-load', onDone)
      wc.removeListener('did-fail-load', onDone)
      setImmediate(() => {
        resolve()
      })
    }
    const onDone = () => done()
    if (!wc.isLoading()) {
      done()
      return
    }
    wc.once('did-finish-load', onDone)
    wc.once('did-fail-load', onDone)
  })
}
