import {
  companionAgentLineRejected,
  companionAgentLineStructurallyRejected,
  companionInterestTagsRequireQuote,
  companionLineDuplicateOfStoredHistory,
  companionLineDuplicateOfReplaceTarget,
  companionLineExactDuplicateInList,
  companionRegenerateLineFailsInterestQuoteMode,
  companionStyleForEmotion,
  generateCompanionCopy,
  generateCompanionCopyViaAgent,
  isWithinQuietHours,
  logCompanionRegenerate,
  logCompanionCopy,
  parseCompanionInterestTags,
  pickCompanionRegenerateLineDistinct,
  pickCompanionRegenerateLine,
  pickCompanionInterestRegenerateLine,
  pickCompanionTriggerFallback,
  type CompanionCopyTrigger,
  type CompanionTextResult,
  type DashScopeTextRequest,
  type EmotionKind,
} from '@sidekick/core'
import { broadcastSettingsSync } from '../state/settingsSync'
import { saveSettings } from '../state/settingsStorage'
import type { SidekickSettings } from '../state/settingsState'
import { getCompanionLightFeedbackHints } from './companionLightFeedbackStorage'
import { pickFavoriteResurfaceLine } from './favoriteResurface'
import {
  beginCompanionFetch,
  markCompanionStartupFetchSucceeded,
  type CompanionFetchKind,
} from './companionFetchCoordinator'
import { markStartupCompanionCopyFinished } from './companionSessionBoot'
import { buildCompanionAvoidContext } from './recentCompanionLines'

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
  /** 换一句时屏幕上正在展示的原句（仅用于判重复，不扩写 avoid 误杀）。 */
  replaceTargetLine?: string
  /** 仅启动首句写入 45s merge 窗口（定时 interval 勿设）。 */
  markStartupMerge?: boolean
  /** 定时 interval 等 recurring 请求跳过 merge 窗口。 */
  skipStartupMerge?: boolean
}

