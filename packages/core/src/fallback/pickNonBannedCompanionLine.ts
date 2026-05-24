import type { CompanionArchetypeId } from '../prompts/companionArchetypes'
import { pickArchetypeExemplarLine } from '../prompts/companionArchetypes'
import type { CompanionCopyTrigger } from '../prompts/textPrompt'
import type { CompanionCopyQualityContext } from '../usecases/companionCopyQualityPasses'

/**
 * 模型违反白名单句法时，从本轮 `writing_angle` 对应 archetype 的示例句抽取。
 * 不按禁词表替换，而是强制落到已声明的句法结构上。
 */
export function pickNonBannedCompanionLine(
  archetypeId: CompanionArchetypeId,
  _ctx: CompanionCopyQualityContext,
  _trigger: CompanionCopyTrigger,
  opts?: {
    maxChars?: number
    seed?: number
    avoidRecent?: string[]
  },
): string {
  return pickArchetypeExemplarLine(archetypeId, {
    maxChars: opts?.maxChars ?? _ctx.maxChars,
    ...(opts?.seed !== undefined ? { seed: opts.seed } : {}),
    ...(opts?.avoidRecent?.length ? { avoidRecent: opts.avoidRecent } : {}),
  })
}
