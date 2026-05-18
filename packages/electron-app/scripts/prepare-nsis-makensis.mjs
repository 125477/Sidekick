/**
 * electron-builder 自带的 makensis 为 x86，在 Apple Silicon 上会报 bad CPU type。
 * 若本机已 `brew install makensis`，则替换缓存中的二进制为 Homebrew 版。
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

if (process.platform !== 'darwin') {
  process.exit(0)
}

const cacheMakensis = path.join(
  os.homedir(),
  'Library/Caches/electron-builder/nsis/nsis-3.0.4.1/mac/makensis',
)

let brewMakensis = ''
try {
  brewMakensis = execFileSync('brew', ['--prefix', 'makensis'], {
    encoding: 'utf8',
  }).trim()
  brewMakensis = path.join(brewMakensis, 'bin/makensis')
} catch {
  console.warn(
    '[prepare-nsis-makensis] brew makensis not found; install with: brew install makensis',
  )
  process.exit(0)
}

if (!fs.existsSync(brewMakensis)) {
  console.warn('[prepare-nsis-makensis] missing', brewMakensis)
  process.exit(0)
}

const cacheDir = path.dirname(cacheMakensis)
fs.mkdirSync(cacheDir, { recursive: true })
const backup = `${cacheMakensis}.x86.bak`
if (fs.existsSync(cacheMakensis) && !fs.lstatSync(cacheMakensis).isSymbolicLink()) {
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(cacheMakensis, backup)
  }
}
fs.rmSync(cacheMakensis, { force: true })
fs.symlinkSync(brewMakensis, cacheMakensis)
console.log('[prepare-nsis-makensis] linked', cacheMakensis, '->', brewMakensis)
