/** 设置与首次引导共用的兴趣标签选项 */
export const COMPANION_INTEREST_TAG_OPTIONS = [
  '音乐',
  '影视',
  '书籍',
  '运动',
  '游戏',
  '旅行',
] as const

export type CompanionInterestTag = (typeof COMPANION_INTEREST_TAG_OPTIONS)[number]

export function parseCompanionInterestNote(
  interests: string[] | undefined,
): { tags: string[]; note: string } {
  const list = interests ?? []
  const noteRow = list.find((s) => s.startsWith('补充：'))
  const note = noteRow ? noteRow.slice(3).trim() : ''
  const tags = list.filter(
    (s) => !s.startsWith('补充：') && s.trim().length > 0,
  )
  return { tags, note }
}

export function buildCompanionInterestsPayload(
  tags: string[],
  note: string,
): string[] {
  const base = [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
  const n = note.replace(/\s+/g, ' ').trim()
  if (n) base.push(`补充：${n}`)
  return base
}
