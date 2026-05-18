/**
 * DashScope 模型轮换顺序（见 `requestDashScopeTextWithFallback`）：
 *
 * 1. `VITE_DASHSCOPE_MODEL`（默认 qwen-turbo）
 * 2. `VITE_DASHSCOPE_MODEL_FALLBACK`（可选，逗号分隔）
 * 3. **GET /compatible-mode/v1/models**（有 Key 时拉取全部 model id，缓存 10 分钟）
 *    - 接口**不返回**各模型剩余免费 Token，无法只拉「还有额度」的列表
 *    - 额度用尽靠 429/403/400 等错误自动换下一个；无额度 model 记入本地缓存
 *    - 全部候选均失败时清空缓存，充值后下次请求重头尝试
 * 4. 下方 `DASHSCOPE_CHAT_FALLBACK_MODELS` —— 仅当 /v1/models 失败时的离线兜底
 *
 * 若只要尝试控制台里仍有额度的模型，请把 id 写入 `VITE_DASHSCOPE_MODEL_FALLBACK`（逗号分隔，会排在最前）。
 */
export const DASHSCOPE_CHAT_FALLBACK_MODELS: readonly string[] = [
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
]

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

export function buildDashScopeModelTryOrder(
  primary: string | undefined,
  extras: {
    fetched?: string[]
    envList?: string[]
    staticList?: readonly string[]
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
  push(primary)
  for (const id of extras.envList ?? []) push(id)
  for (const id of extras.fetched ?? []) push(id)
  for (const id of staticList) push(id)
  return order
}
