/**
 * @param {string} baseUrl
 * @param {string} mode
 * @param {Record<string, string | number | boolean | undefined>} [params]
 */
export function buildRoute(baseUrl, mode, params = {}) {
  const url = new URL('index.html', baseUrl)
  url.searchParams.set('mode', mode)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

/**
 * 独立气泡窗的 webContents 是否已是 `mode=toast` 的 committed URL。
 * @param {import('electron').WebContents | null | undefined} wc
 */
export function toastWebContentsUrlIsDetachedToastMode(wc) {
  if (!wc || wc.isDestroyed()) return false
  const raw = wc.getURL()
  if (!raw || raw === 'about:blank') return false
  try {
    const u = new URL(raw)
    if (u.searchParams.get('mode') === 'toast') return true
  } catch {
    // ignore
  }
  return /[?&]mode=toast(?:&|$)/.test(raw) || /[?&]mode%3Dtoast(?:&|%26|$)/i.test(raw)
}
