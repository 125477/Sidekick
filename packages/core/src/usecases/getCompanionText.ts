import { FALLBACK_QUOTES } from '../fallback/quotes'

export type CompanionTextResult = {
  text: string
  source: 'model' | 'fallback'
}

export async function getCompanionText(
  requestModelText: () => Promise<string>,
): Promise<CompanionTextResult> {
  try {
    const text = await requestModelText()
    if (!text.trim()) throw new Error('empty text')
    return { text, source: 'model' }
  } catch {
    const fallback =
      FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)] ??
      '先慢慢来，你不需要一次做完所有事。'
    return { text: fallback, source: 'fallback' }
  }
}
