import { buildCompanionInterestsPayload, COMPANION_INTEREST_ANSWER_MAX_CHARS, parseCompanionInterestNote } from '../constants/companionInterestTags'
import type { SidekickSettings } from '../state/settingsState'
import { saveSettings } from '../state/settingsStorage'
import { broadcastSettingsSync } from '../state/settingsSync'

const MAX_INTEREST_NOTES = 12

/** 兴趣深化回答：追加到 companionInterests 并持久化。 */
export async function appendCompanionInterestAnswer(
  settings: SidekickSettings,
  answer: string,
): Promise<SidekickSettings> {
  const trimmed = answer.replace(/\s+/g, ' ').trim()
  if (!trimmed) return settings
  const note =
    trimmed.length > COMPANION_INTEREST_ANSWER_MAX_CHARS
      ? `${trimmed.slice(0, COMPANION_INTEREST_ANSWER_MAX_CHARS - 1)}…`
      : trimmed
  const { tags, note: existingNote } = parseCompanionInterestNote(
    settings.companionInterests,
  )
  const existingNotes = existingNote
    ? existingNote.split(/[；;]/).map((s) => s.trim()).filter(Boolean)
    : []
  const mergedNotes = [...existingNotes, note]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(-MAX_INTEREST_NOTES)
  const nextInterests = buildCompanionInterestsPayload(
    tags,
    mergedNotes.join('；'),
  )

  const next: SidekickSettings = {
    ...settings,
    companionInterests: nextInterests,
  }
  await saveSettings(next)
  broadcastSettingsSync()
  return next
}
