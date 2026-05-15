import {
  requestDashScopeText,
  type DashScopeTextRequest,
} from '../clients/dashscopeTextClient'
import type { EmotionKind } from '../schema/data'
import {
  buildCompanionSystemPrompt,
  buildCompanionUserPrompt,
  companionStyleForEmotion,
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
  /** Browser dev: same-origin proxy path (see Vite config). */
  chatCompletionsUrl?: string
  /** 设置中的兴趣标签；非空时写入通义千问（DashScope）请求的 system 提示，见 `buildCompanionSystemPrompt`。 */
  companionInterests?: string[]
}

function trimToMaxChars(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxChars - 1))}…`
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
    ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
    ...(input.avoidRecentOutputs?.length ? { recentOutputsGuard: true } : {}),
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
  })
  const userPrompt = buildCompanionUserPrompt(
    input.keyword,
    input.emotion,
    input.avoidRecentOutputs && input.avoidRecentOutputs.length > 0
      ? { avoidRecentOutputs: input.avoidRecentOutputs }
      : undefined,
  )

  const recentCount = input.avoidRecentOutputs?.length ?? 0
  const baseTemperature = input.temperature ?? 0.7
  const effectiveTemperature =
    recentCount > 0 ? Math.min(1.05, baseTemperature + 0.12) : baseTemperature

  const result = await getCompanionText(async () => {
    const req: DashScopeTextRequest = {
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt,
      userPrompt,
      temperature: effectiveTemperature,
      ...(input.chatCompletionsUrl !== undefined
        ? { chatCompletionsUrl: input.chatCompletionsUrl }
        : {}),
    }
    const raw = input.invokeDashScope
      ? await input.invokeDashScope(req)
      : await requestDashScopeText(req)
    return trimToMaxChars(raw, input.maxChars)
  })

  return {
    ...result,
    text: trimToMaxChars(result.text, input.maxChars),
  }
}

