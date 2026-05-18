import {
  requestDashScopeTextWithFallback,
  type DashScopeTextRequest,
} from '@sidekick/core'
import {
  setLightFeedbackForMessage,
  type LightFeedbackKind,
} from './companionLightFeedbackStorage'

export type { LightFeedbackKind } from './companionLightFeedbackStorage'

const LABELS: Record<LightFeedbackKind, string> = {
  like: '喜欢',
  neutral: '一般',
  less: '少推这类',
}

function dashscopeChatCompletionsUrl(): string | undefined {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      return `${window.location.origin}/dashscope/compatible-mode/v1/chat/completions`
    }
  }
  return undefined
}

async function completeLightFeedbackWithDashScope(
  req: DashScopeTextRequest,
): Promise<string> {
  const ipc = window.sidekickDesktop?.dashscopeChat
  if (ipc) {
    const modelFallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
      | string
      | undefined
    return ipc({
      apiKey: req.apiKey,
      model: req.model,
      systemPrompt: req.systemPrompt,
      userPrompt: req.userPrompt,
      temperature: req.temperature,
      ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
      ...(req.chatCompletionsUrl
        ? { chatCompletionsUrl: req.chatCompletionsUrl }
        : {}),
    })
  }
  const fallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
    | string
    | undefined
  const result = await requestDashScopeTextWithFallback(
    req,
    fallbackEnv ? { envFallbackList: fallbackEnv } : {},
  )
  return result.content
}

/**
 * 将气泡轻反馈送交通义千问，归纳成一条短偏好写入本地；后续 `fetchCompanionCopy` 会注入 system prompt。
 */
export async function submitCompanionLightFeedback(args: {
  message: string
  kind: LightFeedbackKind
}): Promise<string> {
  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined
  if (!apiKey?.trim()) {
    throw new Error('缺少 VITE_DASHSCOPE_API_KEY，无法调用通义归纳轻反馈')
  }
  const model =
    (import.meta.env.VITE_DASHSCOPE_MODEL as string | undefined) ?? 'qwen-turbo'
  const snippet = args.message.replace(/\s+/g, ' ').trim().slice(0, 220)
  if (!snippet) return ''

  const label = LABELS[args.kind]
  const systemPrompt = [
    '你是桌面陪伴产品的偏好提炼器。',
    `用户对一条气泡陪伴句点了「${label}」。`,
    '请用不超过 45 个汉字输出一条「给下一句文案生成模型读的写作偏好或禁忌」，',
    '不要引号、不要编号、不要医学建议；一句话说完。',
  ].join('')

  const userPrompt = `原文：${snippet}`

  const chatCompletionsUrl = dashscopeChatCompletionsUrl()
  const req: DashScopeTextRequest = {
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature: 0.35,
    ...(chatCompletionsUrl !== undefined ? { chatCompletionsUrl } : {}),
  }

  const line = (await completeLightFeedbackWithDashScope(req)).trim()
  if (!line) throw new Error('通义返回为空')
  setLightFeedbackForMessage(args.message, args.kind, line)
  return line
}
