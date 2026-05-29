/**
 * 换一句：统一策略（Agent / chat / 结构化兜底共用）。
 *
 * - 每点击最多 1 次 API + 可选 1 次「仍在改写屏上句」重试
 * - API 句默认上屏；仅 API 失败或两轮仍与屏上句同骨架时用 archetype 兜底
 * - avoid 只含屏上句 + 最近几次换句结果，不灌入全量历史
 */

import { pickArchetypeExemplarLine, pickRegenerateCompanionArchetype } from '../prompts/companionArchetypes'
import { pickCompanionInterestRegenerateLine } from '../fallback/companionInterestRegenerateLines'
import { companionLineDuplicateOfReplaceTarget } from '../prompts/companionOutputGate'
import {
  buildCompanionReplaceTargetRetrySuffix,
  buildTodayRestPermissionRetryUserSuffix,
  companionRecentRestPermissionSaturated,
} from '../prompts/companionLineSimilarity'
import { companionRegenerateRepeatsTargetSkeleton } from '../prompts/companionRegenerateGate'
import {
  parseCompanionInterestTags,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'

export const REGENERATE_PROMPT_AVOID_MAX = 4

export function normalizeRegenerateLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 写入换句 prompt 的 avoid：屏上句 + 最近换句产出（不含定时推送等远历史）。 */
export function buildRegenerateAvoidForPrompt(input: {
  screenLine?: string
  lastRegenerateOutputs?: string[]
}): string[] {
  const out: string[] = []
  const push = (line: string | undefined) => {
    const t = normalizeRegenerateLine(line ?? '')
    if (t && !out.includes(t)) out.push(t)
  }
  for (const line of input.lastRegenerateOutputs ?? []) push(line)
  push(input.screenLine)
  return out.slice(-REGENERATE_PROMPT_AVOID_MAX)
}

/** 是否仍在「改写屏上句」——仅此情况才叠一轮 API 重试。 */
export function shouldRetryRegenerateAgainstTarget(
  candidate: string,
  replaceTarget: string | undefined,
): boolean {
  const t = normalizeRegenerateLine(candidate)
  const target = normalizeRegenerateLine(replaceTarget ?? '')
  if (!t) return true
  if (!target) return false
  if (t === target) return true
  if (companionLineDuplicateOfReplaceTarget(candidate, replaceTarget)) return true
  return companionRegenerateRepeatsTargetSkeleton(candidate, target)
}

export function buildRegenerateRetrySuffix(input: {
  replaceTarget?: string
  avoidRecent?: string[]
}): string {
  const avoid = input.avoidRecent ?? []
  if (companionRecentRestPermissionSaturated(avoid)) {
    return buildTodayRestPermissionRetryUserSuffix()
  }
  const target = normalizeRegenerateLine(input.replaceTarget ?? '')
  if (target) return buildCompanionReplaceTargetRetrySuffix(target)
  return '【硬约束·重写】须换起笔、重心、收束；禁止与屏上句同骨架换词。'
}

export type PickRegenerateStructuredFallbackInput = {
  trigger: CompanionCopyTrigger
  maxChars: number
  style?: CompanionCopyStyle
  seed?: number
  avoidRecent?: string[]
  replaceTarget?: string
  hasInterests?: boolean
  companionInterests?: string[]
}

/** 兜底：有兴趣用语义句；否则 archetype 句法（禁止再落示范原文）。 */
export function pickRegenerateStructuredFallback(
  input: PickRegenerateStructuredFallbackInput,
): string {
  const seed =
    input.seed ?? (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const avoid = (input.avoidRecent ?? [])
    .map(normalizeRegenerateLine)
    .filter(Boolean)
  const { tags } = parseCompanionInterestTags(input.companionInterests)
  if (tags.length > 0) {
    return pickCompanionInterestRegenerateLine({
      interestTags: tags,
      style: input.style ?? '治愈',
      maxChars: input.maxChars,
      seed,
      avoidRecent: avoid,
      ...(input.replaceTarget != null ? { replaceTarget: input.replaceTarget } : {}),
    })
  }

  const archetype = pickRegenerateCompanionArchetype(
    seed,
    avoid,
    input.hasInterests === true,
  )
  return pickArchetypeExemplarLine(archetype.id, {
    seed: seed + 1_048_583,
    maxChars: input.maxChars,
    avoidRecent: avoid,
  })
}
