/**
 * 主进程：DashScope 不可用 model 列表（持久化到 userData，重启后仍跳过）。
 * 与 @sidekick/core constants/dashscopeUnavailableModels 行为对齐。
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'dashscope-unavailable-models.json'

/** @type {Set<string>} */
const memoryUnavailable = new Set()
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
    if (!Array.isArray(parsed)) return
    for (const id of parsed) {
      const m = String(id ?? '').trim()
      if (m) memoryUnavailable.add(m)
    }
  } catch {
    /* 首次运行或文件损坏 */
  }
}

function saveToDisk() {
  try {
    const file = storagePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify([...memoryUnavailable]))
  } catch {
    /* ignore */
  }
}

export function getDashScopeUnavailableModels() {
  loadFromDisk()
  return [...memoryUnavailable]
}

export function isDashScopeModelMarkedUnavailable(modelId) {
  loadFromDisk()
  const id = String(modelId ?? '').trim()
  return id.length > 0 && memoryUnavailable.has(id)
}

export function markDashScopeModelUnavailable(modelId) {
  loadFromDisk()
  const id = String(modelId ?? '').trim()
  if (!id || memoryUnavailable.has(id)) return
  memoryUnavailable.add(id)
  saveToDisk()
}

export function clearDashScopeUnavailableModels() {
  if (memoryUnavailable.size === 0 && loaded) {
    try {
      fs.unlinkSync(storagePath())
    } catch {
      /* ignore */
    }
  }
  memoryUnavailable.clear()
  loaded = true
}

export function filterOutUnavailableDashScopeModels(modelIds) {
  loadFromDisk()
  return modelIds.filter((id) => !memoryUnavailable.has(id))
}

/**
 * 跳过已标记模型；若全部被跳过则本轮仍返回完整列表（不清磁盘缓存）。
 */
export function prepareDashScopeModelTryOrder(fullOrder) {
  loadFromDisk()
  if (fullOrder.length === 0) return fullOrder
  const active = filterOutUnavailableDashScopeModels(fullOrder)
  if (active.length === 0) return fullOrder
  return active
}
