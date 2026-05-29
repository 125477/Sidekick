import {
  buildDashScopeModelTryOrder,
  DASHSCOPE_CHAT_FALLBACK_MODELS,
  DASHSCOPE_MAX_MODEL_ATTEMPTS_PER_CALL,
  DASHSCOPE_REGENERATE_MAX_MODEL_ATTEMPTS,
  filterLikelyChatModelIds,
  parseExtraFallbackModelsFromEnv,
} from '../constants/dashscopeFallbackModels'
import {
  markDashScopeModelUnavailable,
  prepareDashScopeModelTryOrder,
} from '../constants/dashscopeUnavailableModels'

export type DashScopeTextRequest = {
  apiKey: string | undefined
  model: string | undefined
  systemPrompt: string
  userPrompt: string
  /** 不传则 API 使用平台默认采样参数。 */
  temperature?: number
  /** Full POST URL (e.g. Vite dev `/dashscope/...` proxy). Defaults to DashScope compatible-mode Beijing. */
  chatCompletionsUrl?: string
  /**
   * 换句等交互：先 primary → env → 内置 qwen 轮换；遇 403/429 自动换下一个 model。
   * 与 `regenerateChatNoExpand` 联用：换句只走快速候选，不拉 /v1/models（与浏览器直连一致）。
   */
  quickModelFallbackOnly?: boolean
  /** 换句专用：快速候选失败后不再拉 /v1/models，直接失败走句库（避免 Electron 卡几十秒）。 */
  regenerateChatNoExpand?: boolean
  /** 主进程日志：scheduled / regenerate / manual 等 */
  copyTrigger?: string
}

type DashScopeChoice = {
  message?: {
    content?: string
  }
}

type DashScopeApiError = {
  message?: string
  type?: string
  code?: string
  param?: string | null
}

type DashScopeResponse = {
  choices?: DashScopeChoice[]
  error?: DashScopeApiError | string | null
  /** 百炼 / DashScope 顶层错误包（HTTP 200 也可能返回）。 */
  code?: string
  message?: string
  request_id?: string
}

function dashScopeTopLevelErrorCode(payload: DashScopeResponse): string | null {
  const code = typeof payload.code === 'string' ? payload.code.trim() : ''
  if (!code) return null
  const lower = code.toLowerCase()
  if (lower === 'success' || lower === 'ok') return null
  return code
}

/** 顶层 `code` + `message` 错误包（如 InternalError；HTTP 200 时也可能出现）。 */
export function dashScopeBodyHasTopLevelApiError(bodySnippet: string): boolean {
  const raw = bodySnippet.trim()
  if (!raw || raw[0] !== '{') return false
  try {
    return dashScopeTopLevelErrorCode(JSON.parse(raw) as DashScopeResponse) != null
  } catch {
    return false
  }
}

function dashScopePayloadHasError(
  payload: DashScopeResponse,
): payload is DashScopeResponse & { error: NonNullable<DashScopeResponse['error']> } {
  const err = payload.error
  if (err == null) return false
  if (typeof err === 'string') return err.trim().length > 0
  if (typeof err === 'object') return Object.keys(err).length > 0
  return false
}

/** 响应 JSON 含非空 `error` 或顶层 `code` 错误（含 HTTP 200 但 body 报错）。 */
export function dashScopeBodyHasApiError(bodySnippet: string): boolean {
  const raw = bodySnippet.trim()
  if (!raw || raw[0] !== '{') return false
  try {
    const payload = JSON.parse(raw) as DashScopeResponse
    return (
      dashScopePayloadHasError(payload) ||
      dashScopeTopLevelErrorCode(payload) != null
    )
  } catch {
    return false
  }
}

export type DashScopeHttpError = Error & {
  status: number
  bodySnippet: string
  model: string
}

export type DashScopeChatCompleteResult = {
  content: string
  model: string
  triedModels: string[]
}

const DEFAULT_COMPLETIONS_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

let cachedFetchedModelIds: string[] | null = null
let cachedFetchedAt = 0
const MODEL_LIST_CACHE_MS = 10 * 60_000

function completionsBaseUrl(chatCompletionsUrl?: string): string {
  const raw = chatCompletionsUrl?.trim()
  if (!raw) return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  return raw.replace(/\/chat\/completions\/?$/i, '')
}

