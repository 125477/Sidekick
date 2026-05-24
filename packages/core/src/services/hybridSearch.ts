/**
 * Hybrid search: vector similarity + keyword (BM25-style) with RRF fusion.
 */

import { EmbeddingService } from './embedding.js';
import { VectorStoreService } from './vectorStore.js';
import { KeywordSearchService } from './keywordSearch.js';
import type { SearchResult } from '../types/index.js';

const RRF_K = 60;

function reciprocalRankFusion(
  vectorResults: SearchResult[],
  keywordResults: SearchResult[],
  limit: number,
): SearchResult[] {
  const scores = new Map<string, { score: number; result: SearchResult }>();

  vectorResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, { score: rrfScore, result });
    }
  });

  keywordResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, { score: rrfScore, result });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score, result }) => ({
      ...result,
      score,
    }));
}

export class HybridSearchService {
  static async search(
    query: string,
    options: {
      limit?: number;
      vectorWeight?: number;
      keywordWeight?: number;
    } = {},
  ): Promise<SearchResult[]> {
    const limit = options.limit ?? 10;
    const vectorLimit = Math.ceil(limit * 1.5);
    const keywordLimit = Math.ceil(limit * 1.5);

    const queryEmbedding = await EmbeddingService.embedQuery(query);
    const vectorResults = await VectorStoreService.search(queryEmbedding, vectorLimit);
    const keywordResults = await KeywordSearchService.search(query, keywordLimit);

    return reciprocalRankFusion(vectorResults, keywordResults, limit);
  }
}
