import { requestDashScopeAgentCompletion } from '../clients/dashscopeAgentClient'
import type { EmotionKind } from '../schema/data'
import {
  buildCompanionAgentUserPrompt,
  buildCompanionAgentUserPromptParams,
  companionMinCharsForStyle,
  companionStyleForEmotion,
  type BuildCompanionAgentContextInput,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'
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
  return first
    .replace(/^["'「『【]+/, '')
    .replace(/["'」』】]+$/, '')
    .trim()
}

async function invokeCompanionAgentOnce(
  input: GenerateCompanionViaAgentInput,
  ctx: BuildCompanionAgentContextInput,
  extraUserSuffix?: string,
): Promise<{ line: string; sessionId: string | null }> {
  const userPromptParams = buildCompanionAgentUserPromptParams(ctx)
  const prompt = extraUserSuffix
    ? `${buildCompanionAgentUserPrompt(ctx)}\n${extraUserSuffix}`
    : buildCompanionAgentUserPrompt(ctx)
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
  return { line, sessionId: null }
}

/** 单次百炼 HTTP；气泡必须与该次 Network `output.text` 一致。 */
async function generateLineOnce(
  input: GenerateCompanionViaAgentInput,
  ctx: BuildCompanionAgentContextInput,
): Promise<string> {
  const { line } = await invokeCompanionAgentOnce(input, ctx)
  return finalizeCompanionText(line, input.maxChars, input.allowEmoji)
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
  }

  const qualityCtx = { maxChars: input.maxChars, style: effectiveStyle }
  const singleShot =
    typeof input.maxQualityRetries === 'number' && input.maxQualityRetries === 0

  const result = await getCompanionText(async () => {
    if (singleShot) {
      return generateLineOnce(input, ctx)
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
    return line
  }, { maxChars: input.maxChars })

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
    sessionId: null,
  }
}
