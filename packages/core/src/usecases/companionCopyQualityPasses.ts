import {
  buildLiteraryPermissionRetryUserSuffix,
  buildLiterarySensoryRetryUserSuffix,
  buildMismatchedPeriodRetryUserSuffix,
  buildPaceMantraRetryUserSuffix,
  buildRegenerateCanButRetryUserSuffix,
  buildRegenerateImperativeGuessRetryUserSuffix,
  buildRegenerateNarratorFabricationRetryUserSuffix,
  buildRegenerateProductMarketingRetryUserSuffix,
  buildRegenerateStepMantraRetryUserSuffix,
  buildRegenerateVagueMantraRetryUserSuffix,
  companionTextHasLiteraryPermissionCliche,
  companionTextHasLiterarySensoryCliche,
  companionTextHasMismatchedPeriodWord,
  companionTextHasPaceMantraCliche,
  companionTextHasRegenerateCanButSkeleton,
  companionTextHasRegenerateImperativeOrGuess,
  companionTextHasProductMarketingCliche,
  companionTextHasRegenerateNarratorFabrication,
  companionTextHasRegenerateStepMantraCliche,
  companionTextHasRegenerateVagueMantraCliche,
  companionTextHasPoeticTimeMelodyCliche,
  companionTextHasPrematureWorkdayEnd,
  companionTextIsAgentMetaClarification,
  companionTextViolatesBannedStructure,
} from '../prompts/companionStructureValidation'
import {
  buildRegenerateDoLittleTodayRetryUserSuffix,
  buildRegenerateEffortAccumulationRetryUserSuffix,
  buildRegenerateYesterdayComparisonRetryUserSuffix,
  companionTextHasDoLittleTodaySkeleton,
  companionTextHasEffortAccumulationSkeleton,
  companionTextHasYesterdayComparisonSkeleton,
} from '../prompts/companionRegenerateSkeleton'
import {
  buildRouteComfortPermissionRetryUserSuffix,
  companionTextHasRouteComfortPermissionCliche,
  companionTextHasSceneryMoodCliche,
} from '../prompts/companionLineSimilarity'
import type { CompanionCopyStyle } from '../prompts/textPrompt'
import {
  buildBleakWithoutComfortRetryUserSuffix,
  buildDesktopClicheRetryUserSuffix,
  buildEllipticalTailRetryUserSuffix,
  buildFormulaSkeletonRetryUserSuffix,
  buildFunctionalToneRetryUserSuffix,
  buildMotivationalParallelRetryUserSuffix,
  buildOralPermissionRetryUserSuffix,
  buildPoeticTemplateRetryUserSuffix,
  buildStiffHealingRetryUserSuffix,
  buildTooShortRetryUserSuffix,
  companionTextHasBleakWithoutComfort,
  companionTextHasDesktopCliche,
  companionTextHasEllipticalTail,
  companionTextHasFormulaSkeleton,
  companionTextHasFunctionalTone,
  companionTextHasMotivationalParallelTemplate,
  companionTextHasOralPermissionCliche,
  companionTextHasPoeticTemplate,
  companionTextHasStiffHealingCliche,
  companionTextNeedsPlainHealingCheck,
  companionTextTooShort,
} from '../prompts/textPrompt'

export type CompanionCopyQualityContext = {
  maxChars: number
  style: CompanionCopyStyle
  now?: Date
}

type QualityPass = {
  test: (line: string, ctx: CompanionCopyQualityContext) => boolean
  suffix: (ctx: CompanionCopyQualityContext) => string
}

