/** 换句 IPC / 连点：全进程只放行一次，避免双 listener 或连点打出两条相同 completion。 */

let regenerateInFlight = false
let lastRegenerateFinishedAt = 0
const REGENERATE_COOLDOWN_MS = 2500

export function shouldSkipRegenerateCopyRequest(): boolean {
  if (regenerateInFlight) return true
  return Date.now() - lastRegenerateFinishedAt < REGENERATE_COOLDOWN_MS
}

export function markRegenerateCopyStarted(): void {
  regenerateInFlight = true
}

export function markRegenerateCopyFinished(): void {
  regenerateInFlight = false
  lastRegenerateFinishedAt = Date.now()
}
