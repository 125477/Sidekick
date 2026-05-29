export type DashScopeAgentRequest = {
  apiKey: string | undefined
  appId: string
  prompt: string
  sessionId?: string | null
  userPromptParams?: Record<string, string>
}

export type DashScopeAgentResult = {
  text: string
  sessionId: string | null
}

type AgentCompletionResponse = {
  output?: {
    text?: string
    session_id?: string
  }
  code?: string
  message?: string
}

function agentCompletionUrl(appId: string, basePath?: string): string {
  const id = appId.trim()
  if (basePath?.trim()) {
    const base = basePath.trim().replace(/\/$/, '')
    return `${base}/api/v1/apps/${id}/completion`
  }
  return `https://dashscope.aliyuncs.com/api/v1/apps/${id}/completion`
}

function parseAgentBody(raw: string): AgentCompletionResponse {
  try {
    return JSON.parse(raw) as AgentCompletionResponse
  } catch {
    return {}
  }
}

function extractAgentError(payload: AgentCompletionResponse, status: number): string {
  const msg =
    typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : `HTTP ${status}`
  const code =
    typeof payload.code === 'string' && payload.code.trim()
      ? payload.code.trim()
      : ''
  return code ? `${code}: ${msg}` : msg
}

function agentTopLevelErrorCode(payload: AgentCompletionResponse): string | null {
  const code = typeof payload.code === 'string' ? payload.code.trim() : ''
  if (!code) return null
  const lower = code.toLowerCase()
  if (lower === 'success' || lower === 'ok') return null
  return code
}

/** 百炼 Agent API 传输层失败（应回退 chat/completions 轮换 model，勿落本地句库）。 */
export function isBailianAgentApiFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.trim()
  if (!msg) return false
  if (
    msg === 'empty agent line' ||
    msg === 'mixed language agent line' ||
    msg === 'agent meta clarification' ||
    msg === 'empty text'
  ) {
    return false
  }
  const lower = msg.toLowerCase()
  return (
    lower.startsWith('internalerror') ||
    lower.includes('internal error') ||
    lower.includes('internalerror:') ||
    lower.includes('missing dashscope') ||
    lower.includes('missing bailian') ||
    lower.includes('http 5') ||
    lower.includes('http 4') ||
    lower.includes('throttl') ||
    lower.includes('flowcontrol') ||
    lower.includes('quota') ||
    lower.includes('service unavailable')
  )
}

/**
 * 调用百炼智能体应用 completion（非 chat/completions）。
 * @see https://help.aliyun.com/zh/model-studio/new-agent-application-api-reference
 */
let agentHttpChain: Promise<unknown> = Promise.resolve()

export async function requestDashScopeAgentCompletion(
  input: DashScopeAgentRequest,
  opts?: { requestBasePath?: string },
): Promise<DashScopeAgentResult> {
  const run = agentHttpChain.then(() =>
    requestDashScopeAgentCompletionOnce(input, opts),
  )
  agentHttpChain = run.catch(() => {})
  return run
}

async function requestDashScopeAgentCompletionOnce(
  input: DashScopeAgentRequest,
  opts?: { requestBasePath?: string },
): Promise<DashScopeAgentResult> {
  const key = input.apiKey?.trim()
  if (!key) {
    throw new Error('Missing DashScope API key for Bailian agent')
  }
  const appId = input.appId.trim()
  if (!appId) {
    throw new Error('Missing Bailian app id')
  }

  const body: Record<string, unknown> = {
    input: {
      prompt: input.prompt,
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      ...(input.userPromptParams && Object.keys(input.userPromptParams).length > 0
        ? { user_prompt_params: input.userPromptParams }
        : {}),
    },
  }

  const res = await fetch(agentCompletionUrl(appId, opts?.requestBasePath), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  const payload = parseAgentBody(raw)
  if (!res.ok) {
    throw new Error(extractAgentError(payload, res.status))
  }
  if (agentTopLevelErrorCode(payload) != null) {
    throw new Error(extractAgentError(payload, res.status))
  }

  const text = payload.output?.text?.trim() ?? ''
  if (!text) {
    throw new Error(
      extractAgentError(payload, res.status) || 'Empty agent completion text',
    )
  }

  const sessionId =
    typeof payload.output?.session_id === 'string' &&
    payload.output.session_id.trim()
      ? payload.output.session_id.trim()
      : null

  return { text, sessionId }
}
