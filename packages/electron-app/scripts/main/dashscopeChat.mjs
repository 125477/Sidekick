/**
 * 主进程 DashScope 文案：body.error、403/429、internal_error/5xx 时按候选 model 自动切换。
 * 不可用 model 持久化见 dashscopeUnavailableModels.mjs。
 */

import {
  markDashScopeModelUnavailable,
  prepareDashScopeModelTryOrder,
} from './dashscopeUnavailableModels.mjs'
import {
  getCachedDashScopeModelList,
  saveDashScopeModelListCache,
} from './dashscopeModelListCache.mjs'
import {
  getDashScopePreferredModel,
  saveDashScopePreferredModel,
} from './dashscopePreferredModel.mjs'

const DEFAULT_COMPLETIONS_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

/** 仅 /v1/models 拉取失败时使用；正常情况用接口返回的 100+ 模型。 */
const STATIC_FALLBACK = ['qwen-turbo', 'qwen-plus', 'qwen-max']

/** 内置快速候选最多尝试数；/v1/models 扩充列表不设上限。 */
const MAX_QUICK_MODEL_ATTEMPTS = 12
/** /v1/models 扩充后尝试全部 chat 模型（不设单次上限）。 */
const MAX_EXPANDED_MODEL_ATTEMPTS = Number.POSITIVE_INFINITY

let cachedModelIds = null
let cachedAt = 0
const CACHE_MS = 10 * 60_000