export function modelsListUrl(chatCompletionsUrl?: string): string {
  return `${completionsBaseUrl(chatCompletionsUrl)}/models`
}

function isDashScope400ModelAccessError(bodySnippet: string): boolean {
  const lower = bodySnippet.toLowerCase()
  return (
    lower.includes('invalid model') ||
    lower.includes('model_not_found') ||
    lower.includes('model not found') ||
    lower.includes('does not exist') ||
    lower.includes('not exist') ||
    lower.includes('no permission') ||
    lower.includes('permission denied') ||
    lower.includes('not authorized') ||
    lower.includes('unauthorized') ||
    lower.includes('无权') ||
    lower.includes('不存在') ||
    lower.includes('模型不存在') ||
    lower.includes('无权限')
  )
}

/**
 * 额度/权限类错误：换下一个 model，并记入本地不可用缓存。
 */
export function isDashScopeQuotaOrAccessError(
  status: number,
  bodySnippet: string,
): boolean {
  if (status === 429 || status === 403) return true
  if (status === 400 && isDashScope400ModelAccessError(bodySnippet)) return true
  const lower = bodySnippet.toLowerCase()
  if (
    lower.includes('does not support http call') ||
    lower.includes('only support stream mode') ||
    lower.includes('only supports stream')
  ) {
    return true
  }
  return (
    lower.includes('quota') ||
    lower.includes('free tier') ||
    lower.includes('freetieronly') ||
    lower.includes('insufficient') ||
    lower.includes('exhausted') ||
    lower.includes('额度') ||
    lower.includes('用完') ||
    lower.includes('access denied') ||
    lower.includes('allocation')
  )
}

/**
 * 服务端瞬时故障（如 internal_error、5xx）：换下一个 model，但不记入不可用缓存。
 */
export function isDashScopeInternalOrServerError(
  status: number,
  bodySnippet: string,
): boolean {
  if (status >= 500 && status < 600) return true
  const lower = bodySnippet.toLowerCase()
  return (
    lower.includes('internal_error') ||
    lower.includes('internal error') ||
    lower.includes('internalerror') ||
    lower.includes('"code":"internal') ||
    lower.includes('service unavailable') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout')
  )
}

/** 是否应换下一个 model 重试（含额度/权限、internal_error/5xx、body.error）。 */
export function isDashScopeRetryableWithNextModel(
  status: number,
  bodySnippet: string,
): boolean {
  return (
    dashScopeBodyHasApiError(bodySnippet) ||
    isDashScopeQuotaOrAccessError(status, bodySnippet) ||
    isDashScopeInternalOrServerError(status, bodySnippet)
  )
}

function dashScopeApiErrorLabel(bodySnippet: string): string {
  try {
    const parsed = JSON.parse(bodySnippet) as DashScopeResponse
    const topCode = dashScopeTopLevelErrorCode(parsed)
    if (topCode) {
      const msg =
        typeof parsed.message === 'string' ? parsed.message.trim() : ''
      return [topCode, msg].filter(Boolean).join(': ').slice(0, 120)
    }
    const err = parsed.error
    if (typeof err === 'string') return err.slice(0, 80)
    if (err && typeof err === 'object') {
      return [err.type, err.code, err.message].filter(Boolean).join(' ').slice(0, 120)
    }
  } catch {
    /* ignore */
  }
  return 'api_error'
}

function createHttpError(
  status: number,
  bodySnippet: string,
  model: string,
): DashScopeHttpError {
  const err = new Error(
    `DashScope ${status} (model=${model})${bodySnippet ? `: ${bodySnippet.slice(0, 240)}` : ''}`,
  ) as DashScopeHttpError
  err.status = status
  err.bodySnippet = bodySnippet
  err.model = model
  return err
}

type OpenAiModelsPayload = {
  data?: Array<{ id?: string }>
}

