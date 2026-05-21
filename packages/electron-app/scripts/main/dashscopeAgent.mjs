/**
 * 百炼智能体应用 completion（与 chat/completions 分离）。
 * @see https://help.aliyun.com/zh/model-studio/new-agent-application-api-reference
 */

function agentUrl(appId) {
  return `https://dashscope.aliyuncs.com/api/v1/apps/${appId.trim()}/completion`
}

function parseBody(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function extractError(payload, status) {
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
 * @param {{
 *   apiKey?: string
 *   appId: string
 *   prompt: string
 *   sessionId?: string | null
 *   userPromptParams?: Record<string, string>
 * }} payload
 * @returns {Promise<{ text: string, sessionId: string | null }>}
 */
export async function dashscopeAgentComplete(payload) {
  const key = payload.apiKey?.trim() || process.env.DASHSCOPE_API_KEY?.trim()
  if (!key) {
    throw new Error('Missing DASHSCOPE_API_KEY for Bailian agent')
  }
  const appId = payload.appId?.trim()
  if (!appId) {
    throw new Error('Missing Bailian app id')
  }

  const body = {
    input: {
      prompt: payload.prompt,
      ...(payload.sessionId ? { session_id: payload.sessionId } : {}),
      ...(payload.userPromptParams &&
      Object.keys(payload.userPromptParams).length > 0
        ? { user_prompt_params: payload.userPromptParams }
        : {}),
    },
    parameters: {},
  }

  const res = await fetch(agentUrl(appId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const raw = await res.text()
  const data = parseBody(raw)
  if (!res.ok) {
    throw new Error(extractError(data, res.status))
  }

  const text = data.output?.text?.trim() ?? ''
  if (!text) {
    throw new Error(extractError(data, res.status) || 'Empty agent completion')
  }

  const sessionId =
    typeof data.output?.session_id === 'string' &&
    data.output.session_id.trim()
      ? data.output.session_id.trim()
      : null

  return { text, sessionId }
}
