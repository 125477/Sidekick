const KEY = 'sidekick.companionLightFeedbackHints.v1'
const MAX = 8

export function getCompanionLightFeedbackHints(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
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

export function appendCompanionLightFeedbackHint(line: string): void {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return
  const next = [...getCompanionLightFeedbackHints(), t].slice(-MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
