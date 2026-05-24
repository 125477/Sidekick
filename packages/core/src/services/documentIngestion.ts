/**
 * Chunk documents and index for vector + keyword search.
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { EmbeddingService } from './embedding.js'
import { VectorStoreService } from './vectorStore.js'
import { KeywordSearchService } from './keywordSearch.js'
import type { IngestDocumentInput } from '../types/index.js'

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
})

export class DocumentIngestionService {
  static async initialize(): Promise<void> {
    await VectorStoreService.initialize()
  }

  static async ingestDocument(input: IngestDocumentInput): Promise<number> {
    const meta = input.metadata ?? {}
    const chunks = await splitter.splitText(input.content)
    let count = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = `${input.id}__chunk_${i}`
      const chunkText = chunks[i]!
      const chunkMeta = { ...meta, sourceId: input.id, chunkIndex: i }

      const [embedding] = await EmbeddingService.embedDocuments([chunkText])
      if (!embedding) continue

      await VectorStoreService.upsert(chunkId, chunkText, embedding, chunkMeta)
      KeywordSearchService.indexDocument(chunkId, chunkText, chunkMeta)
      count++
    }

    return count
  }

  static async ingestDocuments(
    inputs: IngestDocumentInput[],
  ): Promise<{ documents: number; chunks: number }> {
    await this.initialize()
    let chunks = 0
    for (const doc of inputs) {
      chunks += await this.ingestDocument(doc)
    }
    return { documents: inputs.length, chunks }
  }
}
