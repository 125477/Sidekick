import {
  requestDashScopeTextWithFallback,
  type DashScopeTextRequest,
} from '../clients/dashscopeTextClient'
import type { EmotionKind } from '../schema/data'
import {
  buildCompanionSystemPrompt,
  buildCompanionUserPromptWithInterests,
  buildCompanionTriggerContextLines,
  companionStyleForEmotion,
  parseCompanionInterestTags,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'
import { refineCompanionCopyLine } from './companionCopyQualityPasses'
import { getCompanionText, type CompanionTextResult } from './getCompanionText'

export type GenerateCompanionCopyInput = {
  apiKey: string | undefined
  model: string | undefined
  style: CompanionCopyStyle
  keyword: string | undefined
  allowEmoji: boolean
  maxChars: number
  /** 与情绪反馈联动时使用 */
  emotion?: EmotionKind
  /** 最近已向用户展示的陪伴句，写入 user prompt 以抑制「只改一两字」式复述 */
  avoidRecentOutputs?: string[]
  /** Electron main etc.: avoids renderer CORS blocking DashScope. */
  invokeDashScope?: (input: DashScopeTextRequest) => Promise<string>
  /** 逗号分隔的额外 model 候选（如 VITE_DASHSCOPE_MODEL_FALLBACK）。 */
  modelFallbackEnv?: string
  /** Browser dev: same-origin proxy path (see Vite config). */
  chatCompletionsUrl?: string
  /** 设置中的兴趣标签；非空时写入通义千问（DashScope）请求的 system 提示，见 `buildCompanionSystemPrompt`。 */
  companionInterests?: string[]
  /** 轻反馈经模型归纳后的提示行，见 `buildCompanionSystemPrompt`。 */
  companionLightFeedbackHints?: string[]
  trigger?: CompanionCopyTrigger
  yesterdayContextText?: string | null
  momentContextText?: string | null
  similarToLine?: string | null
  /** 套句校验额外重试上限；`0` 表示仅首句、不重试（换一句等场景）。 */
  maxQualityRetries?: number
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

export async function generateCompanionCopy(
  input: GenerateCompanionCopyInput,
): Promise<CompanionTextResult> {
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style

  const systemPrompt = buildCompanionSystemPrompt({
    style: effectiveStyle,
    keyword: input.keyword,
    allowEmoji: input.allowEmoji,
    maxChars: input.maxChars,
    now: new Date(),
    ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
    ...(input.avoidRecentOutputs?.length ? { recentOutputsGuard: true } : {}),
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
    ...(input.companionLightFeedbackHints?.length
      ? { companionLightFeedbackHints: input.companionLightFeedbackHints }
      : {}),
  })
  const { tags: interestTags } = parseCompanionInterestTags(
    input.companionInterests,
  )
  const triggerLines = buildCompanionTriggerContextLines({
    ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
    ...(input.momentContextText != null
      ? { momentContextText: input.momentContextText }
      : {}),
    ...(input.similarToLine != null ? { similarToLine: input.similarToLine } : {}),
    ...(input.yesterdayContextText != null
      ? { yesterdayContextText: input.yesterdayContextText }
      : {}),
  })
  const userPromptBase = buildCompanionUserPromptWithInterests(
    input.keyword,
    input.emotion,
    input.avoidRecentOutputs && input.avoidRecentOutputs.length > 0
      ? { avoidRecentOutputs: input.avoidRecentOutputs }
      : undefined,
    interestTags,
  )
  const userPrompt =
    triggerLines.length > 0
      ? `${triggerLines.join('\n')}\n${userPromptBase}`
      : userPromptBase

  const requestModelLine = async (userPromptLine: string): Promise<string> => {
    const req: DashScopeTextRequest = {
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt,
      userPrompt: userPromptLine,
      ...(input.chatCompletionsUrl !== undefined
        ? { chatCompletionsUrl: input.chatCompletionsUrl }
        : {}),
    }
    const raw = input.invokeDashScope
      ? await input.invokeDashScope(req)
      : (
          await requestDashScopeTextWithFallback(
            req,
            input.modelFallbackEnv
              ? { envFallbackList: input.modelFallbackEnv }
              : {},
          )
        ).content
    return finalizeCompanionText(raw, input.maxChars, input.allowEmoji)
  }

  const qualityCtx = { maxChars: input.maxChars, style: effectiveStyle }
  const refineOpts =
    typeof input.maxQualityRetries === 'number'
      ? { maxExtraRetries: input.maxQualityRetries }
      : undefined
  const result = await getCompanionText(async () => {
    let line = await requestModelLine(userPrompt)
    line = finalizeCompanionText(line, input.maxChars, input.allowEmoji)

    if (
      typeof input.maxQualityRetries === 'number' &&
      input.maxQualityRetries === 0
    ) {
      return line
    }

    return refineCompanionCopyLine(
      line,
      qualityCtx,
      (suffix) => requestModelLine(`${userPrompt}\n${suffix}`),
      refineOpts,
    )
  }, { maxChars: input.maxChars })

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
  }
}

