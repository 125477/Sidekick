/**
 * Finder 里 `.dmg` 文件默认是系统「磁盘映像」白图标；electron-builder 的 `dmg.icon` 只管挂载卷。
 * 构建完成后用 AppKit `NSWorkspace.setIcon` 把 `resources/icon.icns`（或回退 `icon.png`）写到 DMG 文件图标（仅 macOS）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')
const icnsPath = path.join(root, 'resources', 'icon.icns')
const pngPath = path.join(root, 'resources', 'icon.png')
const iconPath = fs.existsSync(icnsPath) ? icnsPath : pngPath
const swiftPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'SetDmgFileIcon.swift')

function main() {
  if (process.platform !== 'darwin') {
    console.log('[apply-dmg-file-icon] skip (not darwin)')
    return
  }
  if (!fs.existsSync(iconPath)) {
    console.warn('[apply-dmg-file-icon] missing icon:', iconPath)
    return
  }
  if (!fs.existsSync(releaseDir)) {
    console.warn('[apply-dmg-file-icon] missing release dir:', releaseDir)
    return
  }
  const dmgs = fs.readdirSync(releaseDir).filter((f) => f.endsWith('.dmg'))
  if (dmgs.length === 0) {
    console.warn('[apply-dmg-file-icon] no .dmg in', releaseDir)
    return
  }
  for (const name of dmgs) {
    const dmgPath = path.join(releaseDir, name)
    try {
      execFileSync('swift', [swiftPath, iconPath, dmgPath], {
        stdio: 'inherit',
      })
      console.log('[apply-dmg-file-icon] ok', name)
    } catch (e) {
      console.warn('[apply-dmg-file-icon] failed', name, e)
    }
  }
}

main()
