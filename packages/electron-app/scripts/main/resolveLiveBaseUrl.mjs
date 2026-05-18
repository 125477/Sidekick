import { app } from 'electron'
import { DEV_SERVER_URL_CANDIDATES } from './constants.mjs'
import { state } from './state.mjs'

/**
 * dev 下优先从已加载的 renderer URL 推断 Vite 端口，避免 Electron 启动早于 dev server 时 baseUrl 错位。
 */
export function resolveLiveBaseUrl() {
  if (app.isPackaged) return state.baseUrl

  for (const win of [
    state.panelWindow,
    state.spriteWindow,
    state.cornerNotificationWindow,
  ]) {
    if (!win || win.isDestroyed()) continue
    try {
      const raw = win.webContents.getURL()
      if (!raw || raw === 'about:blank') continue
      const u = new URL(raw)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        return `${u.origin}/`
      }
    } catch {
      /* ignore */
    }
  }

  if (state.baseUrl) return state.baseUrl
  return `${DEV_SERVER_URL_CANDIDATES[0]}/`
}

/** @returns {string[]} */
export function devBaseUrlCandidates() {
  const ordered = [resolveLiveBaseUrl(), state.baseUrl, ...DEV_SERVER_URL_CANDIDATES]
  const out = []
  for (const base of ordered) {
    if (!base) continue
    const normalized = base.endsWith('/') ? base : `${base}/`
    if (!out.includes(normalized)) out.push(normalized)
  }
  return out
}
