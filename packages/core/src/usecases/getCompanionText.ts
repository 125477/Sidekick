import { FALLBACK_QUOTES } from '../fallback/quotes'
import {
  companionTextHasBleakWithoutComfort,
  companionTextHasEllipticalTail,
  companionTextHasFormulaSkeleton,
  companionTextHasFunctionalTone,
  companionTextHasMotivationalParallelTemplate,
  companionTextHasOralPermissionCliche,
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
      !companionTextHasFormulaSkeleton(q) &&
      !companionTextHasPoeticTemplate(q) &&
      !companionTextHasMotivationalParallelTemplate(q) &&
      !companionTextHasBleakWithoutComfort(q) &&
      !companionTextHasFunctionalTone(q, '治愈') &&
      !companionTextHasStiffHealingCliche(q) &&
      !companionTextHasOralPermissionCliche(q) &&
      !companionTextHasEllipticalTail(q),
  )
  const pool = withoutBanned.length > 0 ? withoutBanned : base
  return (
    pool[Math.floor(Math.random() * pool.length)] ??
    '先慢慢来，你不需要一次做完所有事。'
  )
}

export type GetCompanionTextOptions = {
  maxChars?: number
  /**
   * 模型请求失败或质检不通过时的兜底；未传则用 `FALLBACK_QUOTES` 随机（历史兼容）。
   * 定时首句 / 推送应传入 `pickCompanionRegenerateLine` 白名单句库。
   */
  pickFallback?: (maxChars?: number) => string
  /** 返回 true 时不吞错、直接抛出（如百炼 InternalError → 回退 chat 轮换 model）。 */
  shouldRethrow?: (err: unknown) => boolean
}

export async function getCompanionText(
  requestModelText: () => Promise<string>,
  options?: GetCompanionTextOptions,
): Promise<CompanionTextResult> {
  try {
    const text = await requestModelText()
    if (!text.trim()) throw new Error('empty text')
    return { text, source: 'model' }
  } catch (err) {
    if (options?.shouldRethrow?.(err)) throw err
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[sidekick] 陪伴文案模型未产出合格句，使用本地兜底',
        err instanceof Error ? err.message : err,
      )
    }
    const pick = options?.pickFallback ?? pickFallbackQuote
    return { text: pick(options?.maxChars), source: 'fallback' }
  }
}
