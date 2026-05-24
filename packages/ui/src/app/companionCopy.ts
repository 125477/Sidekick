import {
  companionAgentLineRejected,
  companionStyleForEmotion,
  generateCompanionCopy,
  generateCompanionCopyViaAgent,
  isWithinQuietHours,
  pickCompanionTriggerFallback,
  sanitizeRecentCompanionLinesForPrompt,
  type CompanionCopyTrigger,
  type CompanionTextResult,
  type DashScopeTextRequest,
  type EmotionKind,
} from '@sidekick/core'
import { broadcastSettingsSync } from '../state/settingsSync'
import { saveSettings } from '../state/settingsStorage'
import type { SidekickSettings } from '../state/settingsState'
import { getCompanionLightFeedbackHints } from './companionLightFeedbackStorage'
import {
  beginCompanionFetch,
  markCompanionStartupFetchSucceeded,
  type CompanionFetchKind,
} from './companionFetchCoordinator'
import { markStartupCompanionCopyFinished } from './companionSessionBoot'

export type FetchCompanionCopyOptions = {
  trigger?: CompanionCopyTrigger
  yesterdayContextText?: string | null
  momentContextText?: string | null
  similarToLine?: string | null
  /** 用户主动换句/类似这句等为 interactive；定时/昨日问候等为 startup。 */
  fetchKind?: CompanionFetchKind
  /** startup 时限制套句重试（默认 0，仅 1 次 completion）。 */
  maxQualityRetries?: number
  /** 驱动 writing_angle 与多样性；换句建议传入 Date.now()。 */
  seed?: number
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

/** 陪伴短句改为每轮无 session 调用，不再持久化百炼 session（避免多轮记忆锁死格言腔）。 */
export async function persistBailianAgentSessionId(
  settingsRef: { current: SidekickSettings },
  _sessionId: string | null | undefined,
): Promise<void> {
  if (!settingsRef.current.bailianAgentSessionId) return
  const next: SidekickSettings = {
    ...settingsRef.current,
    bailianAgentSessionId: null,
  }
  settingsRef.current = next
  await saveSettings(next)
  broadcastSettingsSync()
}

/** 用户点「换一句」等：不做套句校验连环重试（否则一次点击会打多次 completion）。 */
function resolveMaxQualityRetries(
  trigger: CompanionCopyTrigger,
  fetchKind: CompanionFetchKind,
  explicit?: number,
): number | undefined {
  if (typeof explicit === 'number') return explicit
  if (fetchKind === 'startup' || trigger === 'scheduled') return 0
  if (
    trigger === 'regenerate' ||
    trigger === 'similar' ||
    trigger === 'manual' ||
    trigger === 'emotion'
  ) {
    return 0
  }
  return undefined
}

function trimFallbackLine(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxChars - 1))}…`
}

/** 换一句/类似这句等：不再改走 chat（易与 Network 里 agent 预览不一致，且同样套句）。 */
function shouldSkipChatFallbackForTrigger(
  trigger: CompanionCopyTrigger,
  fetchKind: CompanionFetchKind,
): boolean {
  if (fetchKind === 'interactive') return true
  return (
    trigger === 'regenerate' ||
    trigger === 'similar' ||
    trigger === 'manual' ||
    trigger === 'emotion'
  )
}

function resolveFetchKind(
  trigger: CompanionCopyTrigger,
  explicit?: CompanionFetchKind,
): CompanionFetchKind {
  if (explicit) return explicit
  if (
    trigger === 'regenerate' ||
    trigger === 'similar' ||
    trigger === 'manual' ||
    trigger === 'emotion'
  ) {
    return 'interactive'
  }
  return 'startup'
}

/** 同一渲染进程内：交互换句并发调用串行化（不同 prompt 不共用同一次 HTTP 结果）。 */
let interactiveFetchInFlight: Promise<FetchCompanionCopyResult> | null = null
let lastRegenerateStartedMs = 0
let interactiveAgentChain: Promise<unknown> = Promise.resolve()
const REGENERATE_MIN_INTERVAL_MS = 2500

function invokeAgentSingleFlight(
  ipc: (payload: {
    apiKey: string | undefined
    appId: string
    prompt: string
    userPromptParams: Record<string, string>
  }) => Promise<{ text: string; sessionId: string | null }>,
  payload: {
    apiKey: string | undefined
    appId: string
    prompt: string
    userPromptParams: Record<string, string>
  },
): Promise<{ text: string; sessionId: string | null }> {
  const run = interactiveAgentChain.then(() => ipc(payload))
  interactiveAgentChain = run.catch(() => {})
  return run
}

export async function fetchCompanionCopy(
  settings: SidekickSettings,
  keyword?: string,
  emotion?: EmotionKind,
  avoidRecentOutputs?: string[],
  options?: FetchCompanionCopyOptions,
): Promise<FetchCompanionCopyResult> {
  const trigger = resolveFetchTrigger(keyword, emotion, options?.trigger)
  const fetchKind = resolveFetchKind(trigger, options?.fetchKind)

  if (fetchKind === 'interactive' && trigger === 'regenerate') {
    const now = Date.now()
    if (now - lastRegenerateStartedMs < REGENERATE_MIN_INTERVAL_MS) {
      return { text: '', source: 'fallback' }
    }
    lastRegenerateStartedMs = now
  }

  const execute = async (): Promise<FetchCompanionCopyResult> => {
    const gate = beginCompanionFetch(fetchKind)
    if (!gate.proceed) {
      return { text: '', source: 'fallback' }
    }
    try {
      const result = await fetchCompanionCopyInner(
        settings,
        keyword,
        emotion,
        avoidRecentOutputs,
        { ...options, trigger, fetchKind },
      )
      if (fetchKind === 'startup' && result.text.trim()) {
        markCompanionStartupFetchSucceeded()
        markStartupCompanionCopyFinished()
      }
      return result
    } finally {
      gate.release()
    }
  }

  if (fetchKind === 'interactive') {
    if (interactiveFetchInFlight) {
      return interactiveFetchInFlight
    }
    interactiveFetchInFlight = execute().finally(() => {
      interactiveFetchInFlight = null
    })
    return interactiveFetchInFlight
  }

  return execute()
}

async function fetchCompanionCopyInner(
  settings: SidekickSettings,
  keyword?: string,
  emotion?: EmotionKind,
  avoidRecentOutputs?: string[],
  options?: FetchCompanionCopyOptions & { trigger: CompanionCopyTrigger },
): Promise<FetchCompanionCopyResult> {
  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined
  const appId = bailianAppIdFromEnv()
  const trigger = options?.trigger ?? resolveFetchTrigger(keyword, emotion)
  const fetchKind = resolveFetchKind(trigger, options?.fetchKind)
  const lightHints = getCompanionLightFeedbackHints()
  const sanitizedAvoid = sanitizeRecentCompanionLinesForPrompt(avoidRecentOutputs)
  const generationSeed =
    options?.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const common = {
    style: settings.textStyle,
    allowEmoji: settings.allowEmoji,
    maxChars: settings.textMaxChars,
    seed: generationSeed,
    ...(keyword !== undefined ? { keyword } : {}),
    ...(emotion !== undefined ? { emotion } : {}),
    ...(sanitizedAvoid.length ? { avoidRecentOutputs: sanitizedAvoid } : {}),
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
      // 每轮独立 completion，不传 session_id，避免百炼多轮记忆锁死同一「格言腔」
      const maxQualityRetries = resolveMaxQualityRetries(
        trigger,
        fetchKind,
        options?.maxQualityRetries,
      )
      const agentResult = await generateCompanionCopyViaAgent({
        apiKey,
        appId,
        ...common,
        ...(maxQualityRetries !== undefined ? { maxQualityRetries } : {}),
        ...(dashscopeAgentIpc
          ? {
              invokeAgent: (payload) =>
                invokeAgentSingleFlight(
                  (p) =>
                    dashscopeAgentIpc({
                      apiKey,
                      appId: p.appId,
                      prompt: p.prompt,
                      userPromptParams: p.userPromptParams,
                    }),
                  {
                    apiKey,
                    appId: payload.appId,
                    prompt: payload.prompt,
                    userPromptParams: payload.userPromptParams,
                  },
                ),
            }
          : {}),
        ...(requestBasePath !== undefined ? { requestBasePath } : {}),
      })
      const agentText = agentResult.text.trim()
      if (agentText) {
        const style =
          emotion != null
            ? companionStyleForEmotion(emotion)
            : settings.textStyle
        if (
          companionAgentLineRejected(agentText, {
            style,
            maxChars: settings.textMaxChars,
            avoidRecent: sanitizedAvoid,
            now: new Date(),
          }) &&
          typeof console !== 'undefined'
        ) {
          console.warn(
            '[sidekick] 百炼返回套句/与最近句过近（仍展示该次 API 原文，未自动重试）：',
            agentText,
          )
        }
        return {
          text: agentText,
          source: agentResult.source,
          sessionId: agentResult.sessionId,
        }
      }
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[sidekick] 百炼智能体返回空文案')
      }
    } catch (err) {
      if (shouldSkipChatFallbackForTrigger(trigger, fetchKind)) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[sidekick] 百炼智能体失败，交互场景使用本地 trigger 兜底（不走 chat）',
            err instanceof Error ? err.message : err,
          )
        }
        return {
          text: trimFallbackLine(
            pickCompanionTriggerFallback(trigger),
            settings.textMaxChars,
          ),
          source: 'fallback',
        }
      }
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[sidekick] 百炼智能体失败，回退 chat/completions',
          err instanceof Error ? err.message : err,
        )
      }
    }
  }

  if (shouldSkipChatFallbackForTrigger(trigger, fetchKind)) {
    return {
      text: trimFallbackLine(
        pickCompanionTriggerFallback(trigger),
        settings.textMaxChars,
      ),
      source: 'fallback',
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

  const chatMaxQualityRetries = resolveMaxQualityRetries(
    trigger,
    fetchKind,
    options?.maxQualityRetries,
  )
  const chatResult = await generateCompanionCopy({
    apiKey,
    model:
      (import.meta.env.VITE_DASHSCOPE_MODEL as string | undefined) ??
      'qwen-turbo',
    ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
    keyword,
    ...common,
    ...(chatMaxQualityRetries !== undefined
      ? { maxQualityRetries: chatMaxQualityRetries }
      : {}),
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
