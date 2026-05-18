import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'moodJournal',
})

const ENTRIES_KEY = 'entries.v1'

export type MoodMediaAttachment = {
  id: string
  type: 'image' | 'video'
  mimeType: string
  /** IndexedDB 内持久化的 data URL */
  dataUrl: string
  name: string
}

export type MoodJournalEntry = {
  id: string
  /** 本地日历日 YYYY-MM-DD */
  dayKey: string
  /** 1–5，5 最好 */
  moodLevel: 1 | 2 | 3 | 4 | 5
  /** 用户点选的具体标签（与 moodLevel 并存，便于区分愉快/开心等） */
  moodLabel?: string
  note: string
  createdAt: string
  attachments?: MoodMediaAttachment[]
}

async function readAll(): Promise<MoodJournalEntry[]> {
  const raw = await store.getItem<unknown>(ENTRIES_KEY)
  if (!Array.isArray(raw)) return []
  return raw.filter(isMoodEntry).sort((a, b) => (a.dayKey < b.dayKey ? 1 : -1))
}

function isMoodEntry(x: unknown): x is MoodJournalEntry {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.dayKey === 'string' &&
    typeof o.moodLevel === 'number' &&
    o.moodLevel >= 1 &&
    o.moodLevel <= 5 &&
    typeof o.note === 'string' &&
    typeof o.createdAt === 'string' &&
    (o.moodLabel === undefined || typeof o.moodLabel === 'string') &&
    (o.attachments === undefined ||
      (Array.isArray(o.attachments) &&
        o.attachments.every((a) => isMoodAttachment(a))))
  )
}

function isMoodAttachment(x: unknown): x is MoodMediaAttachment {
  if (!x || typeof x !== 'object') return false
  const a = x as Record<string, unknown>
  return (
    typeof a.id === 'string' &&
    (a.type === 'image' || a.type === 'video') &&
    typeof a.mimeType === 'string' &&
    typeof a.dataUrl === 'string' &&
    typeof a.name === 'string'
  )
}

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function listMoodJournalEntries(): Promise<MoodJournalEntry[]> {
  return readAll()
}

export async function getMoodEntryForDay(
  dayKey: string,
): Promise<MoodJournalEntry | null> {
  const all = await readAll()
  return all.find((e) => e.dayKey === dayKey) ?? null
}

export async function upsertMoodJournalEntry(input: {
  dayKey: string
  moodLevel: 1 | 2 | 3 | 4 | 5
  moodLabel?: string
  note: string
  attachments?: MoodMediaAttachment[]
}): Promise<MoodJournalEntry> {
  const all = await readAll()
  const createdAt = new Date().toISOString()
  const attachments =
    input.attachments && input.attachments.length > 0
      ? input.attachments
      : undefined
  const next: MoodJournalEntry = {
    id: `mood-${input.dayKey}`,
    dayKey: input.dayKey,
    moodLevel: input.moodLevel,
    ...(input.moodLabel ? { moodLabel: input.moodLabel } : {}),
    note: input.note.trim(),
    createdAt,
    ...(attachments ? { attachments } : {}),
  }
  const filtered = all.filter((e) => e.dayKey !== input.dayKey)
  filtered.unshift(next)
  await store.setItem(ENTRIES_KEY, filtered.slice(0, 400))
  return next
}

export async function deleteMoodJournalEntryById(id: string): Promise<boolean> {
  const targetId = id.trim()
  if (!targetId) return false
  const all = await readAll()
  const next = all.filter((e) => e.id !== targetId)
  if (next.length === all.length) return false
  await store.setItem(ENTRIES_KEY, next)
  return true
}
