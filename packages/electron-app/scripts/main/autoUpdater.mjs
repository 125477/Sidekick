import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 打包后读 CFBundleShortVersionString；开发态 `app.getVersion()` 会是 Electron 版本（如 38.x）。 */
function readAppVersion() {
  if (app.isPackaged) {
    return app.getVersion()
  }
  try {
    const pkgPath = path.join(__dirname, '..', '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** electron-updater 为 CJS；主进程 .mjs 用 require 加载，避免打包后 named import 报错。 */
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater')

/** 与 README / GitHub Releases 一致；`electron-builder` `publish` 亦使用此仓库。 */
export const GITHUB_UPDATE_OWNER = '125477'
export const GITHUB_UPDATE_REPO = 'Sidekick'

/** 启动后延迟检查，避免与首屏加载抢资源。 */
const AUTO_CHECK_DELAY_MS = 12_000

/** 本会话内用户点「忽略」的版本，不再弹下载确认。 */
let dismissedUpdateVersion = null

/** @type {AppUpdateSnapshot} */
let snapshot = {
  enabled: false,
  currentVersion: readAppVersion(),
  phase: 'idle',
}

/**
 * @typedef {'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'} AppUpdatePhase
 * @typedef {{
 *   enabled: boolean
 *   currentVersion: string
 *   phase: AppUpdatePhase
 *   version?: string
 *   percent?: number
 *   message?: string
 *   releaseNotes?: string
 * }} AppUpdateSnapshot
 */

function isAutoUpdateEnabled() {
  if (!app.isPackaged) return false
  if (process.env.SIDEKICK_DISABLE_AUTO_UPDATE === '1') return false
  return true
}

function stripHtmlForPlainText(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseReleaseNotes(info) {
  const raw =
    typeof info?.releaseNotes === 'string'
      ? info.releaseNotes
      : Array.isArray(info?.releaseNotes)
        ? info.releaseNotes.map((n) => n.note).filter(Boolean).join('\n')
        : ''
  return stripHtmlForPlainText(raw)
}

function patchSnapshot(patch) {
  snapshot = { ...snapshot, ...patch }
  broadcastAppUpdateStatus()
}

function broadcastAppUpdateStatus() {
  const payload = { ...snapshot }
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.webContents.send('sidekick:app-update-status', payload)
  }
}

async function promptDownloadConsent(info) {
  const version = info?.version ?? ''
  if (!version || dismissedUpdateVersion === version) {
    return
  }

  const notes = parseReleaseNotes(info)
  const detailParts = ['是否现在下载并安装？']
  if (notes) {
    detailParts.push('', notes.slice(0, 1200))
  }

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: '灵伴更新',
    message: `发现新版本 ${version}`,
    detail: detailParts.join('\n'),
    buttons: ['忽略', '下载'],
    defaultId: 1,
    cancelId: 0,
  })

  if (response === 0) {
    dismissedUpdateVersion = version
    patchSnapshot({ phase: 'idle', message: undefined })
    return
  }

  await startAppUpdateDownload()
}

async function promptInstallWhenReady(info) {
  const version = info?.version ?? snapshot.version ?? ''
  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: '灵伴更新',
    message: `新版本 ${version} 已下载完成`,
    detail: '是否立即重启并完成安装？',
    buttons: ['稍后', '立即重启'],
    defaultId: 1,
    cancelId: 0,
  })
  if (response === 1) {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
  }
}

export async function startAppUpdateDownload() {
  if (!isAutoUpdateEnabled()) {
    return getAppUpdateSnapshot()
  }
  if (snapshot.phase !== 'available' && snapshot.phase !== 'error') {
    return getAppUpdateSnapshot()
  }
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    patchSnapshot({
      phase: 'error',
      message: err?.message ?? String(err),
      percent: undefined,
    })
  }
  return getAppUpdateSnapshot()
}

function bindAutoUpdaterEvents() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  if (process.platform === 'darwin') {
    autoUpdater.verifyUpdateCodeSignature = false
  }

  autoUpdater.on('checking-for-update', () => {
    patchSnapshot({ phase: 'checking', message: undefined })
  })

  autoUpdater.on('update-available', (info) => {
    patchSnapshot({
      phase: 'available',
      version: info.version,
      message: undefined,
      percent: undefined,
      releaseNotes: parseReleaseNotes(info) || undefined,
    })
    void promptDownloadConsent(info)
  })

  autoUpdater.on('update-not-available', (info) => {
    patchSnapshot({
      phase: 'not-available',
      version: info?.version,
      message: undefined,
      percent: undefined,
    })
  })

  autoUpdater.on('error', (err) => {
    patchSnapshot({
      phase: 'error',
      message: err?.message ?? String(err),
      percent: undefined,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    patchSnapshot({
      phase: 'downloading',
      percent: progress.percent,
      message: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    patchSnapshot({
      phase: 'downloaded',
      version: info.version,
      percent: 100,
      message: undefined,
      releaseNotes: parseReleaseNotes(info) || snapshot.releaseNotes,
    })
    void promptInstallWhenReady(info)
  })
}

export function getAppUpdateSnapshot() {
  return { ...snapshot }
}

export async function checkForAppUpdate() {
  if (!isAutoUpdateEnabled()) {
    return getAppUpdateSnapshot()
  }
  dismissedUpdateVersion = null
  await autoUpdater.checkForUpdates()
  return getAppUpdateSnapshot()
}

export function quitAndInstallAppUpdate() {
  if (!isAutoUpdateEnabled() || snapshot.phase !== 'downloaded') {
    return false
  }
  autoUpdater.quitAndInstall(false, true)
  return true
}

export function registerAppUpdateIpcHandlers() {
  ipcMain.handle('sidekick:app-update-get-status', () => getAppUpdateSnapshot())

  ipcMain.handle('sidekick:app-update-check', async () => {
    if (!isAutoUpdateEnabled()) {
      return getAppUpdateSnapshot()
    }
    return checkForAppUpdate()
  })

  ipcMain.handle('sidekick:app-update-download', async () => startAppUpdateDownload())

  ipcMain.handle('sidekick:app-update-install', () => {
    return quitAndInstallAppUpdate()
  })
}

export function registerAutoUpdaterLifecycle() {
  snapshot = {
    enabled: isAutoUpdateEnabled(),
    currentVersion: readAppVersion(),
    phase: 'idle',
  }

  if (!snapshot.enabled) {
    return
  }

  bindAutoUpdaterEvents()

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err) => {
      patchSnapshot({
        phase: 'error',
        message: err?.message ?? String(err),
      })
    })
  }, AUTO_CHECK_DELAY_MS)
}
