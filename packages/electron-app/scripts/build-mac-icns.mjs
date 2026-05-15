/**
 * 从透明 PNG 生成 macOS `icon.icns`（供 `mac.icon` / `dmg.icon`），避免 electron-builder
 * 内置 PNG→icns 时把透明底压成白底。
 * 仅 darwin 可用（需 `iconutil`）。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pngPath = path.join(root, 'resources', 'icon.png')
const iconsetDir = path.join(root, 'resources', 'icon.iconset')
const icnsPath = path.join(root, 'resources', 'icon.icns')

/** Apple iconset 规范文件名 → 边长（px） */
const SIZES = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[build-mac-icns] skip (not darwin)')
    return
  }
  if (!fs.existsSync(pngPath)) {
    console.error('[build-mac-icns] missing', pngPath)
    process.exit(1)
  }

  fs.rmSync(iconsetDir, { recursive: true, force: true })
  fs.mkdirSync(iconsetDir, { recursive: true })

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

  for (const [filename, size] of SIZES) {
    await sharp(pngPath)
      .ensureAlpha()
      .resize(size, size, { fit: 'contain', position: 'centre', background: transparent })
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconsetDir, filename))
  }

  fs.rmSync(icnsPath, { force: true })
  execFileSync('iconutil', ['-c', 'icns', iconsetDir], { stdio: 'inherit', cwd: path.join(root, 'resources') })
  fs.rmSync(iconsetDir, { recursive: true, force: true })

  if (!fs.existsSync(icnsPath)) {
    console.error('[build-mac-icns] iconutil did not produce', icnsPath)
    process.exit(1)
  }
  console.log('[build-mac-icns] wrote', icnsPath)
}

await main()