/** 需有效 API Key；compatible-mode 支持 GET /v1/models（与 chat 同域）。 */
export async function listDashScopeChatModels(input: {
  apiKey: string | undefined
  chatCompletionsUrl?: string
  forceRefresh?: boolean
}): Promise<string[]> {
  const apiKey = input.apiKey?.trim()
  if (!apiKey) return []

  const now = Date.now()
  if (
    !input.forceRefresh &&
    cachedFetchedModelIds &&
    now - cachedFetchedAt < MODEL_LIST_CACHE_MS
  ) {
    return cachedFetchedModelIds
  }

  const url = modelsListUrl(input.chatCompletionsUrl)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) {
    return cachedFetchedModelIds ?? []
  }

  const payload = (await response.json()) as OpenAiModelsPayload
  const ids = filterLikelyChatModelIds(
    (payload.data ?? []).map((row) => String(row.id ?? '')),
  )
  cachedFetchedModelIds = ids
  cachedFetchedAt = now
  return ids
}

export async function requestDashScopeChatCompletion(
  input: DashScopeTextRequest & { model: string },
): Promise<string> {
  const apiKey = input.apiKey?.trim()
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY')

  const url = input.chatCompletionsUrl?.trim() || DEFAULT_COMPLETIONS_URL
  const model = input.model.trim()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      ...(input.temperature !== undefined && Number.isFinite(input.temperature)
        ? { temperature: input.temperature }
        : {}),
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }),
  })

  const bodyText = await response.text().catch(() => '')
  if (!response.ok) {
    throw createHttpError(response.status, bodyText, model)
  }

  let payload: DashScopeResponse
  try {
    payload = JSON.parse(bodyText) as DashScopeResponse
  } catch {
    throw new Error('Invalid JSON from DashScope')
  }
  if (dashScopePayloadHasError(payload)) {
    throw createHttpError(response.status || 500, bodyText, model)
  }
  const topLevelCode = dashScopeTopLevelErrorCode(payload)
  if (topLevelCode != null) {
    throw createHttpError(response.status || 500, bodyText, model)
  }
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) {
    if (dashScopeBodyHasApiError(bodyText)) {
      throw createHttpError(response.status || 500, bodyText, model)
    }
    throw new Error('Empty content from DashScope')
  }
  return content
}

export type RequestDashScopeTextWithFallbackOptions = {
  /** 逗号分隔的额外候选 model id（通常来自 VITE_DASHSCOPE_MODEL_FALLBACK）。 */
  envFallbackList?: string
  /** 为 true 时先拉取 /v1/models 扩充候选（需有效 Key）。 */
  fetchRemoteModelList?: boolean
}

/**
 * 按候选顺序请求；遇 body.error、403/429、额度/权限、internal_error 或 5xx 时自动换下一个 model。
 * 默认先尝试 primary + env/static，不预拉 /v1/models；仅内置候选均失败且 fetchRemoteModelList 时再扩充。
 */
