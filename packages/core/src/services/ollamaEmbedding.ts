/**
 * Ollama local embeddings (nomic-embed-text, etc.)
 */

const DEFAULT_BASE = 'http://localhost:11434'
const DEFAULT_MODEL = 'nomic-embed-text'

function baseUrl(): string {
  return (process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '')
}

function modelName(): string {
  return process.env.OLLAMA_EMBED_MODEL ?? DEFAULT_MODEL
}

export class OllamaEmbeddingService {
  static async embed(text: string): Promise<number[]> {
    const res = await fetch(`${baseUrl()}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName(), prompt: text }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Ollama embedding failed (${res.status}): ${err}`)
    }
    const data = (await res.json()) as { embedding?: number[] }
    if (!Array.isArray(data.embedding)) {
      throw new Error('Ollama embedding response missing embedding array')
    }
    return data.embedding
  }
}
