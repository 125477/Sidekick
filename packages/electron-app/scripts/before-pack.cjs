'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

/** @returns {Promise<void>} */
module.exports = async function beforePack() {
  const root = path.join(__dirname, '..')
  const icnsPath = path.join(root, 'resources', 'icon.icns')

  if (process.platform === 'darwin') {
    const script = path.join(__dirname, 'build-mac-icns.mjs')
    const r = spawnSync(process.execPath, [script], {
      stdio: 'inherit',
      cwd: root,
      env: process.env,
    })
    if (r.error) {
      throw r.error
    }
    if (r.status !== 0) {
      throw new Error(`build-mac-icns.mjs exited with ${r.status}`)
    }
    return
  }

  if (!fs.existsSync(icnsPath)) {
    throw new Error(
      '[before-pack] resources/icon.icns is missing. On macOS run: pnpm --filter @sidekick/electron-app exec node ./scripts/build-mac-icns.mjs then commit icon.icns',
    )
  }
  console.log('[before-pack] using existing resources/icon.icns (non-darwin)')
}
