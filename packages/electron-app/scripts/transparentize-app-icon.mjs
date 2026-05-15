/**
 * 将 resources/icon.png 中与边缘连通的浅色背景设为透明（flood-fill，避免误伤星形主体）。
 * 运行：pnpm --filter @sidekick/electron-app exec node ./scripts/transparentize-app-icon.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconPath = path.join(__dirname, '..', 'resources', 'icon.png')

const { data, info } = await sharp(iconPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const w = info.width
const h = info.height
const pix = Buffer.from(data)

const pAt = (x, y) => ((y * w + x) | 0) * 4

const corners = [
  [0, 0],
  [w - 1, 0],
  [0, h - 1],
  [w - 1, h - 1],
]
let sumR = 0
let sumG = 0
let sumB = 0
for (const [cx, cy] of corners) {
  const p = pAt(cx, cy)
  sumR += pix[p]
  sumG += pix[p + 1]
  sumB += pix[p + 2]
}
const refR = Math.round(sumR / corners.length)
const refG = Math.round(sumG / corners.length)
const refB = Math.round(sumB / corners.length)

/** 与角落背景同色容差（含抗锯齿浅灰边） */
function matchBg(r, g, b) {
  return Math.abs(r - refR) + Math.abs(g - refG) + Math.abs(b - refB) < 55
}

const bg = new Uint8Array(w * h)
const q = []
let head = 0

function tryPush(x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return
  const i = y * w + x
  if (bg[i]) return
  const p = pAt(x, y)
  if (!matchBg(pix[p], pix[p + 1], pix[p + 2])) return
  bg[i] = 1
  q.push(i)
}

for (let x = 0; x < w; x++) {
  tryPush(x, 0)
  tryPush(x, h - 1)
}
for (let y = 0; y < h; y++) {
  tryPush(0, y)
  tryPush(w - 1, y)
}

while (head < q.length) {
  const i = q[head++]
  const x = i % w
  const y = (i / w) | 0
  const neigh = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ]
  for (const [nx, ny] of neigh) {
    tryPush(nx, ny)
  }
}

for (let i = 0; i < w * h; i++) {
  if (!bg[i]) continue
  const p = i * 4
  pix[p + 3] = 0
}

const outPath = iconPath + '.new.png'
await sharp(pix, { raw: { width: w, height: h, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outPath)

fs.renameSync(outPath, iconPath)
console.log('[transparentize-app-icon] wrote', iconPath, `${w}x${h}`)
console.log('[transparentize-app-icon] tip: run `pnpm icons:mac-icns` (in electron-app) then commit icon.icns for DMG / .app icons')
