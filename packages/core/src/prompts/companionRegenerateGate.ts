/**
 * 换一句 chat：套句判定（句库筛选用；**勿**用于误杀 API 句上屏）。
 */
import { companionLineDuplicateOfReplaceTarget } from './companionOutputGate'
import {
  companionTextHasConcretePauseCliche,
  companionTextHasContradictorySensoryMetaphor,
  companionTextHasBodyRestCliche,
  companionTextHasRestBreakPermissionCliche,
  companionTextHasRouteComfortPermissionCliche,
  companionTextHasTodayRestPermissionTemplate,
} from './companionLineSimilarity'
import {
  companionTextHasLiteraryPermissionCliche,
  companionTextHasPaceMantraCliche,
  companionTextHasRegenerateCanButSkeleton,
  companionTextHasRegenerateImperativeOrGuess,
  companionTextHasProductMarketingCliche,
  companionTextHasRegenerateNarratorFabrication,
  companionTextHasRegenerateStepMantraCliche,
  companionTextHasRegenerateVagueMantraCliche,
  companionTextViolatesBannedStructure,
} from './companionStructureValidation'
import {
  companionTextHasDoLittleTodaySkeleton,
  companionTextHasEffortAccumulationSkeleton,
  companionTextHasYesterdayComparisonSkeleton,
} from './companionRegenerateSkeleton'
import {
  companionTextHasOralPermissionCliche,
  companionTextTooShort,
  type CompanionCopyStyle,
} from './textPrompt'

export type RegenerateLineGateContext = {
  maxChars: number
  style: CompanionCopyStyle
  now?: Date
}

type RegenerateClicheFamilyCheck = (text: string) => boolean

/** 同类套句骨架（仅当 candidate 与屏上句同属一族时才拒）。 */
const REGENERATE_CLICHE_FAMILY_CHECKS: RegenerateClicheFamilyCheck[] = [
  companionTextHasRouteComfortPermissionCliche,
  companionTextHasConcretePauseCliche,
  companionTextHasRestBreakPermissionCliche,
  companionTextHasTodayRestPermissionTemplate,
  companionTextHasPaceMantraCliche,
  companionTextHasBodyRestCliche,
  companionTextHasDoLittleTodaySkeleton,
  companionTextHasEffortAccumulationSkeleton,
  companionTextHasYesterdayComparisonSkeleton,
]

/**
 * 换句：是否仍在「改写屏上句」——字面过近，或命中同一套句骨架族。
 * 不比较 avoid 历史，避免「今天/可以/不必」起笔误杀。
 */
export function companionRegenerateRepeatsTargetSkeleton(
  candidate: string,
  replaceTarget: string,
): boolean {
  const t = candidate.replace(/\s+/g, ' ').trim()
  const target = replaceTarget.replace(/\s+/g, ' ').trim()
  if (!t || !target) return false
  if (t === target) return true
  if (companionLineDuplicateOfReplaceTarget(candidate, replaceTarget)) {
    return true
  }
  for (const check of REGENERATE_CLICHE_FAMILY_CHECKS) {
    if (check(t) && check(target)) return true
  }
  return false
}

export function companionRegenerateModelLineUnacceptable(
  line: string,
  ctx: RegenerateLineGateContext,
): boolean {
  const now = ctx.now ?? new Date()
  if (
    companionTextViolatesBannedStructure(line, ctx.style, ctx.maxChars, now)
  ) {
    return true
  }
  if (companionTextTooShort(line, ctx.maxChars, ctx.style)) return true
  if (companionTextHasOralPermissionCliche(line)) return true
  if (companionTextHasLiteraryPermissionCliche(line)) return true
  if (companionTextHasPaceMantraCliche(line)) return true
  if (companionTextHasRestBreakPermissionCliche(line)) return true
  if (companionTextHasRouteComfortPermissionCliche(line)) return true
  if (companionTextHasBodyRestCliche(line)) return true
  if (companionTextHasContradictorySensoryMetaphor(line)) return true
  if (companionTextHasConcretePauseCliche(line)) return true
  if (companionTextHasRegenerateImperativeOrGuess(line)) return true
  if (companionTextHasRegenerateVagueMantraCliche(line)) return true
  if (companionTextHasRegenerateNarratorFabrication(line)) return true
  if (companionTextHasRegenerateStepMantraCliche(line)) return true
  if (companionTextHasRegenerateCanButSkeleton(line)) return true
  if (companionTextHasDoLittleTodaySkeleton(line)) return true
  if (companionTextHasYesterdayComparisonSkeleton(line)) return true
  if (companionTextHasEffortAccumulationSkeleton(line)) return true
  if (companionTextHasProductMarketingCliche(line)) return true
  return false
}
