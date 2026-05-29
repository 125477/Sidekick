/** 换句调试日志（开发期；终端 / DevTools 搜 `[sidekick:regenerate]`）。 */

export function isCompanionRegenerateDebugEnabled(): boolean {
  if (typeof import.meta !== 'undefined') {
    const env = import.meta as ImportMeta & { env?: { DEV?: boolean } }
    if (env.env?.DEV === false) return false
  }
  return true
}

export function maskDashScopeApiKey(key: string | undefined): string {
  const k = key?.trim()
  if (!k) return '(no key)'
  if (k.length <= 8) return 'sk-***'
  return `sk-…${k.slice(-4)}`
}

export function logCompanionRegenerate(
  stage: string,
  payload?: Record<string, unknown>,
): void {
  if (!isCompanionRegenerateDebugEnabled()) return
  if (typeof console === 'undefined') return
  const line = `[sidekick:regenerate] ${stage}`
  if (payload && Object.keys(payload).length > 0) {
    console.warn(line, payload)
  } else {
    console.warn(line)
  }
}
