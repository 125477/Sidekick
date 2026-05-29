/** 陪伴文案全链路日志（定时推送 / 换句 / 兜底）；终端搜 `[sidekick:companion-copy]`。 */

export type CompanionCopyLogPayload = Record<string, unknown>

function emitToMainProcess(payload: CompanionCopyLogPayload): void {
  if (typeof window === 'undefined') return
  const log = (
    window as Window & {
      sidekickDesktop?: { logCompanionCopyEvent?: (p: CompanionCopyLogPayload) => void }
    }
  ).sidekickDesktop?.logCompanionCopyEvent
  if (!log) return
  try {
    log(payload)
  } catch {
    /* ignore */
  }
}

export function logCompanionCopy(
  stage: string,
  payload?: CompanionCopyLogPayload,
): void {
  const body = { stage, ...(payload ?? {}) }
  emitToMainProcess(body)
  if (typeof console === 'undefined') return
  const line = `[sidekick:companion-copy] ${stage}`
  if (payload && Object.keys(payload).length > 0) {
    console.warn(line, payload)
  } else {
    console.warn(line)
  }
}
