/**
 * RAG: hybrid retrieval + optional Ollama / OpenAI generation.
 */

import { HybridSearchService } from './hybridSearch.js'
import { OllamaLLMService } from './ollamaLLM.js'
import { requestDashScopeTextWithFallback } from '../clients/dashscopeTextClient.js'

export class RAGService {
  static async retrieveContext(
    query: string,
    limit = 5,
  ): Promise<{ context: string; sources: string[] }> {
    const results = await HybridSearchService.search(query, { limit })
    if (results.length === 0) {
      return { context: '', sources: [] }
    }

    const context = results
      .map((r, i) => `[${i + 1}] ${r.content}`)
      .join('\n\n')

    const sources = results.map((r) => {
      const src = r.metadata.sourceId ?? r.metadata.source
      return typeof src === 'string' ? src : r.id
    })

    return { context, sources: [...new Set(sources)] }
  }

  static async answer(
    query: string,
    options: {
      limit?: number
      useLocalLlm?: boolean
      systemPrompt?: string
    } = {},
  ): Promise<{ answer: string; sources: string[] }> {
    const { context, sources } = await this.retrieveContext(
      query,
      options.limit ?? 5,
    )

    const baseSystem =
      options.systemPrompt ??
      '你是灵伴的知识助手。仅根据提供的参考资料回答；资料不足时如实说明，勿编造。回答简洁。'

    const userPrompt = context
      ? `参考资料：\n${context}\n\n问题：${query}`
      : `（无相关资料）问题：${query}`

    const useOllama =
      options.useLocalLlm === true ||
      process.env.LLM_PROVIDER?.toLowerCase() === 'ollama' ||
      (process.env.OLLAMA_BASE_URL?.trim() &&
        !process.env.OPENAI_API_KEY &&
        !process.env.VITE_DASHSCOPE_API_KEY)

    let answer: string
    if (useOllama) {
      answer = await OllamaLLMService.generate(userPrompt, {
        system: baseSystem,
        temperature: 0.5,
      })
    } else if (process.env.VITE_DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY) {
      const model =
        (process.env.VITE_DASHSCOPE_MODEL as string | undefined) ?? 'qwen-turbo'
      const result = await requestDashScopeTextWithFallback({
        apiKey: process.env.VITE_DASHSCOPE_API_KEY ?? process.env.OPENAI_API_KEY,
        model,
        systemPrompt: baseSystem,
        userPrompt,
        temperature: 0.5,
      })
      answer = result.content.trim()
    } else {
      answer = context
        ? `找到 ${sources.length} 处相关片段，但未配置 LLM。请设置 OLLAMA_BASE_URL 或 API Key。`
        : '未找到相关资料。'
    }

    return { answer, sources }
  }
}
