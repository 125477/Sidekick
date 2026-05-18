/** 当前进行中的陪伴文案请求 id；新请求发起时递增，旧请求完成时不应再用兜底句覆盖气泡。 */
let activeCompanionCopyFetchId = 0

export function startCompanionCopyRequest(): number {
  activeCompanionCopyFetchId += 1
  return activeCompanionCopyFetchId
}

export function isActiveCompanionCopyRequest(fetchId: number): boolean {
  return fetchId === activeCompanionCopyFetchId
}

/**
 * 是否应把本次结果写入气泡。
 * - 模型成功：**始终**展示（避免 API 已成功却被后发起的失败请求丢弃）
 * - 本地兜底：仅当仍是「当前」请求时展示，防止旧请求的兜底覆盖新结果
 */
export function shouldApplyCompanionCopyResult(
  fetchId: number,
  source: 'model' | 'fallback',
): boolean {
  if (source === 'model') return true
  return isActiveCompanionCopyRequest(fetchId)
}
