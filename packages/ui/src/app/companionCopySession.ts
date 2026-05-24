/** 当前进行中的陪伴文案请求 id；新请求发起时递增，旧请求完成时不应再用兜底句覆盖气泡。 */
let activeCompanionCopyFetchId = 0

export function startCompanionCopyRequest(): number {
  activeCompanionCopyFetchId += 1
  return activeCompanionCopyFetchId
}

export function isActiveCompanionCopyRequest(fetchId: number): boolean {
  return fetchId === activeCompanionCopyFetchId
}

/** 仅最新一次换句/推送请求可更新气泡，避免旧 completion 覆盖新结果。 */
export function shouldApplyCompanionCopyResult(
  fetchId: number,
  _source: 'model' | 'fallback',
): boolean {
  return isActiveCompanionCopyRequest(fetchId)
}
