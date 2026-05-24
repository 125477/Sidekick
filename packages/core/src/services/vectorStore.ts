/**
 * Vector store: PostgreSQL + pgvector, or JSON file fallback.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SearchResult } from '../types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../../data')
const JSON_STORE = join(DATA_DIR, 'vector-store.json')

type StoredVector = {
  id: string
  content: string
  metadata: Record<string, unknown>
  embedding: number[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

function loadJsonStore(): StoredVector[] {
  if (!existsSync(JSON_STORE)) return []
  try {
    return JSON.parse(readFileSync(JSON_STORE, 'utf-8')) as StoredVector[]
  } catch {
    return []
  }
}

function saveJsonStore(rows: StoredVector[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(JSON_STORE, JSON.stringify(rows, null, 0), 'utf-8')
}

async function getPgPool(): Promise<import('pg').Pool | null> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return null
  try {
    const { default: pg } = await import('pg')
    return new pg.Pool({ connectionString: url })
  } catch {
    return null
  }
}

export class VectorStoreService {
  static async initialize(): Promise<void> {
    const pool = await getPgPool()
    if (!pool) {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      return
    }
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS vector')
      await pool.query(`
        CREATE TABLE IF NOT EXISTS document_embeddings (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          embedding vector(1536)
        )
      `)
    } finally {
      await pool.end()
    }
  }

  static async upsert(
    id: string,
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const pool = await getPgPool()
    if (pool) {
      try {
        const vec = `[${embedding.join(',')}]`
        await pool.query(
          `INSERT INTO document_embeddings (id, content, metadata, embedding)
           VALUES ($1, $2, $3, $4::vector)
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             metadata = EXCLUDED.metadata,
             embedding = EXCLUDED.embedding`,
          [id, content, JSON.stringify(metadata), vec],
        )
      } finally {
        await pool.end()
      }
      return
    }

    const rows = loadJsonStore().filter((r) => r.id !== id)
    rows.push({ id, content, metadata, embedding })
    saveJsonStore(rows)
  }

  static async search(
    queryEmbedding: number[],
    limit = 10,
  ): Promise<SearchResult[]> {
    const pool = await getPgPool()
    if (pool) {
      try {
        const vec = `[${queryEmbedding.join(',')}]`
        const { rows } = await pool.query<{
          id: string
          content: string
          metadata: Record<string, unknown>
          score: number
        }>(
          `SELECT id, content, metadata,
                  1 - (embedding <=> $1::vector) AS score
           FROM document_embeddings
           ORDER BY embedding <=> $1::vector
           LIMIT $2`,
          [vec, limit],
        )
        return rows.map((r) => ({
          id: r.id,
          content: r.content,
          metadata: r.metadata ?? {},
          score: Number(r.score),
        }))
      } finally {
        await pool.end()
      }
    }

    const stored = loadJsonStore()
    return stored
      .map((r) => ({
        id: r.id,
        content: r.content,
        metadata: r.metadata,
        score: cosineSimilarity(queryEmbedding, r.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }
}
