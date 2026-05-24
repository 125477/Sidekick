/** 避免启动瞬间「定时首句 + 昨日问候 + 换句」等多路并行打百炼。 */

const STARTUP_MERGE_MS = 45_000

let inFlight = false
let lastStartupSucceededAt = 0
let startupSlotHeld = false
let lastInteractiveStartMs = 0
/** 用户换句/情绪反馈进行中：禁止 startup / 昨日问候再发 completion。 */
let interactiveExclusive = false

const INTERACTIVE_DEBOUNCE_MS = 1500

export type CompanionFetchKind = 'startup' | 'interactive'

export function isInteractiveCompanionFetchActive(): boolean {
  return interactiveExclusive || inFlight
}

export function beginCompanionFetch(
  kind: CompanionFetchKind,
): { proceed: boolean; release: () => void } {
  const now = Date.now()
  if (kind === 'interactive') {
    if (
      inFlight ||
      now - lastInteractiveStartMs < INTERACTIVE_DEBOUNCE_MS
    ) {
      return { proceed: false, release: () => {} }
    }
    lastInteractiveStartMs = now
    inFlight = true
    interactiveExclusive = true
    return {
      proceed: true,
      release: () => {
        inFlight = false
        interactiveExclusive = false
      },
    }
  }

  if (interactiveExclusive || inFlight || startupSlotHeld) {
    return { proceed: false, release: () => {} }
  }
  if (
    lastStartupSucceededAt > 0 &&
    now - lastStartupSucceededAt < STARTUP_MERGE_MS
  ) {
    return { proceed: false, release: () => {} }
  }
  startupSlotHeld = true
  inFlight = true
  return {
    proceed: true,
    release: () => {
      inFlight = false
      startupSlotHeld = false
    },
  }
}

export function markCompanionStartupFetchSucceeded(): void {
  lastStartupSucceededAt = Date.now()
}

export function resetStartupFetchCoordinatorIfIdle(): void {
  if (inFlight) return
  lastStartupSucceededAt = 0
  startupSlotHeld = false
  interactiveExclusive = false
}

export function shouldSkipYesterdayGreetingAfterBootstrap(): boolean {
  if (lastStartupSucceededAt <= 0) return false
  return Date.now() - lastStartupSucceededAt < STARTUP_MERGE_MS
}
