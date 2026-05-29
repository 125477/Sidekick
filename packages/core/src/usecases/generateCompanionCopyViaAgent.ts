import {
  isBailianAgentApiFailure,
  requestDashScopeAgentCompletion,
} from '../clients/dashscopeAgentClient'
import { stripCompanionLineCornerQuotes } from '../prompts/companionOutputGate'
import type { EmotionKind } from '../schema/data'
import {
  buildCompanionAgentCompletionPayload,
  buildTooShortRetryUserSuffix,
  companionMinCharsForStyle,
  companionStyleForEmotion,
  companionTextTooShort,
  parseCompanionInterestTags,
  type BuildCompanionAgentContextInput,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'
import {
  buildRegenerateRetrySuffix as buildRegenerateRetrySuffixCore,
  pickRegenerateStructuredFallback,
  shouldRetryRegenerateAgainstTarget,
} from './regenerateCompanionLine'
import {
  companionInterestTagsRequireQuote,
  companionRegenerateLineFailsInterestQuoteMode,
  pickCompanionInterestRegenerateLine,
} from '../fallback/companionInterestRegenerateLines'
import {
  companionTextIsAgentMetaClarification,
  companionTextViolatesBannedStructure,
} from '../prompts/companionStructureValidation'
import { refineCompanionCopyLine } from './companionCopyQualityPasses'
import { getCompanionText, type CompanionTextResult } from './getCompanionText'

export type GenerateCompanionViaAgentInput = {
  apiKey: string | undefined
  appId: string
  sessionId?: string | null
  trigger: CompanionCopyTrigger
  style: CompanionCopyStyle
  keyword?: string
  allowEmoji: boolean
  maxChars: number
  emotion?: EmotionKind
  avoidRecentOutputs?: string[]
  companionInterests?: string[]
  companionLightFeedbackHints?: string[]
  yesterdayContextText?: string | null
  momentContextText?: string | null
  similarToLine?: string | null
  seed?: number
  maxQualityRetries?: number
  /** 换一句时屏幕上正在展示的原句（prompt 注入 + 出参重复重试）。 */
  replaceTargetLine?: string
  invokeAgent?: (payload: {
    appId: string
    prompt: string
    sessionId?: string | null
    userPromptParams: Record<string, string>
  }) => Promise<{ text: string; sessionId: string | null }>
  requestBasePath?: string
}

export type CompanionViaAgentResult = CompanionTextResult & {
  sessionId: string | null
}

function stripEmojisFromText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function trimToMaxChars(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxChars - 1))}…`
}

function finalizeCompanionText(
  text: string,
  maxChars: number,
  allowEmoji: boolean,
): string {
  const raw = allowEmoji ? text : stripEmojisFromText(text)
  return trimToMaxChars(raw, maxChars)
}

function companionTextHasLatinLetters(text: string): boolean {
  return /[A-Za-z]/.test(text)
}

function keepChineseCompanionSegment(text: string): string {
  const idx = text.search(/[A-Za-z]/)
  if (idx < 0) return text.trim()
  return text
    .slice(0, idx)
    .replace(/[，,、；;：:\s]+$/u, '')
    .trim()
}

function normalizeAgentLine(raw: string): string {
  const first = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
  if (!first) return ''
  return stripCompanionLineCornerQuotes(
    first
      .replace(/^["'「『【]+/, '')
      .replace(/["'」』】]+$/, '')
      .trim(),
  )
}

async function invokeCompanionAgentOnce(
  input: GenerateCompanionViaAgentInput,
  ctx: BuildCompanionAgentContextInput,
  extraUserSuffix?: string,
): Promise<{ line: string; sessionId: string | null }> {
  const { prompt: basePrompt, userPromptParams } =
    buildCompanionAgentCompletionPayload(ctx)
  const prompt = extraUserSuffix
    ? `${basePrompt}\n${extraUserSuffix}`
    : basePrompt
  const raw = input.invokeAgent
    ? await input.invokeAgent({
        appId: input.appId,
        prompt,
        userPromptParams,
      })
    : await requestDashScopeAgentCompletion(
        {
          apiKey: input.apiKey,
          appId: input.appId,
          prompt,
          userPromptParams,
        },
        input.requestBasePath !== undefined
          ? { requestBasePath: input.requestBasePath }
          : undefined,
      )

  let line = normalizeAgentLine(raw.text)
  if (companionTextHasLatinLetters(line)) {
    const zhOnly = keepChineseCompanionSegment(line)
    const minChars = companionMinCharsForStyle(input.maxChars, input.style)
    if (zhOnly.length >= minChars) {
      line = zhOnly
    } else {
      throw new Error('mixed language agent line')
    }
  }
  if (!line) throw new Error('empty agent line')
  if (companionTextIsAgentMetaClarification(line)) {
    throw new Error('agent meta clarification')
  }
  return { line, sessionId: null }
}

function isRegenerateLikeTrigger(trigger: CompanionCopyTrigger): boolean {
  return trigger === 'regenerate' || trigger === 'similar'
}

function lineNeedsRegenerateRetry(
  line: string,
  input: GenerateCompanionViaAgentInput,
  effectiveStyle: CompanionCopyStyle,
  now: Date,
): boolean {
  if (
    companionTextViolatesBannedStructure(
      line,
      effectiveStyle,
      input.maxChars,
      now,
    )
  ) {
    return true
  }
  const target = input.replaceTargetLine?.replace(/\s+/g, ' ').trim()
  if (target && shouldRetryRegenerateAgainstTarget(line, target)) {
    return true
  }
  return false
}

function buildAgentRegenerateRetrySuffix(
  replaceTarget: string | undefined,
  recent: string[],
  failedLine: string,
  maxChars: number,
  style: CompanionCopyStyle,
): string {
  const parts: string[] = []
  if (companionTextTooShort(failedLine, maxChars, style)) {
    parts.push(buildTooShortRetryUserSuffix(maxChars, style))
  }
  parts.push(
    buildRegenerateRetrySuffixCore({
      ...(replaceTarget != null ? { replaceTarget } : {}),
      avoidRecent: recent,
    }),
  )
  return parts.join('\n')
}

/** 换句/类似：最多 2 次百炼（首句 + 不合格时 1 次重写）。 */
async function finalizeRegenerateAgentLine(
  input: GenerateCompanionViaAgentInput,
  ctx: BuildCompanionAgentContextInput,
  baseSeed: number,
): Promise<string> {
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const now = ctx.now ?? new Date()
  let suffix: string | undefined
  let text = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptSeed =
      attempt === 0 ? (ctx.seed ?? baseSeed) : baseSeed + 501 + attempt * 997
    const { line } = await invokeCompanionAgentOnce(
      input,
      { ...ctx, seed: attemptSeed },
      suffix,
    )
    text = finalizeCompanionText(line, input.maxChars, input.allowEmoji)
    if (!lineNeedsRegenerateRetry(text, input, effectiveStyle, now)) {
      return text
    }
    suffix = buildAgentRegenerateRetrySuffix(
      input.replaceTargetLine,
      input.avoidRecentOutputs ?? [],
      text,
      input.maxChars,
      effectiveStyle,
    )
  }

  return text
}

export async function generateCompanionCopyViaAgent(
  input: GenerateCompanionViaAgentInput,
): Promise<CompanionViaAgentResult> {
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const baseSeed =
    input.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const ctx: BuildCompanionAgentContextInput = {
    trigger: input.trigger,
    style: input.style,
    allowEmoji: input.allowEmoji,
    maxChars: input.maxChars,
    seed: baseSeed,
    now: new Date(),
    ...(input.keyword !== undefined ? { keyword: input.keyword } : {}),
    ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
    ...(input.companionLightFeedbackHints?.length
      ? { companionLightFeedbackHints: input.companionLightFeedbackHints }
      : {}),
    ...(input.yesterdayContextText != null
      ? { yesterdayContextText: input.yesterdayContextText }
      : {}),
    ...(input.momentContextText != null
      ? { momentContextText: input.momentContextText }
      : {}),
    ...(input.similarToLine != null
      ? { similarToLine: input.similarToLine }
      : {}),
    ...(input.avoidRecentOutputs?.length
      ? { avoidRecentOutputs: input.avoidRecentOutputs }
      : {}),
    ...(input.replaceTargetLine != null
      ? { replaceTargetLine: input.replaceTargetLine }
      : {}),
  }

  const qualityCtx = {
    maxChars: input.maxChars,
    style: effectiveStyle,
    now: ctx.now ?? new Date(),
  }
  const singleShot =
    typeof input.maxQualityRetries === 'number' && input.maxQualityRetries === 0

  const result = await getCompanionText(async () => {
    if (singleShot && isRegenerateLikeTrigger(input.trigger)) {
      return finalizeRegenerateAgentLine(input, ctx, baseSeed)
    }

    if (singleShot) {
      const { line } = await invokeCompanionAgentOnce(input, ctx)
      return finalizeCompanionText(line, input.maxChars, input.allowEmoji)
    }

    let retrySeedOffset = 1
    let { line } = await invokeCompanionAgentOnce(input, ctx)
    line = finalizeCompanionText(line, input.maxChars, input.allowEmoji)

    const refineOpts =
      typeof input.maxQualityRetries === 'number'
        ? { maxExtraRetries: input.maxQualityRetries }
        : undefined
    line = await refineCompanionCopyLine(
      line,
      qualityCtx,
      async (suffix) => {
        const retry = await invokeCompanionAgentOnce(
          input,
          { ...ctx, seed: baseSeed + retrySeedOffset },
          suffix,
        )
        retrySeedOffset += 1
        return finalizeCompanionText(retry.line, input.maxChars, input.allowEmoji)
      },
      refineOpts,
    )
    const { tags: interestTags } = parseCompanionInterestTags(input.companionInterests)
    if (
      companionInterestTagsRequireQuote(interestTags) &&
      companionRegenerateLineFailsInterestQuoteMode(line)
    ) {
      const retry = await invokeCompanionAgentOnce(
        input,
        { ...ctx, seed: baseSeed + retrySeedOffset },
        '【硬约束·重写】用户选了兴趣标签，须写一句可念出的歌词/影视台词/书本金句；禁止散文套句（在这/片刻/灵魂/安宁/栖息）。',
      )
      retrySeedOffset += 1
      line = finalizeCompanionText(retry.line, input.maxChars, input.allowEmoji)
      if (companionRegenerateLineFailsInterestQuoteMode(line)) {
        line = pickCompanionInterestRegenerateLine({
          interestTags,
          maxChars: input.maxChars,
          style: effectiveStyle,
          seed: baseSeed,
          ...(input.avoidRecentOutputs?.length
            ? { avoidRecent: input.avoidRecentOutputs }
            : {}),
        })
      }
    }
    return line
  }, {
    maxChars: input.maxChars,
    pickFallback: () =>
      pickRegenerateStructuredFallback({
        trigger: input.trigger,
        maxChars: input.maxChars,
        style: effectiveStyle,
        seed: baseSeed,
        ...(input.avoidRecentOutputs?.length
          ? { avoidRecent: input.avoidRecentOutputs }
          : {}),
        ...(input.replaceTargetLine != null
          ? { replaceTarget: input.replaceTargetLine }
          : {}),
        ...(input.companionInterests?.length
          ? {
              companionInterests: input.companionInterests,
              hasInterests: true,
            }
          : {}),
      }),
    shouldRethrow: isBailianAgentApiFailure,
  })

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
    sessionId: null,
  }
}
