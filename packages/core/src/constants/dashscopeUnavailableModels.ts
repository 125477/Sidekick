const STORAGE_KEY = 'sidekick:dashscope:unavailable-models'

const memoryUnavailable = new Set<string>()

function readStorageIds(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((id) => String(id).trim()).filter(Boolean)
  } catch {
    return []
  }
}

function writeStorageIds(ids: string[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* quota / private mode */
  }
}

function syncMemoryFromStorage(): void {
  for (const id of readStorageIds()) memoryUnavailable.add(id)
}

syncMemoryFromStorage()

export function getDashScopeUnavailableModels(): string[] {
  return [...memoryUnavailable]
}

export function isDashScopeModelMarkedUnavailable(modelId: string): boolean {
  const id = modelId.trim()
  return id.length > 0 && memoryUnavailable.has(id)
}

export function markDashScopeModelUnavailable(modelId: string): void {
  const id = modelId.trim()
  if (!id || memoryUnavailable.has(id)) return
  memoryUnavailable.add(id)
  writeStorageIds([...memoryUnavailable])
}

export function clearDashScopeUnavailableModels(): void {
  if (memoryUnavailable.size === 0) return
  memoryUnavailable.clear()
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function filterOutUnavailableDashScopeModels(
  modelIds: string[],
): string[] {
  return modelIds.filter((id) => !isDashScopeModelMarkedUnavailable(id))
}

/**
 * 跳过本地记录的无额度/不可用模型；若全部不可用则本轮不再重试（充值后请清不可用缓存）。
 */
export function prepareDashScopeModelTryOrder(fullOrder: string[]): string[] {
  if (fullOrder.length === 0) return fullOrder
  return filterOutUnavailableDashScopeModels(fullOrder)
}
