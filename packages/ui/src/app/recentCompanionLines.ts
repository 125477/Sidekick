import { loadData, sanitizeRecentCompanionLinesForPrompt } from '@sidekick/core'

/** 注入 prompt 的【最近句】上限（控制 token）；出参去重另用全量 history。 */
export const COMPANION_PROMPT_AVOID_MAX = 24

/** 与 `recentCompanionLinesRef` 滑动窗口对齐。 */
export const RECENT_COMPANION_LINES_MAX = COMPANION_PROMPT_AVOID_MAX

export type CompanionAvoidContext = {
  /** 写入模型 prompt 的近期句（有上限）。 */
  promptAvoid: string[]
  /** 本地 texts.history 全量文案（精确去重，无条数上限）。 */
  allHistoryLines: string[]
}

function normalizeCompanionLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** 从本地文案历史（新→旧）恢复近期句，供 prompt 去重（旧→新）。 */
export function seedRecentCompanionLinesFromTextHistory(
  history: { content: string }[] | undefined,
): string[] {
  if (!history?.length) return []
  const raw = history
    .slice(0, RECENT_COMPANION_LINES_MAX)
    .map((t) => normalizeCompanionLine(t.content))
    .filter((c) => c.length > 0)
    .reverse()
  return sanitizeRecentCompanionLinesForPrompt(raw)
}

/** 构建 prompt 去重 + 全量 history 出参去重上下文。 */
export async function buildCompanionAvoidContext(
  sessionRecent?: string[],
): Promise<CompanionAvoidContext> {
  let historyNewestFirst: string[] = []
  try {
    const data = await loadData()
    historyNewestFirst = (data.texts.history ?? [])
      .map((t) => normalizeCompanionLine(t.content))
      .filter((c) => c.length > 0)
  } catch {
    /* ignore storage read errors */
  }

  const chronological = [...historyNewestFirst].reverse()
  const mergedForPrompt = [...chronological]
  for (const line of sessionRecent ?? []) {
    const t = normalizeCompanionLine(line)
    if (t) mergedForPrompt.push(t)
  }

  return {
    promptAvoid: sanitizeRecentCompanionLinesForPrompt(mergedForPrompt),
    allHistoryLines: historyNewestFirst,
  }
}

/** @deprecated 使用 buildCompanionAvoidContext */
export async function buildCompanionAvoidList(
  sessionRecent?: string[],
): Promise<string[]> {
  const ctx = await buildCompanionAvoidContext(sessionRecent)
  return ctx.promptAvoid
}
