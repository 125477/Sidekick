/** 浏览器 / 渲染进程：DashScope /v1/models 列表持久化（localStorage）。 */

const STORAGE_KEY = 'sidekick:dashscope:model-list-cache'

type ModelListCache = {
  ids: string[]
  fetchedAt: number
}

let memoryCache: ModelListCache | null = null

function readFromStorage(): ModelListCache | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as ModelListCache).ids)
    ) {
      return null
    }
    const ids = (parsed as ModelListCache).ids
      .map((id) => String(id).trim())
      .filter(Boolean)
    if (ids.length === 0) return null
    const fetchedAt = (parsed as ModelListCache).fetchedAt
    return {
      ids,
      fetchedAt:
        typeof fetchedAt === 'number' && Number.isFinite(fetchedAt)
          ? fetchedAt
          : 0,
    }
  } catch {
    return null
  }
}

function writeToStorage(cache: ModelListCache): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* quota / private mode */
  }
}

function ensureLoaded(): void {
  if (memoryCache !== null) return
  memoryCache = readFromStorage()
}

export function getCachedDashScopeModelList(): string[] | null {
  ensureLoaded()
  return memoryCache?.ids ?? null
}

export function saveDashScopeModelListCache(ids: string[]): void {
  const normalized = ids.map((id) => id.trim()).filter(Boolean)
  if (normalized.length === 0) return
  memoryCache = { ids: normalized, fetchedAt: Date.now() }
  writeToStorage(memoryCache)
}

export function clearDashScopeModelListCache(): void {
  memoryCache = null
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
