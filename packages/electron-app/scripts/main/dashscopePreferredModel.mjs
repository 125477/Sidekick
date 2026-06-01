/**
 * 主进程：上次成功的 DashScope chat model（userData 持久化，下次优先使用）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'dashscope-preferred-model.json'

/** @type {string | null} */
let memoryPreferred = null
let loaded = false

function storagePath() {
  return path.join(app.getPath('userData'), FILE_NAME)
}

function loadFromDisk() {
  if (loaded) return
  loaded = true
  try {
    const raw = fs.readFileSync(storagePath(), 'utf8')
    const parsed = JSON.parse(raw)
    const id = String(parsed?.modelId ?? parsed ?? '').trim()
    if (id) memoryPreferred = id
  } catch {
    /* 首次运行或文件损坏 */
  }
}

function saveToDisk(modelId) {
  try {
    const file = storagePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ modelId }))
  } catch {
    /* ignore */
  }
}

export function getDashScopePreferredModel() {
  loadFromDisk()
  return memoryPreferred
}

export function saveDashScopePreferredModel(modelId) {
  const id = String(modelId ?? '').trim()
  if (!id) return
  memoryPreferred = id
  loaded = true
  saveToDisk(id)
}

export function clearDashScopePreferredModel() {
  memoryPreferred = null
  loaded = true
  try {
    fs.unlinkSync(storagePath())
  } catch {
    /* ignore */
  }
}
