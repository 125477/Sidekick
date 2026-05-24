/**
 * 陪伴短句出参质检（仅 Console 告警；**不**触发二次 API）。
 * 套句结构判定集中在此模块，勿再往百炼 prompt 堆禁词。
 */

import { companionLineTooSimilarToAny } from './companionLineSimilarity'
import { companionTextViolatesBannedStructure } from './companionStructureValidation'
import type { CompanionCopyStyle } from './textPrompt'

export type CompanionOutputGateContext = {
  style: CompanionCopyStyle
  maxChars: number
  avoidRecent?: string[]
  now?: Date
}

export function companionAgentLineRejected(
  line: string,
  ctx: CompanionOutputGateContext,
): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (
    companionTextViolatesBannedStructure(
      t,
      ctx.style,
      ctx.maxChars,
      ctx.now,
    )
  ) {
    return true
  }
  const recent = ctx.avoidRecent ?? []
  if (recent.length > 0 && companionLineTooSimilarToAny(t, recent)) {
    return true
  }
  return false
}
