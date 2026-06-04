/**
 * 陪伴短句出参质检（仅 Console 告警；**不**触发二次 API）。
 * 套句结构判定集中在此模块，勿再往百炼 prompt 堆禁词。
 */

import { companionLineTooSimilarToAny } from './companionLineSimilarity'
import {
  companionTextIsAgentMetaClarification,
  companionTextHasProductMarketingCliche,
  companionTextViolatesBannedStructure,
} from './companionStructureValidation'
import type { CompanionCopyStyle } from './textPrompt'

export type CompanionOutputGateContext = {
  style: CompanionCopyStyle
  maxChars: number
  avoidRecent?: string[]
  now?: Date
}

/** 只拦套句骨架/索要参数；不拦「与历史句二字词相近」（交互换句误杀率高）。 */
export function companionAgentLineStructurallyRejected(
  line: string,
  ctx: CompanionOutputGateContext,
): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (companionTextIsAgentMetaClarification(t)) return true
  return companionTextViolatesBannedStructure(
    t,
    ctx.style,
    ctx.maxChars,
    ctx.now,
  )
}

/** 不宜作为【待改写】的屏上句（产品占位/自我介绍，非陪伴短句）。 */
export function companionLineIsNonRewriteTarget(line: string | undefined): boolean {
  const t = line?.replace(/\s+/g, ' ').trim() ?? ''
  if (!t) return true
  if (/更多功能|V1\.1|解锁/.test(t)) return true
  if (/我是「灵伴」|智能陪伴伙伴/.test(t)) return true
  if (companionTextHasProductMarketingCliche(t)) return true
  return false
}

/** 换一句：仅当与屏幕上这句几乎相同才拒（不误杀「先喘口气」类正常模型句）。 */
export function companionLineDuplicateOfReplaceTarget(
  candidate: string,
  replaceTarget: string | undefined,
): boolean {
  const t = candidate.replace(/\s+/g, ' ').trim()
  const target = replaceTarget?.replace(/\s+/g, ' ').trim() ?? ''
  if (!t || !target) return false
  if (t === target) return true
  return companionLineTooSimilarToAny(t, [target], {
    maxContiguousOverlap: 10,
    sameFirstChar: false,
  })
}

export function companionAgentLineRejected(
  line: string,
  ctx: CompanionOutputGateContext,
): boolean {
  if (companionAgentLineStructurallyRejected(line, ctx)) {
    return true
  }
  return false
}

/** 自动推送：与本地历史精确相同则拒（全量 history，不限条数）。 */
export function companionLineExactDuplicateInList(
  candidate: string,
  lines: string[] | undefined,
): boolean {
  const t = candidate.replace(/\s+/g, ' ').trim()
  if (!t || !lines?.length) return false
  for (const line of lines) {
    if (line.replace(/\s+/g, ' ').trim() === t) return true
  }
  return false
}

/** 自动推送：全量 history 精确去重 + 近期句相似度去重。 */
export function companionLineDuplicateOfStoredHistory(
  candidate: string,
  allHistoryLines: string[] | undefined,
  recentForSimilarity: string[] | undefined,
): boolean {
  if (companionLineExactDuplicateInList(candidate, allHistoryLines)) {
    return true
  }
  const recent = recentForSimilarity?.filter(Boolean) ?? []
  if (recent.length === 0) return false
  return companionLineTooSimilarToAny(candidate, recent, { sameFirstChar: false })
}

/** @deprecated 使用 companionLineDuplicateOfStoredHistory */
export function companionLineDuplicateOfRecentHistory(
  candidate: string,
  recent: string[] | undefined,
): boolean {
  return companionLineDuplicateOfStoredHistory(candidate, recent, recent)
}

/** 去掉模型输出的外层直角/弯引号，气泡直接展示正文。 */
export function stripCompanionLineCornerQuotes(text: string): string {
  return text
    .replace(/^\s*[「『"'‘“]+/, '')
    .replace(/[」』"'’”]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}
