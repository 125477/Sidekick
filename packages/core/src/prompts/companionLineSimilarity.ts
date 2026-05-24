/**
 * 陪伴句相似度（结构/重叠 + 最近句二字词复用），不维护全局禁词表。
 */

/** 连续汉字重叠上限（与 prompt 说明一致）。 */
export const COMPANION_MAX_CONTIGUOUS_CHAR_OVERLAP = 4

/** 二字词提取时忽略的高频连接片段（非内容词）。 */
const BIGRAM_STOP = new Set([
  '在这', '也是', '已经', '不必', '可以', '如果', '今天', '自己', '一下', '一会',
  '跟着', '下来', '起来', '就是', '不是', '的话', '什么', '怎么', '那个', '这个',
  '还有', '因为', '所以', '但是', '而且', '或者', '虽然', '不过', '只是', '有些',
  '那么', '那样', '这样', '一直', '一起', '真的', '其实', '慢慢', '一点', '一些',
  '就让', '也把', '就把',
])

function hanOnly(text: string): string {
  return text.replace(/[^\u4e00-\u9fff]/gu, '')
}

/** 从一句里提取去重后的二字词（用于「最近句勿复用词组」）。 */
export function extractCompanionBigrams(text: string): string[] {
  const han = hanOnly(text)
  if (han.length < 2) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (let i = 0; i < han.length - 1; i++) {
    const bg = han.slice(i, i + 2)
    if (BIGRAM_STOP.has(bg)) continue
    if (seen.has(bg)) continue
    seen.add(bg)
    out.push(bg)
  }
  return out
}

/** 合并 recent 各句的二字词，供 prompt 注入。 */
export function collectRecentBigramsForAvoid(recent: string[], max = 14): string[] {
  const seen = new Set<string>()
  const scored: { bg: string; count: number }[] = []
  for (const line of recent) {
    for (const bg of extractCompanionBigrams(line)) {
      const prev = seen.has(bg)
      seen.add(bg)
      if (!prev) scored.push({ bg, count: 1 })
      else {
        const row = scored.find((s) => s.bg === bg)
        if (row) row.count += 1
      }
    }
  }
  return scored
    .sort((a, b) => b.count - a.count || a.bg.localeCompare(b.bg, 'zh-CN'))
    .slice(0, max)
    .map((s) => s.bg)
}

export function companionLineReusesRecentBigrams(
  candidate: string,
  recent: string[],
): boolean {
  if (recent.length === 0) return false
  const banned = new Set(collectRecentBigramsForAvoid(recent, 24))
  if (banned.size === 0) return false
  for (const bg of extractCompanionBigrams(candidate)) {
    if (banned.has(bg)) return true
  }
  return false
}

/** 最近句逗号前起笔（防「忙碌之余，别忘了…」连刷）。 */
export function collectRecentOpeningPrefixes(recent: string[], max = 4): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of recent) {
    const t = line.replace(/\s+/g, ' ').trim()
    if (!t) continue
    const comma = t.search(/[，,]/)
    const prefix =
      comma >= 4 ? t.slice(0, comma).trim() : t.slice(0, Math.min(10, t.length)).trim()
    if (prefix.length < 4 || seen.has(prefix)) continue
    seen.add(prefix)
    out.push(prefix)
  }
  return out.slice(-max)
}

export function companionTextHasReminderTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/之余[，,].{0,6}别忘了/.test(t)) return true
  if (/^别忘了/.test(t)) return true
  if (/^忙碌之余/.test(t)) return true
  return false
}

export function longestContiguousHanOverlap(a: string, b: string): number {
  const x = a.replace(/\s+/g, '').trim()
  const y = b.replace(/\s+/g, '').trim()
  if (!x || !y) return 0
  let best = 0
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) {
      let k = 0
      while (
        i + k < x.length &&
        j + k < y.length &&
        x[i + k] === y[j + k]
      ) {
        k++
      }
      if (k > best) best = k
    }
  }
  return best
}

export function companionLineTooSimilarToAny(
  candidate: string,
  recent: string[],
  opts?: { maxContiguousOverlap?: number; sameFirstChar?: boolean },
): boolean {
  const t = candidate.replace(/\s+/g, ' ').trim()
  if (!t) return true
  const maxOverlap = opts?.maxContiguousOverlap ?? COMPANION_MAX_CONTIGUOUS_CHAR_OVERLAP
  const checkFirst = opts?.sameFirstChar ?? true

  for (const line of recent) {
    const r = line.replace(/\s+/g, ' ').trim()
    if (!r) continue
    if (t === r) return true
    if (checkFirst && t[0] && r[0] && t[0] === r[0]) return true
    if (longestContiguousHanOverlap(t, r) > maxOverlap) return true
    if (companionLineReusesRecentBigrams(t, [r])) return true
  }
  return false
}

/** 模型易写的「风景+心情」空泛套句（生成后校验，非 prompt 禁词表）。 */
export function companionTextHasSceneryMoodCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/让.{0,10}(心|思绪|心灵|灵魂).{0,10}(随|飘|荡|舞)/.test(t)) return true
  if (/(宁静|旋律|午后|放空|思绪|飘荡).{0,14}(心灵|心也|轻舞|飘|荡)/.test(t)) {
    return true
  }
  if (/^在这.{0,8}(宁静|安静|美好|片刻)/.test(t)) return true
  if (/午后|午后阳光|在这.{0,10}午后/.test(t)) return true
  if (/让(心情|心|思绪).{0,8}(随|飘|轻|飞|扬)/.test(t)) return true
  if (/阳光.*(温暖|心中|多了)/.test(t)) return true
  if (/风轻云淡|随着.{0,6}(旋律|风)/.test(t)) return true
  if (companionTextHasReminderTemplate(t)) return true
  return false
}

export function buildCompanionDiversityRetrySuffix(reusedBigrams: string[]): string {
  const list =
    reusedBigrams.length > 0
      ? reusedBigrams.slice(0, 10).join('、')
      : '（见最近句）'
  return [
    '【硬约束·换写法】上一句与最近句共用词组或套句腔（如风景+心灵/宁静/随风）。',
    `本句不得再出现这些二字词：${list}。`,
    '改写成口语化、单重心的承接句；起笔与重心须与最近句明显不同。',
  ].join('\n')
}
