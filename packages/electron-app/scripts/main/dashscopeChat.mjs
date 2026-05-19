/**
 * 主进程 DashScope 文案：body.error、403/429、internal_error/5xx 时按候选 model 自动切换。
 * 不可用 model 持久化见 dashscopeUnavailableModels.mjs。
 */

import {
  markDashScopeModelUnavailable,
  prepareDashScopeModelTryOrder,
} from './dashscopeUnavailableModels.mjs'

const DEFAULT_COMPLETIONS_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

/** 仅 /v1/models 拉取失败时使用；正常情况用接口返回的 100+ 模型。 */
const STATIC_FALLBACK = ['qwen-turbo', 'qwen-plus', 'qwen-max']

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
    lower.includes('service unavailable') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout')
  )
}

function bodyHasApiError(body) {
  const raw = String(body ?? '').trim()
  if (!raw || raw[0] !== '{') return false
  try {
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
    const err = JSON.parse(String(body)).error
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

function buildTryOrder(primary, fetched, envList) {
  const order = []
  const seen = new Set()
  const push = (id) => {
    const m = String(id ?? '').trim()
    if (!m || seen.has(m)) return
    seen.add(m)
    order.push(m)
  }
  push(primary)
  for (const id of envList ?? []) push(id)
  for (const id of fetched ?? []) push(id)
  for (const id of STATIC_FALLBACK) push(id)
  return order
}

function parseEnvFallback(raw) {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function listDashScopeChatModels(apiKey, chatCompletionsUrl) {
  const key = String(apiKey ?? '').trim()
  if (!key) return []

  const now = Date.now()
  if (cachedModelIds && now - cachedAt < CACHE_MS) {
    return cachedModelIds
  }

  const url = `${completionsBaseUrl(chatCompletionsUrl)}/models`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) return cachedModelIds ?? []

  const payload = await response.json()
  const ids = filterChatIds((payload.data ?? []).map((row) => row.id))
  cachedModelIds = ids
  cachedAt = now
  return ids
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
      temperature,
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
  if (!content) throw new Error('Empty content from DashScope')
  return content
}

/**
 * @param {object} payload
 * @param {string} [payload.modelFallbackEnv]
 */
export async function dashscopeChatCompleteWithFallback(payload) {
  const apiKey = String(payload?.apiKey ?? '').trim()
  if (!apiKey) throw new Error('Missing DASHSCOPE_API_KEY')

  const systemPrompt = String(payload?.systemPrompt ?? '')
  const userPrompt = String(payload?.userPrompt ?? '')
  const primary = payload?.model?.trim() || 'qwen-turbo'
  const temperature =
    typeof payload?.temperature === 'number' && Number.isFinite(payload.temperature)
      ? payload.temperature
      : 0.7
  const chatCompletionsUrl = payload?.chatCompletionsUrl

  const fetched = await listDashScopeChatModels(apiKey, chatCompletionsUrl)
  if (fetched.length > 0) {
    console.info(
      `[sidekick] DashScope 已从 /v1/models 加载 ${fetched.length} 个候选模型`,
    )
  } else {
    console.warn('[sidekick] DashScope /v1/models 未返回列表，使用内置兜底模型')
  }
  const fullOrder = buildTryOrder(
    primary,
    fetched,
    parseEnvFallback(payload?.modelFallbackEnv),
  )
  const tryOrder = prepareDashScopeModelTryOrder(fullOrder)
  const skippedCached = fullOrder.length - tryOrder.length
  if (skippedCached > 0) {
    console.info(
      `[sidekick] DashScope 跳过 ${skippedCached} 个本地记录的无额度/不可用模型`,
    )
  }

  const triedModels = []
  let lastErr

  for (const model of tryOrder) {
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
      return { content, model, triedModels }
    } catch (err) {
      lastErr = err
      const bodySnippet = err.bodySnippet ?? err.message ?? ''
      if (!shouldTryNextModel(err.status, bodySnippet)) {
        throw err
      }
      markDashScopeModelUnavailable(model)
      const reason = bodyHasApiError(bodySnippet)
        ? apiErrorLabel(bodySnippet)
        : isInternalOrServerError(err.status, bodySnippet)
          ? 'internal_error/5xx'
          : isQuotaOrAccess(err.status, bodySnippet)
            ? 'quota/access'
            : 'retryable'
      console.warn(
        `[sidekick] DashScope model=${model} 已标记不可用（${reason}），尝试下一个模型`,
      )
    }
  }

  console.warn(
    `[sidekick] DashScope 全部候选模型均失败（已尝试 ${triedModels.length} 个）；不可用列表已保留在 userData`,
  )

  throw new Error(
    `${lastErr?.message ?? 'DashScope 失败'}（已依次尝试 ${triedModels.length} 个模型）`,
  )
}
