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

/**
 * 调用百炼智能体应用 completion（非 chat/completions）。
 * @see https://help.aliyun.com/zh/model-studio/new-agent-application-api-reference
 */
export async function requestDashScopeAgentCompletion(
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
    parameters: {},
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
