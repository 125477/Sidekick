/**
 * 将 latest-mac.yml 的 path / url 与 release/ 内实际产物对齐。
 * electron-builder 的 yml 可能仍用 package `name`，与 `Lingban-…-mac.zip` 产物不一致；
 * 故 pack:mac 末尾会调用本脚本，按 release/ 内实际 zip/dmg 文件名写 path / url。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const releaseDir = path.join(__dirname, '..', 'release')
const ymlPath = path.join(releaseDir, 'latest-mac.yml')

if (!fs.existsSync(ymlPath)) {
  process.exit(0)
}

function newestMacArtifact(matcher) {
  return fs
    .readdirSync(releaseDir)
    .filter(matcher)
    .sort(
      (a, b) =>
        fs.statSync(path.join(releaseDir, b)).mtimeMs -
        fs.statSync(path.join(releaseDir, a)).mtimeMs,
    )[0]
}

const zipName = newestMacArtifact(
  (f) => f.endsWith('.zip') && !f.includes('win'),
)
const dmgName = newestMacArtifact(
  (f) => f.endsWith('.dmg') && !f.includes('blockmap'),
)

if (!zipName) {
  console.warn('[sync-latest-mac-yml] no mac .zip in release/, skip')
  process.exit(0)
}

let yml = fs.readFileSync(ymlPath, 'utf8')
const pathLine = `path: ${zipName}`

yml = yml.replace(/^path:.*$/m, pathLine)
yml = yml.replace(/^(\s+- url: ).+\.zip['"]?\s*$/m, `$1${zipName}`)
if (dmgName) {
  yml = yml.replace(/^(\s+- url: ).+\.dmg['"]?\s*$/m, `$1${dmgName}`)
}

fs.writeFileSync(ymlPath, yml)
console.log(`[sync-latest-mac-yml] path → ${zipName}${dmgName ? `, dmg → ${dmgName}` : ''}`)
