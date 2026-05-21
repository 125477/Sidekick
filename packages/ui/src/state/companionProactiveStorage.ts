import { localDayKey } from './moodJournalStorage'

const KEY = 'sidekick.companionProactive.day.v1'

export type CompanionProactiveDayState = {
  dayKey: string
  unlock: boolean
  focusEnd: number
  interestDeepen: number
  streakNudge: boolean
}

const EMPTY = (dayKey: string): CompanionProactiveDayState => ({
  dayKey,
  unlock: false,
  focusEnd: 0,
  interestDeepen: 0,
  streakNudge: false,
})

async function readState(): Promise<CompanionProactiveDayState> {
  const today = localDayKey()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY(today)
    const parsed = JSON.parse(raw) as CompanionProactiveDayState
    if (parsed.dayKey !== today) return EMPTY(today)
    return {
      dayKey: today,
      unlock: Boolean(parsed.unlock),
      focusEnd: Math.max(0, Number(parsed.focusEnd) || 0),
      interestDeepen: Math.max(0, Number(parsed.interestDeepen) || 0),
      streakNudge: Boolean(parsed.streakNudge),
    }
  } catch {
    return EMPTY(today)
  }
}

async function writeState(state: CompanionProactiveDayState): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export async function canFireUnlockRitual(): Promise<boolean> {
  const s = await readState()
  return !s.unlock
}

export async function markUnlockRitualFired(): Promise<void> {
  const s = await readState()
  await writeState({ ...s, unlock: true })
}

export async function canFireFocusEndRitual(): Promise<boolean> {
  const s = await readState()
  return s.focusEnd < 3
}

export async function markFocusEndRitualFired(): Promise<void> {
  const s = await readState()
  await writeState({ ...s, focusEnd: s.focusEnd + 1 })
}

export async function canFireInterestDeepen(): Promise<boolean> {
  const s = await readState()
  return s.interestDeepen < 2
}

export async function markInterestDeepenFired(): Promise<void> {
  const s = await readState()
  await writeState({ ...s, interestDeepen: s.interestDeepen + 1 })
}

export async function canFireStreakNudge(): Promise<boolean> {
  const s = await readState()
  return !s.streakNudge
}

export async function markStreakNudgeFired(): Promise<void> {
  const s = await readState()
  await writeState({ ...s, streakNudge: true })
}
