/**
 * Ollama local chat (llama3, qwen2.5, etc.)
 */

const DEFAULT_BASE = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

function baseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
}

function modelName(): string {
  return process.env.OLLAMA_CHAT_MODEL ?? DEFAULT_MODEL
}

export class OllamaLLMService {
  static async generate(
    prompt: string,
    options: { system?: string; temperature?: number } = {},
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = []
    if (options.system?.trim()) {
      messages.push({ role: 'system', content: options.system.trim() })
    }
    messages.push({ role: 'user', content: prompt })

    const res = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName(),
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
        },
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Ollama chat failed (${res.status}): ${err}`)
    }
    const data = (await res.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim()
    if (!text) throw new Error('Ollama chat returned empty content')
    return text
  }
}