export async function requestDashScopeTextWithFallback(
  input: DashScopeTextRequest,
  options: RequestDashScopeTextWithFallbackOptions = {},
): Promise<DashScopeChatCompleteResult> {
  const primary = input.model?.trim() || 'qwen-turbo'
  const envList = parseExtraFallbackModelsFromEnv(options.envFallbackList)
  const triedModels: string[] = []
  let lastErr: unknown
  const maxModelAttempts = input.regenerateChatNoExpand
    ? DASHSCOPE_REGENERATE_MAX_MODEL_ATTEMPTS
    : DASHSCOPE_MAX_MODEL_ATTEMPTS_PER_CALL

  const attemptOrder = async (
    orderExtras: {
      fetched?: string[]
      envList?: string[]
      staticList?: readonly string[]
    },
    logSkippedCached: boolean,
  ): Promise<DashScopeChatCompleteResult | null> => {
    const fullOrder = buildDashScopeModelTryOrder(primary, orderExtras)
    const tryOrder = prepareDashScopeModelTryOrder(fullOrder).filter(
      (m) => !triedModels.includes(m),
    )
    if (logSkippedCached) {
      const skippedCached = fullOrder.length - prepareDashScopeModelTryOrder(fullOrder).length
      if (
        skippedCached > 0 &&
        typeof console !== 'undefined' &&
        console.info
      ) {
        console.info(
          `[sidekick] DashScope 跳过 ${skippedCached} 个本地记录的无额度/不可用模型`,
        )
      }
    }
    for (const model of tryOrder) {
      if (triedModels.length >= maxModelAttempts) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[sidekick] DashScope 已达单次 model 尝试上限 ${maxModelAttempts}，停止轮换（已试: ${triedModels.join(', ') || '无'}）`,
          )
        }
        break
      }
      triedModels.push(model)
      const attemptStarted = Date.now()
      try {
        const content = await requestDashScopeChatCompletion({
          ...input,
          model,
        })
        if (typeof console !== 'undefined' && console.info) {
          console.info(
            `[sidekick] DashScope model=${model} 成功 (${Date.now() - attemptStarted}ms)`,
          )
        }
        return { content, model, triedModels: [...triedModels] }
      } catch (err) {
        lastErr = err
        const status =
          err && typeof err === 'object' && 'status' in err
            ? Number((err as DashScopeHttpError).status)
            : 0
        const bodySnippet =
          err && typeof err === 'object' && 'bodySnippet' in err
            ? String((err as DashScopeHttpError).bodySnippet ?? '')
            : err instanceof Error
              ? err.message
              : ''
        if (!isDashScopeRetryableWithNextModel(status, bodySnippet)) {
          throw err
        }
        if (isDashScopeQuotaOrAccessError(status, bodySnippet)) {
          markDashScopeModelUnavailable(model)
        }
        if (typeof console !== 'undefined' && console.warn) {
          const reason = dashScopeBodyHasApiError(bodySnippet)
            ? dashScopeApiErrorLabel(bodySnippet)
            : isDashScopeInternalOrServerError(status, bodySnippet)
              ? 'internal_error/5xx'
              : isDashScopeQuotaOrAccessError(status, bodySnippet)
                ? 'quota/access'
                : 'retryable'
          const cacheNote = isDashScopeQuotaOrAccessError(status, bodySnippet)
            ? '，已记入不可用缓存'
            : '，尝试下一个'
          console.warn(
            `[sidekick] DashScope model=${model} 失败 (${Date.now() - attemptStarted}ms, ${reason})${cacheNote}`,
          )
        }
      }
    }
    return null
  }

  const quickResult = await attemptOrder(
    {
      ...(envList.length > 0 ? { envList } : {}),
      staticList: DASHSCOPE_CHAT_FALLBACK_MODELS,
    },
    true,
  )
  if (quickResult) return quickResult

  const expandFromRemoteList =
    options.fetchRemoteModelList !== false &&
    input.regenerateChatNoExpand !== true

  if (expandFromRemoteList) {
    const fetched = await listDashScopeChatModels({
      apiKey: input.apiKey,
      ...(input.chatCompletionsUrl !== undefined
        ? { chatCompletionsUrl: input.chatCompletionsUrl }
        : {}),
    })
    if (fetched.length > 0) {
      if (typeof console !== 'undefined' && console.info) {
        console.info(
          `[sidekick] DashScope 内置候选均失败，已从 /v1/models 加载 ${fetched.length} 个扩充模型`,
        )
      }
      const expandedResult = await attemptOrder(
        {
          fetched,
          ...(envList.length > 0 ? { envList } : {}),
          staticList: DASHSCOPE_CHAT_FALLBACK_MODELS,
        },
        false,
      )
      if (expandedResult) return expandedResult
    } else if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        '[sidekick] DashScope /v1/models 未返回列表，无法扩充候选',
      )
    }
  }

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[sidekick] DashScope 全部候选模型均失败（已尝试 ${triedModels.length} 个: ${triedModels.join(', ') || '无'}）；不可用列表已保留，下次将跳过已标记模型`,
    )
  }

  const msg =
    lastErr instanceof Error
      ? lastErr.message
      : 'DashScope 所有候选模型均不可用'
  const exhausted = new Error(
    `${msg}（已依次尝试 ${triedModels.length} 个模型，可能免费额度均已用尽）`,
  )
  ;(exhausted as Error & { triedModels?: string[] }).triedModels = triedModels
  throw exhausted
}

/** @deprecated 请用 requestDashScopeTextWithFallback；保留兼容单次调用。 */
export async function requestDashScopeText(
  input: DashScopeTextRequest,
): Promise<string> {
  const result = await requestDashScopeTextWithFallback(input, {
    fetchRemoteModelList: false,
  })
  return result.content
}
