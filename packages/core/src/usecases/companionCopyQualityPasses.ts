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
}

type QualityPass = {
  test: (line: string, ctx: CompanionCopyQualityContext) => boolean
  suffix: (ctx: CompanionCopyQualityContext) => string
}

const QUALITY_PASSES: QualityPass[] = [
  {
    test: (line, ctx) => companionTextTooShort(line, ctx.maxChars, ctx.style),
    suffix: (ctx) => buildTooShortRetryUserSuffix(ctx.maxChars, ctx.style),
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
    test: (line, ctx) =>
      companionTextNeedsPlainHealingCheck(ctx.style) &&
      companionTextHasOralPermissionCliche(line),
    suffix: () => buildOralPermissionRetryUserSuffix(),
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
  return QUALITY_PASSES.some((pass) => pass.test(line, ctx))
}

/**
 * 对模型首句逐条校验并重试（chat 与百炼智能体共用）。
 */
export async function refineCompanionCopyLine(
  line: string,
  ctx: CompanionCopyQualityContext,
  requestLine: (retryUserSuffix: string) => Promise<string>,
  opts?: { maxExtraRetries?: number },
): Promise<string> {
  let current = line
  let extraRetries = 0
  const maxExtra =
    typeof opts?.maxExtraRetries === 'number' && opts.maxExtraRetries >= 0
      ? opts.maxExtraRetries
      : QUALITY_PASSES.length
  for (const pass of QUALITY_PASSES) {
    if (!pass.test(current, ctx)) continue
    if (extraRetries >= maxExtra) break
    extraRetries += 1
    current = await requestLine(pass.suffix(ctx))
  }
  if (companionCopyStillBanned(current, ctx)) {
    throw new Error('companion copy still matches banned template')
  }
  return current
}
