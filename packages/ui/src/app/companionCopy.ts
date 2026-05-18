import {
  generateCompanionCopy,
  isWithinQuietHours,
  type DashScopeTextRequest,
  type EmotionKind,
} from '@sidekick/core'
import { getCompanionLightFeedbackHints } from './companionLightFeedbackStorage'
import type { SidekickSettings } from '../state/settingsState'
export async function fetchCompanionCopy(
  settings: SidekickSettings,
  keyword?: string,
  emotion?: EmotionKind,
  avoidRecentOutputs?: string[],
) {
  const dashscopeIpc =
    typeof window !== 'undefined'
      ? window.sidekickDesktop?.dashscopeChat
      : undefined

  /** DashScope blocks browser/renderer CORS; dev uses Vite proxy; Electron uses main IPC. */
  let chatCompletionsUrl: string | undefined
  if (!dashscopeIpc && import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      chatCompletionsUrl = `${window.location.origin}/dashscope/compatible-mode/v1/chat/completions`
    }
  }

  const modelFallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
    | string
    | undefined

  return generateCompanionCopy({
    apiKey: import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined,
    model:
      (import.meta.env.VITE_DASHSCOPE_MODEL as string | undefined) ??
      'qwen-turbo',
    ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
    style: settings.textStyle,
    keyword,
    allowEmoji: settings.allowEmoji,
    maxChars: settings.textMaxChars,
    temperature: settings.textTemperature,
    ...(emotion !== undefined ? { emotion } : {}),
    ...(avoidRecentOutputs?.length ? { avoidRecentOutputs } : {}),
    ...(settings.companionInterests?.length
      ? { companionInterests: settings.companionInterests }
      : {}),
    ...(getCompanionLightFeedbackHints().length
      ? { companionLightFeedbackHints: getCompanionLightFeedbackHints() }
      : {}),
    ...(dashscopeIpc
      ? {
          invokeDashScope: (req: DashScopeTextRequest) =>
            dashscopeIpc({
              ...req,
              ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
            }),
        }
      : {}),
    ...(chatCompletionsUrl !== undefined ? { chatCompletionsUrl } : {}),
  })
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
