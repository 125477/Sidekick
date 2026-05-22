import {
  generateCompanionCopy,
  generateCompanionCopyViaAgent,
  isWithinQuietHours,
  type CompanionCopyTrigger,
  type CompanionTextResult,
  type DashScopeTextRequest,
  type EmotionKind,
} from '@sidekick/core'
import { broadcastSettingsSync } from '../state/settingsSync'
import { saveSettings } from '../state/settingsStorage'
import type { SidekickSettings } from '../state/settingsState'
import { getCompanionLightFeedbackHints } from './companionLightFeedbackStorage'

export type FetchCompanionCopyOptions = {
  trigger?: CompanionCopyTrigger
  yesterdayContextText?: string | null
  momentContextText?: string | null
  similarToLine?: string | null
}

export type FetchCompanionCopyResult = CompanionTextResult & {
  sessionId?: string | null
}

function bailianAppIdFromEnv(): string | undefined {
  const raw = import.meta.env.VITE_BAILIAN_APP_ID as string | undefined
  const id = raw?.trim()
  return id || undefined
}

function dashscopeRequestBase(): string | undefined {
  if (typeof window === 'undefined') return undefined
  if (import.meta.env.DEV) {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      return `${window.location.origin}/dashscope`
    }
  }
  return undefined
}

function resolveFetchTrigger(
  keyword: string | undefined,
  emotion: EmotionKind | undefined,
  explicit?: CompanionCopyTrigger,
): CompanionCopyTrigger {
  if (explicit) return explicit
  if (emotion) return 'emotion'
  if (keyword?.trim() === '换一句') return 'regenerate'
  if (keyword?.trim() === '类似这句') return 'similar'
  return 'manual'
}

function shouldUseBailianAgent(settings: SidekickSettings): boolean {
  if (settings.companionUseBailianAgent === false) return false
  return Boolean(bailianAppIdFromEnv())
}

export async function persistBailianAgentSessionId(
  settingsRef: { current: SidekickSettings },
  sessionId: string | null | undefined,
): Promise<void> {
  const id = sessionId?.trim()
  if (!id || id === settingsRef.current.bailianAgentSessionId) return
  const next: SidekickSettings = {
    ...settingsRef.current,
    bailianAgentSessionId: id,
  }
  settingsRef.current = next
  await saveSettings(next)
  broadcastSettingsSync()
}

export async function fetchCompanionCopy(
  settings: SidekickSettings,
  keyword?: string,
  emotion?: EmotionKind,
  avoidRecentOutputs?: string[],
  options?: FetchCompanionCopyOptions,
): Promise<FetchCompanionCopyResult> {
  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined
  const appId = bailianAppIdFromEnv()
  const trigger = resolveFetchTrigger(keyword, emotion, options?.trigger)
  const lightHints = getCompanionLightFeedbackHints()
  const generationSeed =
    Date.now() ^ Math.floor(Math.random() * 1_000_000_000)
  const common = {
    style: settings.textStyle,
    allowEmoji: settings.allowEmoji,
    maxChars: settings.textMaxChars,
    seed: generationSeed,
    ...(keyword !== undefined ? { keyword } : {}),
    ...(emotion !== undefined ? { emotion } : {}),
    ...(avoidRecentOutputs?.length ? { avoidRecentOutputs } : {}),
    ...(settings.companionInterests?.length
      ? { companionInterests: settings.companionInterests }
      : {}),
    ...(lightHints.length ? { companionLightFeedbackHints: lightHints } : {}),
    ...(options?.yesterdayContextText != null
      ? { yesterdayContextText: options.yesterdayContextText }
      : {}),
    ...(options?.momentContextText != null
      ? { momentContextText: options.momentContextText }
      : {}),
    ...(options?.similarToLine != null
      ? { similarToLine: options.similarToLine }
      : {}),
    trigger,
  }

  const dashscopeAgentIpc =
    typeof window !== 'undefined'
      ? window.sidekickDesktop?.dashscopeAgent
      : undefined
  const dashscopeChatIpc =
    typeof window !== 'undefined'
      ? window.sidekickDesktop?.dashscopeChat
      : undefined

  if (shouldUseBailianAgent(settings) && appId) {
    try {
      const requestBasePath = dashscopeRequestBase()
      const agentResult = await generateCompanionCopyViaAgent({
        apiKey,
        appId,
        ...(trigger === 'regenerate'
          ? {}
          : { sessionId: settings.bailianAgentSessionId }),
        ...common,
        ...(dashscopeAgentIpc
          ? {
              invokeAgent: (payload) =>
                dashscopeAgentIpc({
                  apiKey,
                  appId: payload.appId,
                  prompt: payload.prompt,
                  ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
                  userPromptParams: payload.userPromptParams,
                }),
            }
          : {}),
        ...(requestBasePath !== undefined ? { requestBasePath } : {}),
      })
      return {
        text: agentResult.text,
        source: agentResult.source,
        sessionId: agentResult.sessionId,
      }
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[sidekick] 百炼智能体失败，回退 chat/completions',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  let chatCompletionsUrl: string | undefined
  if (!dashscopeChatIpc && import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      chatCompletionsUrl = `${window.location.origin}/dashscope/compatible-mode/v1/chat/completions`
    }
  }

  const modelFallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
    | string
    | undefined

  const chatResult = await generateCompanionCopy({
    apiKey,
    model:
      (import.meta.env.VITE_DASHSCOPE_MODEL as string | undefined) ??
      'qwen-turbo',
    ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
    temperature: settings.textTemperature,
    keyword,
    ...common,
    ...(dashscopeChatIpc
      ? {
          invokeDashScope: (req: DashScopeTextRequest) =>
            dashscopeChatIpc({
              ...req,
              ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
            }),
        }
      : {}),
    ...(chatCompletionsUrl !== undefined ? { chatCompletionsUrl } : {}),
  })

  return chatResult
}

export function canPushNow(settings: SidekickSettings): boolean {
  const focusUntil = settings.focusSessionUntilEpochMs
  if (
    typeof focusUntil === 'number' &&
    Number.isFinite(focusUntil) &&
    Date.now() < focusUntil
  ) {
    return false
  }
  const now = new Date()
  if (
    isWithinQuietHours(now, {
      enabled: settings.pushEnabled,
      intervalMinutes: settings.pushIntervalMinutes,
      quietHoursEnabled: settings.quietHoursEnabled,
      quietStart: settings.quietStart,
      quietEnd: settings.quietEnd,
    })
  ) {
    return false
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [startHour, startMinute] = settings.pushStart.split(':').map(Number)
  const [endHour, endMinute] = settings.pushEnd.split(':').map(Number)
  const start = (startHour ?? 0) * 60 + (startMinute ?? 0)
  const end = (endHour ?? 23) * 60 + (endMinute ?? 59)

  if (start <= end) return currentMinutes >= start && currentMinutes <= end
  return currentMinutes >= start || currentMinutes <= end
}
