/** 上次成功的 DashScope chat model（持久化，下次优先使用）。 */

const STORAGE_KEY = 'sidekick:dashscope:preferred-model'

let memoryPreferred: string | null = null
let loaded = false

function readFromStorage(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const id = raw?.trim()
    return id || null
  } catch {
    return null
  }
}

function writeToStorage(modelId: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, modelId)
  } catch {
    /* quota / private mode */
  }
}

function ensureLoaded(): void {
  if (loaded) return
  loaded = true
  memoryPreferred = readFromStorage()
}

export function getDashScopePreferredModel(): string | null {
  ensureLoaded()
  return memoryPreferred
}

export function saveDashScopePreferredModel(modelId: string): void {
  const id = modelId.trim()
  if (!id) return
  memoryPreferred = id
  loaded = true
  writeToStorage(id)
}

export function clearDashScopePreferredModel(): void {
  memoryPreferred = null
  loaded = true
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
