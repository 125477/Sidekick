'use strict'

const { spawnSync } = require('node:child_process')
const path = require('node:path')

/** @returns {Promise<void>} */
module.exports = async function afterAllArtifactBuild() {
  const script = path.join(__dirname, 'apply-dmg-file-icon.mjs')
  const r = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  })
  if (r.error) {
    throw r.error
  }
  if (r.status !== 0) {
    throw new Error(`apply-dmg-file-icon.mjs exited with ${r.status}`)
  }

  const syncYml = path.join(__dirname, 'sync-latest-mac-yml.mjs')
  const y = spawnSync(process.execPath, [syncYml], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: process.env,
  })
  if (y.error) throw y.error
  if (y.status !== 0) {
    throw new Error(`sync-latest-mac-yml.mjs exited with ${y.status}`)
  }
}
