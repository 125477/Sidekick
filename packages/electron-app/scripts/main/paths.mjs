import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** `scripts/preload.cjs`（本文件位于 `scripts/main/`）。 */
export const preloadPath = path.join(__dirname, '..', 'preload.cjs')

/** 与 `build.icon` 一致；开发态 Dock 等。 */
export const appIconPngPath = path.join(__dirname, '..', '..', 'resources', 'icon.png')

/** 与 `mac.icon` / `dmg.icon` 一致；存在时优先于 PNG（透明底更稳）。 */
export const appIconIcnsPath = path.join(__dirname, '..', '..', 'resources', 'icon.icns')

export const appDockIconPath = fs.existsSync(appIconIcnsPath) ? appIconIcnsPath : appIconPngPath
