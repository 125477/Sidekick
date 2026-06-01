/**
 * 主进程：DashScope /v1/models 列表持久化（userData），避免每次换句重复拉取。
 */

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

const FILE_NAME = 'dashscope-model-list-cache.json'

/** @type {{ ids: string[]; fetchedAt: number } | null} */
let memoryCache = null
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
    if (!Array.isArray(parsed?.ids) || parsed.ids.length === 0) return
    const ids = parsed.ids
      .map((id) => String(id ?? '').trim())
      .filter(Boolean)
    if (ids.length === 0) return
    memoryCache = {
      ids,
      fetchedAt:
        typeof parsed.fetchedAt === 'number' && Number.isFinite(parsed.fetchedAt)
          ? parsed.fetchedAt
          : 0,
    }
  } catch {
    /* 首次运行或文件损坏 */
  }
}

function saveToDisk() {
  if (!memoryCache?.ids?.length) return
  try {
    const file = storagePath()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(memoryCache))
  } catch {
    /* ignore */
  }
}

export function getCachedDashScopeModelList() {
  loadFromDisk()
  return memoryCache?.ids ?? null
}

export function saveDashScopeModelListCache(ids) {
  const normalized = ids
    .map((id) => String(id ?? '').trim())
    .filter(Boolean)
  if (normalized.length === 0) return
  memoryCache = { ids: normalized, fetchedAt: Date.now() }
  loaded = true
  saveToDisk()
}

export function clearDashScopeModelListCache() {
  memoryCache = null
  loaded = true
  try {
    fs.unlinkSync(storagePath())
  } catch {
    /* ignore */
  }
}
