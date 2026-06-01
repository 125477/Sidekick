/**
 * DashScope 模型轮换顺序（见 `requestDashScopeTextWithFallback`）：
 *
 * 1. `VITE_DASHSCOPE_MODEL`（默认 qwen-turbo）
 * 2. `VITE_DASHSCOPE_MODEL_FALLBACK`（可选，逗号分隔）
 * 3. **上次成功的 model**（持久化本地，下次排在最前）
 * 4. **GET /compatible-mode/v1/models**（内置候选均失败后；**首次拉取后持久化本地**）
 *    - 模型列表缓存：Electron `userData/dashscope-model-list-cache.json`；浏览器 `localStorage`
 *    - 接口**不返回**各模型剩余免费 Token，无法只拉「还有额度」的列表
 *    - 响应 JSON 含非空 error、429/403/400、internal_error/5xx 时自动换下一个
 *    - 失败的 model 记入本地缓存（Electron：userData/dashscope-unavailable-models.json；浏览器：localStorage）
 *    - 全部候选均失败时保留缓存；充值后需手动删除缓存文件或 localStorage 项
 * 4. 下方 `DASHSCOPE_CHAT_FALLBACK_MODELS` —— 仅当 /v1/models 失败时的离线兜底
 *
 * 若只要尝试控制台里仍有额度的模型，请把 id 写入 `VITE_DASHSCOPE_MODEL_FALLBACK`（逗号分隔，会排在最前）。
 *
 * `VITE_DASHSCOPE_MODEL_IGNORE`（逗号分隔）：轮换时跳过指定 model（含 `qwen3.7-max` 匹配 `qwen3.7-max-2026-05-17`）。
 */
export const DASHSCOPE_CHAT_FALLBACK_MODELS: readonly string[] = [
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
]

/** 内置快速候选（primary + env + static）最多轮换数；/v1/models 扩充后不设上限。 */
export const DASHSCOPE_MAX_MODEL_ATTEMPTS_PER_CALL = 12

/** 从 OpenAI 兼容 /v1/models 结果中筛出可能支持 chat/completions 的 model id。 */
export function filterLikelyChatModelIds(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = raw.trim()
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

export function parseExtraFallbackModelsFromEnv(
  raw: string | undefined,
): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 与 `VITE_DASHSCOPE_MODEL_IGNORE` 联用；逗号 / 分号 / 空白分隔。 */
export function parseDashScopeModelIgnoreFromEnv(
  raw: string | undefined,
): string[] {
  return parseExtraFallbackModelsFromEnv(raw)
}

/** 精确匹配，或 model id 为 `token-…` 后缀变体（如 `qwen3.7-max-2026-05-17`）。 */
export function isDashScopeModelIgnored(
  modelId: string,
  ignoreList: readonly string[],
): boolean {
  const id = modelId.trim()
  if (!id || ignoreList.length === 0) return false
  const lower = id.toLowerCase()
  for (const raw of ignoreList) {
    const token = raw.trim().toLowerCase()
    if (!token) continue
    if (lower === token || lower.startsWith(`${token}-`)) return true
  }
  return false
}

export function filterIgnoredDashScopeModels(
  modelIds: string[],
  ignoreList: readonly string[],
): string[] {
  if (ignoreList.length === 0) return modelIds
  return modelIds.filter((id) => !isDashScopeModelIgnored(id, ignoreList))
}

export function buildDashScopeModelTryOrder(
  primary: string | undefined,
  extras: {
    fetched?: string[]
    envList?: string[]
    staticList?: readonly string[]
    /** 上次成功 model，排在 primary 之前优先尝试。 */
    preferredModel?: string
  } = {},
): string[] {
  const staticList = extras.staticList ?? DASHSCOPE_CHAT_FALLBACK_MODELS
  const order: string[] = []
  const seen = new Set<string>()
  const push = (id: string | undefined) => {
    const m = id?.trim()
    if (!m || seen.has(m)) return
    seen.add(m)
    order.push(m)
  }
  push(extras.preferredModel)
  push(primary)
  for (const id of extras.envList ?? []) push(id)
  for (const id of extras.fetched ?? []) push(id)
  for (const id of staticList) push(id)
  return order
}
