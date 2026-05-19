import { FALLBACK_QUOTES } from '../fallback/quotes'
import {
  companionTextHasBleakWithoutComfort,
  companionTextHasEllipticalTail,
  companionTextHasFunctionalTone,
  companionTextHasMotivationalParallelTemplate,
  companionTextHasPoeticTemplate,
  companionTextHasStiffHealingCliche,
} from '../prompts/textPrompt'

export type CompanionTextResult = {
  text: string
  source: 'model' | 'fallback'
}

function pickFallbackQuote(maxChars?: number): string {
  const withinLen =
    maxChars != null
      ? FALLBACK_QUOTES.filter((q) => q.length <= maxChars)
      : FALLBACK_QUOTES
  const base = withinLen.length > 0 ? withinLen : FALLBACK_QUOTES
  const withoutBanned = base.filter(
    (q) =>
      !companionTextHasPoeticTemplate(q) &&
      !companionTextHasMotivationalParallelTemplate(q) &&
      !companionTextHasBleakWithoutComfort(q) &&
      !companionTextHasFunctionalTone(q, '治愈') &&
      !companionTextHasStiffHealingCliche(q) &&
      !companionTextHasEllipticalTail(q),
  )
  const pool = withoutBanned.length > 0 ? withoutBanned : base
  return (
    pool[Math.floor(Math.random() * pool.length)] ??
    '先慢慢来，你不需要一次做完所有事。'
  )
}

export async function getCompanionText(
  requestModelText: () => Promise<string>,
  options?: { maxChars?: number },
): Promise<CompanionTextResult> {
  try {
    const text = await requestModelText()
    if (!text.trim()) throw new Error('empty text')
    return { text, source: 'model' }
  } catch (err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[sidekick] 陪伴文案模型请求失败，使用本地兜底句',
        err instanceof Error ? err.message : err,
      )
    }
    return { text: pickFallbackQuote(options?.maxChars), source: 'fallback' }
  }
}