const QUALITY_PASSES: QualityPass[] = [
  {
    test: (line) => companionTextIsAgentMetaClarification(line),
    suffix: () =>
      '【硬约束】禁止索要 writing_angle 或 avoid_recent_block；变量已在上方给出。只输出一条简体中文陪伴短句。',
  },
  {
    test: (line, ctx) => companionTextTooShort(line, ctx.maxChars, ctx.style),
    suffix: (ctx) => buildTooShortRetryUserSuffix(ctx.maxChars, ctx.style),
  },
  {
    test: (line) => companionTextHasRegenerateCanButSkeleton(line),
    suffix: (ctx) => buildRegenerateCanButRetryUserSuffix(ctx.style),
  },
  {
    test: (line) => companionTextHasDoLittleTodaySkeleton(line),
    suffix: (ctx) => buildRegenerateDoLittleTodayRetryUserSuffix(ctx.style),
  },
  {
    test: (line) => companionTextHasYesterdayComparisonSkeleton(line),
    suffix: (ctx) => buildRegenerateYesterdayComparisonRetryUserSuffix(ctx.style),
  },
  {
    test: (line) => companionTextHasEffortAccumulationSkeleton(line),
    suffix: (ctx) => buildRegenerateEffortAccumulationRetryUserSuffix(ctx.style),
  },
  {
    test: (line, ctx) =>
      companionTextHasPrematureWorkdayEnd(line, ctx.now ?? new Date()),
    suffix: (ctx) => {
      const h = (ctx.now ?? new Date()).getHours()
      const band = h < 12 ? '上午' : '下午'
      return `【硬约束】此刻是工作时段${band}，禁止「今天先到这儿/剩下的明天再碰」式收工句。写身体感受或直白许可。`
    },
  },
  {
    test: (line, ctx) =>
      companionTextHasMismatchedPeriodWord(line, ctx.now ?? new Date()),
    suffix: (ctx) => buildMismatchedPeriodRetryUserSuffix(ctx.now ?? new Date()),
  },
  {
    test: (line) => companionTextHasLiterarySensoryCliche(line),
    suffix: () => buildLiterarySensoryRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasLiteraryPermissionCliche(line),
    suffix: () => buildLiteraryPermissionRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasPaceMantraCliche(line),
    suffix: () => buildPaceMantraRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasRouteComfortPermissionCliche(line),
    suffix: () => buildRouteComfortPermissionRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasProductMarketingCliche(line),
    suffix: (ctx) => buildRegenerateProductMarketingRetryUserSuffix(ctx.style),
  },
  {
    test: (line) => companionTextHasRegenerateStepMantraCliche(line),
    suffix: () => buildRegenerateStepMantraRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasRegenerateNarratorFabrication(line),
    suffix: (ctx) => buildRegenerateNarratorFabricationRetryUserSuffix(ctx.style),
  },
  {
    test: (line) => companionTextHasRegenerateVagueMantraCliche(line),
    suffix: () => buildRegenerateVagueMantraRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasRegenerateImperativeOrGuess(line),
    suffix: () => buildRegenerateImperativeGuessRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasOralPermissionCliche(line),
    suffix: () => buildOralPermissionRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasPoeticTimeMelodyCliche(line),
    suffix: () => buildPoeticTemplateRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasSceneryMoodCliche(line),
    suffix: () => buildPoeticTemplateRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasFormulaSkeleton(line),
    suffix: () => buildFormulaSkeletonRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasPoeticTemplate(line),
    suffix: () => buildPoeticTemplateRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasDesktopCliche(line),
    suffix: () => buildDesktopClicheRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasMotivationalParallelTemplate(line),
    suffix: () => buildMotivationalParallelRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasBleakWithoutComfort(line),
    suffix: () => buildBleakWithoutComfortRetryUserSuffix(),
  },
  {
    test: (line, ctx) => companionTextHasFunctionalTone(line, ctx.style),
    suffix: (ctx) => buildFunctionalToneRetryUserSuffix(ctx.style),
  },
  {
    test: (line, ctx) =>
      companionTextNeedsPlainHealingCheck(ctx.style) &&
      companionTextHasStiffHealingCliche(line),
    suffix: () => buildStiffHealingRetryUserSuffix(),
  },
  {
    test: (line) => companionTextHasEllipticalTail(line),
    suffix: () => buildEllipticalTailRetryUserSuffix(),
  },
]

export function companionCopyStillBanned(
  line: string,
  ctx: CompanionCopyQualityContext,
): boolean {
  if (
    companionTextViolatesBannedStructure(
      line,
      ctx.style,
      ctx.maxChars,
      ctx.now ?? new Date(),
    )
  ) {
    return true
  }
  return QUALITY_PASSES.some((pass) => pass.test(line, ctx))
}

/**
 * 对模型首句逐条校验并重试（chat 与百炼智能体共用）。
 */
export async function refineCompanionCopyLine(
  line: string,
  ctx: CompanionCopyQualityContext,
  requestLine: (retryUserSuffix: string) => Promise<string>,
  opts?: { maxExtraRetries?: number; strictFinish?: boolean },
): Promise<string> {
  let current = line
  let extraRetries = 0
  const maxExtra =
    typeof opts?.maxExtraRetries === 'number' && opts.maxExtraRetries >= 0
      ? opts.maxExtraRetries
      : QUALITY_PASSES.length

  while (extraRetries < maxExtra) {
    const failing = QUALITY_PASSES.find((pass) => pass.test(current, ctx))
    if (!failing) break
    current = await requestLine(failing.suffix(ctx))
    extraRetries += 1
  }

  if (companionCopyStillBanned(current, ctx)) {
    if (opts?.strictFinish) {
      throw new Error('companion copy still matches banned template')
    }
    const hanLen = current.replace(/[^\u4e00-\u9fff]/gu, '').length
    if (hanLen >= 8 && !companionTextIsAgentMetaClarification(current)) {
      return current
    }
    throw new Error('companion copy still matches banned template')
  }
  return current
}