function is400ModelAccess(body) {
  const lower = String(body).toLowerCase()
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

function completionsBaseUrl(chatCompletionsUrl) {
  if (!chatCompletionsUrl?.trim()) {
    return 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  }
  return chatCompletionsUrl.trim().replace(/\/chat\/completions\/?$/i, '')
}

function isQuotaOrAccess(status, body) {
  if (status === 429 || status === 403) return true
  if (status === 400 && is400ModelAccess(body)) return true
  const lower = String(body).toLowerCase()
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

function isInternalOrServerError(status, body) {
  if (status >= 500 && status < 600) return true
  const lower = String(body).toLowerCase()
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

function bodyHasTopLevelApiError(body) {
  const raw = String(body ?? '').trim()
  if (!raw || raw[0] !== '{') return false
  try {
    const code = JSON.parse(raw).code
    if (typeof code !== 'string' || !code.trim()) return false
    const lower = code.trim().toLowerCase()
    return lower !== 'success' && lower !== 'ok'
  } catch {
    return false
  }
}

function bodyHasApiError(body) {
  const raw = String(body ?? '').trim()
  if (!raw || raw[0] !== '{') return false
  try {
    if (bodyHasTopLevelApiError(body)) return true
    const err = JSON.parse(raw).error
    if (err == null) return false
    if (typeof err === 'string') return err.trim().length > 0
    if (typeof err === 'object') return Object.keys(err).length > 0
    return false
  } catch {
    return false
  }
}

function apiErrorLabel(body) {
  try {
    const parsed = JSON.parse(String(body))
    if (typeof parsed.code === 'string' && parsed.code.trim()) {
      const msg =
        typeof parsed.message === 'string' ? parsed.message.trim() : ''
      return [parsed.code.trim(), msg].filter(Boolean).join(': ').slice(0, 120)
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

function shouldTryNextModel(status, body) {
  return (
    bodyHasApiError(body) ||
    isQuotaOrAccess(status, body) ||
    isInternalOrServerError(status, body)
  )
}

function filterChatIds(ids) {
  const out = []
  const seen = new Set()
  for (const raw of ids) {
    const id = String(raw).trim()
    if (!id || seen.has(id)) continue
    const lower = id.toLowerCase()
    if (
      lower.includes('embedding') ||
      lower.includes('tts') ||
      lower.includes('cosyvoice') ||
      lower.includes('whisper') ||
      lower.includes('stable-diffusion') ||
      lower.includes('wanx') ||
      lower.includes('image') ||
      lower.includes('video-generation')
    ) {
      continue
    }
    seen.add(id)
    out.push(id)
  }
  return out
}

function buildTryOrder(primary, fetched, envList, preferredModel) {
  const order = []
  const seen = new Set()
  const push = (id) => {
    const m = String(id ?? '').trim()
    if (!m || seen.has(m)) return
    seen.add(m)
    order.push(m)
  }
  push(preferredModel)
  push(primary)
  for (const id of envList ?? []) push(id)
  for (const id of fetched ?? []) push(id)
  for (const id of STATIC_FALLBACK) push(id)
  return order
}

function parseEnvList(raw) {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseEnvFallback(raw) {
  return parseEnvList(raw)
}

function parseEnvIgnore(raw) {
  return parseEnvList(raw)
}

function isModelIgnored(modelId, ignoreList) {
  const id = String(modelId ?? '').trim()
  if (!id || ignoreList.length === 0) return false
  const lower = id.toLowerCase()
  for (const raw of ignoreList) {
    const token = String(raw).trim().toLowerCase()
    if (!token) continue
    if (lower === token || lower.startsWith(`${token}-`)) return true
  }
  return false
}

function filterIgnoredModels(modelIds, ignoreList) {
  if (ignoreList.length === 0) return modelIds
  return modelIds.filter((id) => !isModelIgnored(id, ignoreList))
}

export async function listDashScopeChatModels(
  apiKey,
  chatCompletionsUrl,
  forceRefresh = false,
) {
  const key = String(apiKey ?? '').trim()
  if (!key) return { ids: [], fromCache: false }

  if (!forceRefresh) {
    const persisted = getCachedDashScopeModelList()
    if (persisted?.length) {
      cachedModelIds = persisted
      cachedAt = Date.now()
      return { ids: persisted, fromCache: true }
    }
    const now = Date.now()
    if (cachedModelIds && now - cachedAt < CACHE_MS) {
      return { ids: cachedModelIds, fromCache: true }
    }
  }

  const url = `${completionsBaseUrl(chatCompletionsUrl)}/models`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    const fallback = getCachedDashScopeModelList() ?? cachedModelIds
    return { ids: fallback ?? [], fromCache: true }
  }

  const payload = await response.json()
  const ids = filterChatIds((payload.data ?? []).map((row) => row.id))
  cachedModelIds = ids
  cachedAt = Date.now()
  if (ids.length > 0) {
    saveDashScopeModelListCache(ids)
    console.info(
      `[sidekick] DashScope /v1/models 已拉取并写入本地缓存 (${ids.length} 个模型)`,
    )
  }
  return { ids, fromCache: false }
}

async function completeOnce({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature,
  chatCompletionsUrl,
}) {
  const url = chatCompletionsUrl?.trim() || DEFAULT_COMPLETIONS_URL
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      ...(typeof temperature === 'number' && Number.isFinite(temperature)
        ? { temperature }
        : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  const bodyText = await response.text().catch(() => '')
  if (!response.ok) {
    const err = new Error(
      `DashScope ${response.status} (model=${model})${bodyText ? `: ${bodyText.slice(0, 240)}` : ''}`,
    )
    err.status = response.status
    err.bodySnippet = bodyText
    err.model = model
    throw err
  }

  const data = JSON.parse(bodyText)
  if (bodyHasApiError(bodyText)) {
    const err = new Error(
      `DashScope ${response.status || 500} (model=${model}): ${apiErrorLabel(bodyText)}`,
    )
    err.status = response.status || 500
    err.bodySnippet = bodyText
    err.model = model
    throw err
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    if (bodyHasTopLevelApiError(bodyText)) {
      const err = new Error(
        `DashScope ${response.status || 500} (model=${model}): ${apiErrorLabel(bodyText)}`,
      )
      err.status = response.status || 500
      err.bodySnippet = bodyText
      err.model = model
      throw err
    }
    throw new Error('Empty content from DashScope')
  }
  return content
}

/**
 * @param {object} payload
 * @param {string} [payload.modelFallbackEnv]
 */
async function tryModelsInOrder({
  apiKey,
  systemPrompt,
  userPrompt,
  temperature,
  chatCompletionsUrl,
  order,
  triedModels,
  logSkippedCached,
  maxAttempts = MAX_QUICK_MODEL_ATTEMPTS,
  preferredModel,
  ignoreList = [],
}) {
  const fullOrder = filterIgnoredModels(
    buildTryOrder(
      order.primary,
      order.fetched,
      order.envList,
      preferredModel,
    ),
    ignoreList,
  )
  const tryOrder = prepareDashScopeModelTryOrder(fullOrder).filter(
    (m) => !triedModels.includes(m),
  )
  if (logSkippedCached) {
    const skippedCached = fullOrder.length - prepareDashScopeModelTryOrder(fullOrder).length
    if (skippedCached > 0) {
      console.info(
        `[sidekick] DashScope 跳过 ${skippedCached} 个本地记录的无额度/不可用模型`,
      )
    }
  }
  let lastErr
  for (const model of tryOrder) {
    if (triedModels.length >= maxAttempts) {
      console.warn(
        `[sidekick] DashScope 已达单次 model 尝试上限 ${maxAttempts}，停止轮换`,
      )
      break
    }
    triedModels.push(model)
    try {
      const content = await completeOnce({
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        temperature,
        chatCompletionsUrl,
      })
      if (triedModels.length > 1) {
        console.info(
          `[sidekick] DashScope 已切换模型: ${model}（此前 ${triedModels.length - 1} 个不可用）`,
        )
      }
      saveDashScopePreferredModel(model)
      return { content, model, triedModels: [...triedModels] }
    } catch (err) {
      lastErr = err
      const bodySnippet = err.bodySnippet ?? err.message ?? ''
      if (!shouldTryNextModel(err.status, bodySnippet)) {
        throw err
      }
      if (isQuotaOrAccess(err.status, bodySnippet)) {
        markDashScopeModelUnavailable(model)
      }
      const reason = bodyHasApiError(bodySnippet)
        ? apiErrorLabel(bodySnippet)
        : isInternalOrServerError(err.status, bodySnippet)
          ? 'internal_error/5xx'
          : isQuotaOrAccess(err.status, bodySnippet)
            ? 'quota/access'
            : 'retryable'
      const cacheNote = isQuotaOrAccess(err.status, bodySnippet)
        ? '，已标记不可用'
        : '，尝试下一个模型'
      console.warn(
        `[sidekick] DashScope model=${model} 失败（${reason}）${cacheNote}`,
      )
    }
  }
  return { lastErr, triedModels }
}

export async function dashscopeChatCompleteWithFallback(payload) {
  const apiKey = String(payload?.apiKey ?? '').trim()
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY')

  const systemPrompt = String(payload?.systemPrompt ?? '')
  const userPrompt = String(payload?.userPrompt ?? '')
  const primary = payload?.model?.trim() || 'qwen-turbo'
  const temperature =
    typeof payload?.temperature === 'number' && Number.isFinite(payload.temperature)
      ? payload.temperature
      : undefined
  const chatCompletionsUrl = payload?.chatCompletionsUrl
  const envList = parseEnvFallback(payload?.modelFallbackEnv)
  const ignoreList = parseEnvIgnore(payload?.modelIgnoreEnv)
  let preferredModel = getDashScopePreferredModel()
  if (preferredModel && isModelIgnored(preferredModel, ignoreList)) {
    preferredModel = null
  }
  const triedModels = []

  if (ignoreList.length > 0) {
    console.info(
      `[sidekick] DashScope 忽略 model 列表: ${ignoreList.join(', ')}`,
    )
  }

  if (preferredModel) {
    console.info(
      `[sidekick] DashScope 优先使用上次成功模型: ${preferredModel}`,
    )
  }

  const quick = await tryModelsInOrder({
    apiKey,
    systemPrompt,
    userPrompt,
    temperature,
    chatCompletionsUrl,
    order: { primary, fetched: [], envList },
    triedModels,
    logSkippedCached: true,
    maxAttempts: MAX_QUICK_MODEL_ATTEMPTS,
    preferredModel,
    ignoreList,
  })
  if (quick?.content) {
    return quick
  }

  const { ids: fetchedRaw, fromCache } = await listDashScopeChatModels(
    apiKey,
    chatCompletionsUrl,
  )
  const fetched = filterIgnoredModels(fetchedRaw, ignoreList)
  if (fetched.length > 0) {
    console.info(
      fromCache
        ? `[sidekick] DashScope 内置候选均失败，使用本地缓存扩充 ${fetched.length} 个模型候选`
        : `[sidekick] DashScope 内置候选均失败，已从 /v1/models 拉取 ${fetched.length} 个扩充模型`,
    )
  } else {
    console.warn('[sidekick] DashScope /v1/models 未返回列表，无法扩充候选')
  }

  const expanded = await tryModelsInOrder({
    apiKey,
    systemPrompt,
    userPrompt,
    temperature,
    chatCompletionsUrl,
    order: { primary, fetched, envList },
    triedModels,
    logSkippedCached: false,
    maxAttempts: MAX_EXPANDED_MODEL_ATTEMPTS,
    preferredModel,
    ignoreList,
  })
  if (expanded?.content) return expanded

  console.warn(
    `[sidekick] DashScope 全部候选模型均失败（已尝试 ${triedModels.length} 个）；不可用列表已保留在 userData`,
  )

  throw new Error(
    `${expanded?.lastErr?.message ?? 'DashScope 失败'}（已依次尝试 ${triedModels.length} 个模型）`,
  )
}
