/** 与 `recentCompanionLinesRef`、`buildAvoidRecentBlock` 对齐的近期句上限。 */
export const RECENT_COMPANION_LINES_MAX = 6

/** 从本地文案历史（新→旧）恢复近期句，供 prompt 去重（旧→新）。 */
export function seedRecentCompanionLinesFromTextHistory(
  history: { content: string }[] | undefined,
): string[] {
  if (!history?.length) return []
  return history
    .slice(0, RECENT_COMPANION_LINES_MAX)
    .map((t) => t.content.replace(/\s+/g, ' ').trim())
    .filter((c) => c.length > 0)
    .reverse()
}
