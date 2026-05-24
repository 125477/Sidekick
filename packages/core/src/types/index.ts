/** Shared types for RAG / hybrid search in @sidekick/core */

export interface SearchResult {
  id: string
  content: string
  metadata: Record<string, unknown>
  score: number
}

export interface DocumentChunk {
  id: string
  content: string
  metadata: Record<string, unknown>
}

export interface IngestDocumentInput {
  id: string
  content: string
  metadata?: Record<string, unknown>
}
