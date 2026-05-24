/**
 * Keyword search — pure JS index (JSON persistence, no native SQLite).
 * Avoids better-sqlite3 so Electron pack does not require node-gyp / Visual Studio.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SearchResult } from '../types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const INDEX_FILE = join(DATA_DIR, 'keyword-index.json')

type IndexedDocument = {
  id: string
  content: string
  metadata: Record<string, unknown>
  tokens: string[]
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase()
  const matches = normalized.match(/[\p{L}\p{N}]+/gu)
  return matches ?? []
}

function loadIndex(): IndexedDocument[] {
  if (!existsSync(INDEX_FILE)) return []
  try {
    return JSON.parse(readFileSync(INDEX_FILE, 'utf-8')) as IndexedDocument[]
  } catch {
    return []
  }
}

function saveIndex(docs: IndexedDocument[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(INDEX_FILE, JSON.stringify(docs), 'utf-8')
}

function scoreDocument(
  queryTokens: string[],
  doc: IndexedDocument,
): number {
  if (queryTokens.length === 0) return 0
  const tokenSet = new Set(doc.tokens)
  const lowerContent = doc.content.toLowerCase()
  let hits = 0
  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      hits += 1
    } else if (lowerContent.includes(token)) {
      hits += 0.4
    }
  }
  return hits / queryTokens.length
}

export class KeywordSearchService {
  static indexDocument(
    id: string,
    content: string,
    metadata: Record<string, unknown> = {},
  ): void {
    const docs = loadIndex().filter((d) => d.id !== id)
    docs.push({
      id,
      content,
      metadata,
      tokens: tokenize(content),
    })
    saveIndex(docs)
  }

  static search(query: string, limit = 10): SearchResult[] {
    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) return []

    return loadIndex()
      .map((doc) => ({
        id: doc.id,
        content: doc.content,
        metadata: doc.metadata,
        score: scoreDocument(queryTokens, doc),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
