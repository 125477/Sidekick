/**
 * Embedding service — OpenAI or Ollama (local) for vector search.
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { OllamaEmbeddingService } from './ollamaEmbedding.js';

export type EmbeddingProvider = 'openai' | 'ollama';

function resolveProvider(): EmbeddingProvider {
  const explicit = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  if (explicit === 'ollama') return 'ollama';
  if (explicit === 'openai') return 'openai';
  if (process.env.OLLAMA_BASE_URL?.trim()) return 'ollama';
  return 'openai';
}

export class EmbeddingService {
  private static provider: EmbeddingProvider = resolveProvider();

  static getProvider(): EmbeddingProvider {
    return this.provider;
  }

  static async embedQuery(text: string): Promise<number[]> {
    if (this.provider === 'ollama') {
      return OllamaEmbeddingService.embed(text);
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is required for embeddings. Set OPENAI_API_KEY or EMBEDDING_PROVIDER=ollama with OLLAMA_BASE_URL.',
      );
    }
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
    return embeddings.embedQuery(text);
  }

  static async embedDocuments(texts: string[]): Promise<number[][]> {
    if (this.provider === 'ollama') {
      return Promise.all(texts.map((t) => OllamaEmbeddingService.embed(t)));
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OpenAI API key is required for embeddings. Set OPENAI_API_KEY or EMBEDDING_PROVIDER=ollama with OLLAMA_BASE_URL.',
      );
    }
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
    return embeddings.embedDocuments(texts);
  }
}
