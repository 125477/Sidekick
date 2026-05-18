export type LightFeedbackKind = 'like' | 'neutral' | 'less'

const HINTS_KEY = 'sidekick.companionLightFeedbackHints.v1'
const BY_MESSAGE_KEY = 'sidekick.companionLightFeedbackByMessage.v1'
const MAX = 8

export type StoredLightFeedback = {
  kind: LightFeedbackKind
  hint: string
}

function normalizeMessageKey(message: string): string {
  return message.replace(/\s+/g, ' ').trim()
}

function readByMessage(): Record<string, StoredLightFeedback> {
  try {
    const raw = localStorage.getItem(BY_MESSAGE_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object') return {}
    const out: Record<string, StoredLightFeedback> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (
        typeof k !== 'string' ||
        !v ||
        typeof v !== 'object' ||
        typeof (v as StoredLightFeedback).hint !== 'string' ||
        !isLightFeedbackKind((v as StoredLightFeedback).kind)
      ) {
        continue
      }
      const hint = (v as StoredLightFeedback).hint.replace(/\s+/g, ' ').trim()
      if (!hint) continue
      out[k] = { kind: (v as StoredLightFeedback).kind, hint }
    }
    return out
  } catch {
    return {}
  }
}

function writeByMessage(map: Record<string, StoredLightFeedback>): void {
  localStorage.setItem(BY_MESSAGE_KEY, JSON.stringify(map))
}

function isLightFeedbackKind(v: unknown): v is LightFeedbackKind {
  return v === 'like' || v === 'neutral' || v === 'less'
}

function writeHints(hints: string[]): void {
  localStorage.setItem(HINTS_KEY, JSON.stringify(hints.slice(-MAX)))
}

export function getCompanionLightFeedbackHints(): string[] {
  try {
    const raw = localStorage.getItem(HINTS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(-MAX)
  } catch {
    return []
  }
}

export function getLightFeedbackForMessage(
  message: string,
): StoredLightFeedback | null {
  const key = normalizeMessageKey(message)
  if (!key) return null
  return readByMessage()[key] ?? null
}

export function setLightFeedbackForMessage(
  message: string,
  kind: LightFeedbackKind,
  hintLine: string,
): void {
  const key = normalizeMessageKey(message)
  const hint = hintLine.replace(/\s+/g, ' ').trim()
  if (!key || !hint) return

  const byMessage = readByMessage()
  const prev = byMessage[key]
  let hints = getCompanionLightFeedbackHints()
  if (prev?.hint) {
    hints = hints.filter((h) => h !== prev.hint)
  }
  hints = [...hints, hint].slice(-MAX)
  writeHints(hints)
  writeByMessage({ ...byMessage, [key]: { kind, hint } })
}

export function clearLightFeedbackForMessage(message: string): void {
  const key = normalizeMessageKey(message)
  if (!key) return
  const byMessage = readByMessage()
  const prev = byMessage[key]
  if (!prev) return
  const { [key]: _removed, ...rest } = byMessage
  writeByMessage(rest)
  writeHints(getCompanionLightFeedbackHints().filter((h) => h !== prev.hint))
}

/** @deprecated 请用 `setLightFeedbackForMessage`。 */
export function appendCompanionLightFeedbackHint(line: string): void {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return
  writeHints([...getCompanionLightFeedbackHints(), t])
}
