import { pickCompanionRegenerateLine } from '../fallback/companionRegeneratePool'
import {
  pickArchetypeExemplarLine,
  pickCompanionArchetype,
  pickRegenerateCompanionArchetype,
  type CompanionArchetypeId,
} from '../prompts/companionArchetypes'
import { companionLineDuplicateOfReplaceTarget } from '../prompts/companionOutputGate'
import { companionLineTooSimilarToAny } from '../prompts/companionLineSimilarity'
import type {
  CompanionCopyStyle,
  CompanionCopyTrigger,
} from '../prompts/textPrompt'

export type PickStructuredCompanionLineInput = {
  trigger: CompanionCopyTrigger
  maxChars: number
  style?: CompanionCopyStyle
  seed?: number
  avoidRecent?: string[]
  replaceTarget?: string
  hasInterests?: boolean
  now?: Date
}

const STRUCTURED_ARCHETYPE_ORDER: readonly CompanionArchetypeId[] = [
  'plain_can',
  'patience',
  'not_but',
  'short_question',
  'today_ok',
] as const

function lineAcceptable(
  line: string,
  input: PickStructuredCompanionLineInput,
): boolean {
  const recent = input.avoidRecent ?? []
  if (companionLineTooSimilarToAny(line, recent)) return false
  const target = input.replaceTarget?.replace(/\s+/g, ' ').trim()
  if (target && companionLineDuplicateOfReplaceTarget(line, target)) {
    return false
  }
  return line.length > 0 && line.length <= input.maxChars
}

function pickFromRegeneratePool(input: PickStructuredCompanionLineInput): string {
  return pickCompanionRegenerateLine({
    maxChars: input.maxChars,
    style: input.style ?? '治愈',
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    ...(input.avoidRecent?.length ? { avoidRecent: input.avoidRecent } : {}),
    ...(input.replaceTarget != null ? { replaceTarget: input.replaceTarget } : {}),
  })
}

function pickFromArchetypeRotation(
  input: PickStructuredCompanionLineInput,
): string {
  const seed =
    input.seed ?? (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const avoid = input.avoidRecent ?? []
  const primary =
    input.trigger === 'regenerate' || input.trigger === 'similar'
      ? pickRegenerateCompanionArchetype(
          seed,
          avoid,
          Boolean(input.hasInterests),
        )
      : pickCompanionArchetype(seed, avoid)

  const tryIds: CompanionArchetypeId[] = [
    primary.id,
    ...STRUCTURED_ARCHETYPE_ORDER.filter((id) => id !== primary.id),
  ]

  for (let i = 0; i < tryIds.length; i++) {
    const id = tryIds[i]!
    const line = pickArchetypeExemplarLine(id, {
      seed: seed + i * 997,
      maxChars: input.maxChars,
      avoidRecent: avoid,
      ...(input.now !== undefined ? { now: input.now } : {}),
    })
    if (lineAcceptable(line, input)) return line
  }
  return pickArchetypeExemplarLine(primary.id, {
    seed,
    maxChars: input.maxChars,
    avoidRecent: avoid,
    ...(input.now !== undefined ? { now: input.now } : {}),
  })
}

/**
 * 陪伴短句主路径：从白名单句库 / archetype 示范句选取，不调用大模型。
 * 避免「治愈腔」模型默认分布 + 禁词表 arms race。
 */
export function pickStructuredCompanionLine(
  input: PickStructuredCompanionLineInput,
): string {
  const archetypeLine = pickFromArchetypeRotation(input)
  if (lineAcceptable(archetypeLine, input)) return archetypeLine

  const poolLine = pickFromRegeneratePool(input)
  if (lineAcceptable(poolLine, input)) return poolLine

  return archetypeLine
}

/** 仅昨日/情境等需要读长上下文时走生成；其余一律结构化选句。 */
export function companionCopyNeedsGenerativeModel(
  trigger: CompanionCopyTrigger,
  ctx?: {
    yesterdayContextText?: string | null
    momentContextText?: string | null
  },
): boolean {
  if (ctx?.yesterdayContextText?.trim()) return true
  if (ctx?.momentContextText?.trim()) return true
  if (trigger === 'yesterday-greeting') return true
  if (trigger === 'journal-closure') return true
  return false
}
