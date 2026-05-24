import { companionLineTooSimilarToAny } from './companionLineSimilarity'

/** 与 UI `RECENT_COMPANION_LINES_MAX` 对齐。 */
export const COMPANION_AVOID_RECENT_MAX = 6

/**
 * 写入 prompt 前的 recent 列表：去空、去重、去掉与相邻句高度相似的条目。
 * **不做禁词过滤**——避免把「最近句」变成另一份禁词表。
 */
export function sanitizeRecentCompanionLinesForPrompt(
  lines: string[] | undefined,
): string[] {
  const cleaned = (lines ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const out: string[] = []
  for (const line of cleaned) {
    if (companionLineTooSimilarToAny(line, out)) continue
    out.push(line)
  }
  return out.slice(-COMPANION_AVOID_RECENT_MAX)
}
