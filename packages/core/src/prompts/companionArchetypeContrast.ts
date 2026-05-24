/**
 * 陪伴短句与最近句对照——只列历史 + 相似度要求，不推荐起笔模板。
 */

const PROMPT_SNIPPET_MAX = 72

function compactLine(line: string): string {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length <= PROMPT_SNIPPET_MAX ? t : `${t.slice(0, PROMPT_SNIPPET_MAX)}…`
}

/** @deprecated 仅 chat 回退路径可能仍引用；智能体路径不再推断句型。 */
export function collectBannedOpeningsFromRecent(lines: string[]): string[] {
  return lines
    .map((line) => line.trim()[0])
    .filter(Boolean)
    .map((c) => `「${c}…」`)
}

/** 对照块：只展示最近句，要求写不同的新句。 */
export function buildContrastWithLastLine(recent: string[]): string {
  const cleaned = recent.map(compactLine).filter(Boolean)
  const last = cleaned[cleaned.length - 1]
  if (!last) return ''
  return [
    `上一句：「${last}」`,
    '本句须与上一句及【最近句】中任一句明显不同：起笔、重心、措辞均须变；连续汉字重叠不超过4；**不得复用【勿再用词】里的二字词**。',
  ].join('\n')
}
