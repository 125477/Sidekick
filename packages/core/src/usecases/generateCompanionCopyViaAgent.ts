import { requestDashScopeAgentCompletion } from '../clients/dashscopeAgentClient'
import type { EmotionKind } from '../schema/data'
import {
  buildCompanionAgentUserPrompt,
  buildCompanionAgentUserPromptParams,
  companionMinCharsForStyle,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'
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

/** 模型偶发中英夹杂时，保留首个英文片段之前的通顺中文。 */
function keepChineseCompanionSegment(text: string): string {
  const idx = text.search(/[A-Za-z]/)
  if (idx < 0) return text.trim()
  return text
    .slice(0, idx)
    .replace(/[，,、；;：:\s]+$/u, '')
    .trim()
}

/** 取模型返回的首行、去掉常见包裹符号。 */
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

export async function generateCompanionCopyViaAgent(
  input: GenerateCompanionViaAgentInput,
): Promise<CompanionViaAgentResult> {
  const ctx = {
    trigger: input.trigger,
    style: input.style,
    allowEmoji: input.allowEmoji,
    maxChars: input.maxChars,
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

  const userPromptParams = buildCompanionAgentUserPromptParams(ctx)
  const prompt = buildCompanionAgentUserPrompt(ctx)
  let capturedSessionId: string | null = input.sessionId ?? null

  const result = await getCompanionText(async () => {
    const raw = input.invokeAgent
      ? await input.invokeAgent({
          appId: input.appId,
          prompt,
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          userPromptParams,
        })
      : await requestDashScopeAgentCompletion(
          {
            apiKey: input.apiKey,
            appId: input.appId,
            prompt,
            ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
            userPromptParams,
          },
          input.requestBasePath !== undefined
            ? { requestBasePath: input.requestBasePath }
            : undefined,
        )

    capturedSessionId = raw.sessionId ?? capturedSessionId
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
    return finalizeCompanionText(line, input.maxChars, input.allowEmoji)
  }, { maxChars: input.maxChars })

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
    sessionId: capturedSessionId,
  }
}