export type FetchCompanionCopyResult = CompanionTextResult & {
  sessionId?: string | null
  /** 并发换句被 gate 跳过：勿上屏、勿 notify 假文案。 */
  skipped?: boolean
  /** 收藏再现来源 id；上屏后须 recordFavoriteResurfaceShown。 */
  resurfaceFavoriteId?: string
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

function shouldUseBailianAgentForRequest(
  settings: SidekickSettings,
  trigger: CompanionCopyTrigger,
): boolean {
  if (!shouldUseBailianAgent(settings)) return false
  // 换句/类似：只走 chat/completions 并在同接口轮换 model，避免 completion + completions 双请求
  if (trigger === 'regenerate' || trigger === 'similar') return false
  return true
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

/** 换句：百炼 Agent 最多 2 次（首句 + 同骨架重试）；chat 回退同策略。 */
const INTERACTIVE_REGENERATE_MAX_QUALITY_RETRIES = 0
const INTERACTIVE_OTHER_MAX_QUALITY_RETRIES = 1

function resolveMaxQualityRetries(
  trigger: CompanionCopyTrigger,
  fetchKind: CompanionFetchKind,
  explicit?: number,
): number | undefined {
  if (typeof explicit === 'number') return explicit
  if (fetchKind === 'startup' || trigger === 'scheduled') return 1
  if (trigger === 'regenerate' || trigger === 'similar') {
    return INTERACTIVE_REGENERATE_MAX_QUALITY_RETRIES
  }
  if (trigger === 'manual' || trigger === 'emotion') {
    return INTERACTIVE_OTHER_MAX_QUALITY_RETRIES
  }
  return undefined
}

function trimFallbackLine(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxChars - 1))}…`
}

/** interactive 非换句场景禁止 Agent 失败后再打 chat；定时推送须走 chat。 */
function shouldSkipChatFallbackForTrigger(
  trigger: CompanionCopyTrigger,
  fetchKind: CompanionFetchKind,
): boolean {
  if (trigger === 'regenerate' || trigger === 'similar') return false
  if (trigger === 'scheduled') return false
  return fetchKind === 'interactive'
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
let interactiveAgentChain: Promise<unknown> = Promise.resolve()

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
  const isRegenerateLike =
    trigger === 'regenerate' || trigger === 'similar'

  const execute = async (): Promise<FetchCompanionCopyResult> => {
    const gate = beginCompanionFetch(fetchKind, {
      bypassInteractiveDebounce: isRegenerateLike,
      skipStartupMerge: options?.skipStartupMerge === true,
    })
    if (!gate.proceed) {
      if (isRegenerateLike) {
        logCompanionRegenerate('fetchCompanionCopy gate skipped (in flight)', {
          fetchKind,
          trigger,
          replaceTargetLine: options?.replaceTargetLine,
        })
        return {
          text: '',
          source: 'fallback',
          skipped: true,
        }
      }
      logCompanionCopy('fetch skipped (gate busy)', { trigger, fetchKind })
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
      if (options?.markStartupMerge && fetchKind === 'startup' && result.text.trim()) {
        markCompanionStartupFetchSucceeded()
        markStartupCompanionCopyFinished()
      }
      return result
    } finally {
      gate.release()
    }
  }

  if (fetchKind === 'interactive' && !isRegenerateLike) {
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

function mergeCompanionAvoidForPool(
  promptAvoid: string[],
  allHistoryLines: string[],
): string[] {
  return [...new Set([...promptAvoid, ...allHistoryLines].filter(Boolean))]
}

function ensureDistinctPushFallback(
  text: string,
  avoidForPool: string[],
  settings: SidekickSettings,
  emotion: EmotionKind | undefined,
  generationSeed: number,
): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (
    !avoidForPool.length ||
    !companionLineExactDuplicateInList(normalized, avoidForPool)
  ) {
    return text
  }
  const style =
    emotion != null ? companionStyleForEmotion(emotion) : settings.textStyle
  for (let i = 0; i < 16; i++) {
    const line = pickCompanionRegenerateLine({
      maxChars: settings.textMaxChars,
      style,
      seed: generationSeed + i * 1_048_583,
      avoidRecent: avoidForPool,
    })
    if (!companionLineExactDuplicateInList(line, avoidForPool)) return line
  }
  return text
}

function pickPushCopyFallback(
  settings: SidekickSettings,
  trigger: CompanionCopyTrigger,
  emotion: EmotionKind | undefined,
  promptAvoid: string[],
  allHistoryLines: string[],
  generationSeed: number,
): string {
  const style =
    emotion != null ? companionStyleForEmotion(emotion) : settings.textStyle
  const { tags: interestTags } = parseCompanionInterestTags(
    settings.companionInterests,
  )
  const avoidForPool = mergeCompanionAvoidForPool(promptAvoid, allHistoryLines)
  if (companionInterestTagsRequireQuote(interestTags)) {
    return ensureDistinctPushFallback(
      pickCompanionInterestRegenerateLine({
        interestTags,
        maxChars: settings.textMaxChars,
        style,
        seed: generationSeed,
        ...(avoidForPool.length ? { avoidRecent: avoidForPool } : {}),
      }),
      avoidForPool,
      settings,
      emotion,
      generationSeed,
    )
  }
  return ensureDistinctPushFallback(
    pickCompanionTriggerFallback(trigger, {
      maxChars: settings.textMaxChars,
      seed: generationSeed,
      ...(avoidForPool.length ? { avoidRecent: avoidForPool } : {}),
    }),
    avoidForPool,
    settings,
    emotion,
    generationSeed,
  )
}

function pushCompanionLineRejected(
  text: string,
  settings: SidekickSettings,
  emotion: EmotionKind | undefined,
  promptAvoid: string[],
  allHistoryLines: string[],
): boolean {
  const style =
    emotion != null ? companionStyleForEmotion(emotion) : settings.textStyle
  const gateCtx = {
    style,
    maxChars: settings.textMaxChars,
    avoidRecent: promptAvoid,
    now: new Date(),
  }
  const { tags: interestTags } = parseCompanionInterestTags(
    settings.companionInterests,
  )
  if (companionAgentLineStructurallyRejected(text, gateCtx)) return true
  if (
    companionInterestTagsRequireQuote(interestTags) &&
    companionRegenerateLineFailsInterestQuoteMode(text)
  ) {
    return true
  }
  if (
    companionLineDuplicateOfStoredHistory(text, allHistoryLines, promptAvoid)
  ) {
    return true
  }
  return companionAgentLineRejected(text, gateCtx)
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
  const { promptAvoid, allHistoryLines } =
    await buildCompanionAvoidContext(avoidRecentOutputs)
  const generationSeed =
    options?.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))

  const resurfacePick = await pickFavoriteResurfaceLine(
    settings.favoriteResurfaceEnabled,
    trigger,
    mergeCompanionAvoidForPool(promptAvoid, allHistoryLines),
    { skipForStartup: fetchKind === 'startup' },
  )
  if (resurfacePick) {
    logCompanionCopy('favorite resurface', {
      trigger,
      text: resurfacePick.text.slice(0, 40),
      favoriteId: resurfacePick.favoriteId,
    })
    return {
      text: resurfacePick.text,
      source: 'fallback' as const,
      resurfaceFavoriteId: resurfacePick.favoriteId,
    }
  }

  const common = {
    style: settings.textStyle,
    allowEmoji: settings.allowEmoji,
    maxChars: settings.textMaxChars,
    seed: generationSeed,
    ...(keyword !== undefined ? { keyword } : {}),
    ...(emotion !== undefined ? { emotion } : {}),
    ...(promptAvoid.length ? { avoidRecentOutputs: promptAvoid } : {}),
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

  if (shouldUseBailianAgentForRequest(settings, trigger) && appId) {
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
        ...(options?.replaceTargetLine != null
          ? { replaceTargetLine: options.replaceTargetLine }
          : {}),
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
        const gateCtx = {
          style,
          maxChars: settings.textMaxChars,
          avoidRecent: promptAvoid,
          now: new Date(),
        }
        const replaceTarget = options?.replaceTargetLine?.trim()
        const duplicateOnly =
          fetchKind === 'interactive' &&
          companionLineDuplicateOfReplaceTarget(agentText, replaceTarget)
        const structureRejected =
          companionAgentLineStructurallyRejected(agentText, gateCtx)
        const { tags: interestTags } = parseCompanionInterestTags(
          settings.companionInterests,
        )
        const interestQuoteRejected =
          companionInterestTagsRequireQuote(interestTags) &&
          companionRegenerateLineFailsInterestQuoteMode(agentText)

        if (fetchKind === 'interactive') {
          if (duplicateOnly && typeof console !== 'undefined') {
            console.warn(
              '[sidekick] 百炼句仍与当前气泡重复（已 Agent 重试），展示最后一次 API 返回：',
              agentText,
            )
          } else if (structureRejected && typeof console !== 'undefined') {
            console.warn(
              '[sidekick] 百炼句结构质检未过，仍展示最后一次 API 返回：',
              agentText,
            )
          }
          return {
            text: agentText,
            source: agentResult.source,
            sessionId: agentResult.sessionId,
          }
        }
        if (
          !interestQuoteRejected &&
          !pushCompanionLineRejected(
            agentText,
            settings,
            emotion,
            promptAvoid,
            allHistoryLines,
          )
        ) {
          return {
            text: agentText,
            source: agentResult.source,
            sessionId: agentResult.sessionId,
          }
        }
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            '[sidekick] 百炼首句质检未过，回退 chat/completions',
            structureRejected
              ? '结构套句'
              : interestQuoteRejected
                ? '未写兴趣金句'
                : companionLineDuplicateOfStoredHistory(
                    agentText,
                    allHistoryLines,
                    promptAvoid,
                  )
                  ? '与历史句重复'
                  : '与最近句过近',
            agentText.slice(0, 48),
          )
        }
      } else if (typeof console !== 'undefined' && console.warn) {
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
    const avoidForPool = mergeCompanionAvoidForPool(promptAvoid, allHistoryLines)
    const fallbackText = trimFallbackLine(
      pickCompanionTriggerFallback(trigger, {
        maxChars: settings.textMaxChars,
        seed: generationSeed,
        ...(avoidForPool.length ? { avoidRecent: avoidForPool } : {}),
      }),
      settings.textMaxChars,
    )
    logCompanionCopy('fetch done (pool fallback)', {
      trigger,
      fetchKind,
      reason: 'skip-chat-interactive',
      text: fallbackText.slice(0, 120),
    })
    return {
      text: fallbackText,
      source: 'fallback',
    }
  }

  /** 换句/类似：优先 Electron IPC（同 completions 接口轮换 model）；无 IPC 时走渲染进程直连。 */
  const chatViaRenderer =
    (trigger === 'regenerate' || trigger === 'similar') &&
    !dashscopeChatIpc &&
    Boolean(apiKey?.trim())

  if (trigger === 'regenerate' || trigger === 'similar') {
    logCompanionRegenerate('fetchCompanionCopy route', {
      trigger,
      chatViaRenderer,
      hasDashscopeChatIpc: Boolean(dashscopeChatIpc),
      hasBailianAgent: shouldUseBailianAgentForRequest(settings, trigger),
      replaceTargetLine: options?.replaceTargetLine,
      seed: generationSeed,
      avoidCount: promptAvoid.length,
      historyCount: allHistoryLines.length,
    })
  }

  let chatCompletionsUrl: string | undefined
  if (chatViaRenderer || !dashscopeChatIpc) {
    const base = dashscopeRequestBase()
    if (base) {
      chatCompletionsUrl = `${base}/compatible-mode/v1/chat/completions`
    }
  }

  const modelFallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
    | string
    | undefined
  const modelIgnoreEnv = import.meta.env.VITE_DASHSCOPE_MODEL_IGNORE as
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
    ...(modelIgnoreEnv !== undefined ? { modelIgnoreEnv } : {}),
    keyword,
    ...common,
    ...(chatMaxQualityRetries !== undefined
      ? { maxQualityRetries: chatMaxQualityRetries }
      : {}),
    ...(options?.replaceTargetLine != null
      ? { replaceTargetLine: options.replaceTargetLine }
      : {}),
    ...(dashscopeChatIpc && !chatViaRenderer
      ? {
          invokeDashScope: (req: DashScopeTextRequest) =>
            dashscopeChatIpc({
              ...req,
              copyTrigger: trigger,
              ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
              ...(modelIgnoreEnv !== undefined ? { modelIgnoreEnv } : {}),
            }),
        }
      : {}),
    ...(chatCompletionsUrl !== undefined ? { chatCompletionsUrl } : {}),
  })

  const chatText = chatResult.text.trim()
  if (chatText) {
    if (
      fetchKind !== 'interactive' &&
      pushCompanionLineRejected(
        chatText,
        settings,
        emotion,
        promptAvoid,
        allHistoryLines,
      )
    ) {
      const fallbackText = trimFallbackLine(
        pickPushCopyFallback(
          settings,
          trigger,
          emotion,
          promptAvoid,
          allHistoryLines,
          generationSeed,
        ),
        settings.textMaxChars,
      )
      logCompanionCopy('fetch done (push fallback after chat reject)', {
        trigger,
        fetchKind,
        rejected: chatText.slice(0, 48),
        text: fallbackText.slice(0, 120),
      })
      return {
        text: fallbackText,
        source: 'fallback',
      }
    }
    return chatResult
  }

  if (fetchKind === 'interactive') {
    const avoidForPool = mergeCompanionAvoidForPool(promptAvoid, allHistoryLines)
    const poolPick =
      trigger === 'regenerate' || trigger === 'similar'
        ? pickCompanionRegenerateLineDistinct({
            maxChars: settings.textMaxChars,
            style: settings.textStyle,
            seed: generationSeed,
            ...(avoidForPool.length ? { avoidRecent: avoidForPool } : {}),
            ...(options?.replaceTargetLine != null
              ? { mustDifferFrom: options.replaceTargetLine }
              : {}),
          })
        : pickCompanionTriggerFallback(trigger, {
            maxChars: settings.textMaxChars,
            seed: generationSeed,
            ...(avoidForPool.length ? { avoidRecent: avoidForPool } : {}),
            ...(options?.replaceTargetLine != null
              ? { replaceTarget: options.replaceTargetLine }
              : {}),
          })
    const fallbackText = trimFallbackLine(poolPick, settings.textMaxChars)
    logCompanionCopy('fetch done (pool fallback)', {
      trigger,
      fetchKind,
      reason: 'chat-empty-or-rejected',
      text: fallbackText.slice(0, 120),
    })
    return {
      text: fallbackText,
      source: 'fallback',
    }
  }

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
