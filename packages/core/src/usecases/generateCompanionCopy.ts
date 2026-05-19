import {
  requestDashScopeTextWithFallback,
  type DashScopeTextRequest,
} from '../clients/dashscopeTextClient'
import type { EmotionKind } from '../schema/data'
import {
  buildBleakWithoutComfortRetryUserSuffix,
  buildCompanionSystemPrompt,
  buildCompanionUserPromptWithInterests,
  buildDesktopClicheRetryUserSuffix,
  buildMotivationalParallelRetryUserSuffix,
  buildFunctionalToneRetryUserSuffix,
  buildPoeticTemplateRetryUserSuffix,
  companionStyleForEmotion,
  companionTextHasBleakWithoutComfort,
  companionTextHasDesktopCliche,
  companionTextHasFunctionalTone,
  companionTextHasMotivationalParallelTemplate,
  companionTextHasPoeticTemplate,
  parseCompanionInterestTags,
  type CompanionCopyStyle,
} from '../prompts/textPrompt'
import { getCompanionText, type CompanionTextResult } from './getCompanionText'

export type GenerateCompanionCopyInput = {
  apiKey: string | undefined
  model: string | undefined
  style: CompanionCopyStyle
  keyword: string | undefined
  allowEmoji: boolean
  maxChars: number
  temperature: number | undefined
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
  const userPrompt = buildCompanionUserPromptWithInterests(
    input.keyword,
    input.emotion,
    input.avoidRecentOutputs && input.avoidRecentOutputs.length > 0
      ? { avoidRecentOutputs: input.avoidRecentOutputs }
      : undefined,
    interestTags,
  )

  const recentCount = input.avoidRecentOutputs?.length ?? 0
  const baseTemperature = input.temperature ?? 0.7
  const effectiveTemperature =
    recentCount > 0 ? Math.min(1.05, baseTemperature + 0.12) : baseTemperature

  const requestModelLine = async (userPromptLine: string): Promise<string> => {
    const req: DashScopeTextRequest = {
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt,
      userPrompt: userPromptLine,
      temperature: effectiveTemperature,
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

  const result = await getCompanionText(async () => {
    let line = await requestModelLine(userPrompt)
    if (companionTextHasPoeticTemplate(line)) {
      line = await requestModelLine(
        `${userPrompt}\n${buildPoeticTemplateRetryUserSuffix()}`,
      )
    }
    if (companionTextHasDesktopCliche(line)) {
      line = await requestModelLine(
        `${userPrompt}\n${buildDesktopClicheRetryUserSuffix()}`,
      )
    }
    if (companionTextHasMotivationalParallelTemplate(line)) {
      line = await requestModelLine(
        `${userPrompt}\n${buildMotivationalParallelRetryUserSuffix()}`,
      )
    }
    if (companionTextHasBleakWithoutComfort(line)) {
      line = await requestModelLine(
        `${userPrompt}\n${buildBleakWithoutComfortRetryUserSuffix()}`,
      )
    }
    if (companionTextHasFunctionalTone(line, effectiveStyle)) {
      line = await requestModelLine(
        `${userPrompt}\n${buildFunctionalToneRetryUserSuffix(effectiveStyle)}`,
      )
    }
    if (
      companionTextHasPoeticTemplate(line) ||
      companionTextHasDesktopCliche(line) ||
      companionTextHasMotivationalParallelTemplate(line) ||
      companionTextHasBleakWithoutComfort(line) ||
      companionTextHasFunctionalTone(line, effectiveStyle)
    ) {
      throw new Error('companion copy still matches banned template')
    }
    return line
  }, { maxChars: input.maxChars })

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
  }
}

