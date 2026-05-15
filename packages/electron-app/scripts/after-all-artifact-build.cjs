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
}
