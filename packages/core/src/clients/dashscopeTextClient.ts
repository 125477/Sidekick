export type DashScopeTextRequest = {
  apiKey: string | undefined
  model: string | undefined
  systemPrompt: string
  userPrompt: string
  temperature: number | undefined
  /** Full POST URL (e.g. Vite dev `/dashscope/...` proxy). Defaults to DashScope compatible-mode Beijing. */
  chatCompletionsUrl?: string
}

type DashScopeChoice = {
  message?: {
    content?: string
  }
}

type DashScopeResponse = {
  choices?: DashScopeChoice[]
}

export async function requestDashScopeText(
  input: DashScopeTextRequest,
): Promise<string> {
  if (!input.apiKey?.trim()) {
    throw new Error('Missing DASHSCOPE_API_KEY')
  }

  const url =
    input.chatCompletionsUrl?.trim() ||
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model ?? 'qwen-turbo',
      temperature: input.temperature ?? 0.7,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`DashScope request failed: ${response.status}`)
  }

  const payload = (await response.json()) as DashScopeResponse
  const content = payload.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Empty content from DashScope')
  }
  return content
}

