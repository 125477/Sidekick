/** Node / Electron 主进程专用：RAG、混合检索、文档入库。勿从 renderer 直接 import。 */

export { EmbeddingService, type EmbeddingProvider } from '../services/embedding.js'
export { OllamaEmbeddingService } from '../services/ollamaEmbedding.js'
export { OllamaLLMService } from '../services/ollamaLLM.js'
export { VectorStoreService } from '../services/vectorStore.js'
export { KeywordSearchService } from '../services/keywordSearch.js'
export { HybridSearchService } from '../services/hybridSearch.js'
export { DocumentIngestionService } from '../services/documentIngestion.js'
export { RAGService } from '../services/ragService.js'
export type {
  SearchResult,
  DocumentChunk,
  IngestDocumentInput,
} from '../types/index.js'
