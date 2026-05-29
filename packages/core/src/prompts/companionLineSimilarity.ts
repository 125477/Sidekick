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
  if (/让.{0,10}(心|思绪|心灵|灵魂).{0,10}(随|飘|荡|舞|栖)/.test(t)) return true
  if (/(宁静|静谧|旋律|午后|放空|思绪|飘荡).{0,14}(心灵|心也|轻舞|飘|荡|灵魂|安宁)/.test(t)) {
    return true
  }
  if (/^在这.{0,8}(宁静|静谧|安静|美好|片刻)/.test(t)) return true
  if (/在这.{0,10}(宁静|静谧).{0,8}片刻/.test(t)) return true
  if (/灵魂.{0,6}栖息|心中.{0,8}安宁|一片安宁|让灵魂/.test(t)) return true
  if (/午后|午后阳光|在这.{0,10}午后/.test(t)) return true
  if (/让(心情|心|思绪|灵魂).{0,8}(随|飘|轻|飞|扬|栖)/.test(t)) return true
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

/** 换一句时与屏幕上原句相同/过近，追加到 Agent prompt 尾部重试。 */
export function buildCompanionReplaceTargetRetrySuffix(
  replaceTarget: string,
): string {
  const t = replaceTarget.replace(/\s+/g, ' ').trim()
  return [
    `【硬约束·换句】上一句与屏幕上正在展示的句相同或过于相似：「${t}」。`,
    '必须换起笔、重心、收束（至少两项不同）；禁止只改「稍微/一下/一会儿」等副词。',
    '严格按 writing_angle 白名单句法重写，一句一重心。',
  ].join('\n')
}

/** 先到这儿/先放一放/不用逼/喘息（concrete_pause 示范句连刷）。 */
export function companionTextHasConcretePauseCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^先放一放|^先到这儿|^先喘口气|^先停一下|^先歇/.test(t)) return true
  if (/先放一放|先到这儿|先喘口气/.test(t)) return true
  if (/不用逼|不必逼|别逼自己|逼自己太/.test(t)) return true
  if (/给自己.{0,6}(喘息|缓冲|放松)/.test(t)) return true
  if (/缓缓心情|放松心情|放松下来/.test(t)) return true
  if (/喘息.{0,4}时间|一点喘息/.test(t)) return true
  return false
}

export function companionRecentConcretePauseSaturated(recent: string[]): boolean {
  return recent.some((line) => companionTextHasConcretePauseCliche(line))
}

export function buildConcretePauseClicheRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是「先放一放/先到这儿/不用逼/喘息/缓缓心情」套句。',
    '改写成全新起笔：可以/不妨/晚一点/今天/此刻/不是…而是…/短问句；禁止先…起笔，禁止逼/喘息/放松/缓缓心情。',
  ].join('')
}

/** 歇会儿/不是非得/也行口号（换句连刷）。 */
export function companionTextHasRestBreakPermissionCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/歇会儿|歇歇|中午歇|歇一歇|歇着也行/.test(t)) return true
  if (/不是非得|非得现在|非得过|不必弄明白|不必一次想明白/.test(t)) return true
  if (/停一停也挺好|停一下也挺好|慢下来也挺好/.test(t)) return true
  if (/也行[。！？]?$/.test(t)) {
    const hanLen = t.replace(/[^\u4e00-\u9fff]/gu, '').length
    if (hanLen <= 7) return true
  }
  return false
}

export function buildRestBreakPermissionRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是「不是非得/歇会儿/也行」类休息许可套句。',
    '改写成全新句：至少8个汉字；可以/不妨/晚一点 + 具体小事；禁止歇会儿/中午歇/不是非得/4–6字「也行」口号。',
  ].join('')
}

/** 走哪条路/跟着感觉/慢一点都行 —— 换句连环改写高频套句。 */
export function companionTextHasRouteComfortPermissionCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/走.{0,14}(哪条|你觉得|最舒服|自选|自己选).{0,6}路/.test(t)) return true
  if (/跟着感觉走|跟着心意走|顺着心意走|顺着感觉走/.test(t)) return true
  if (/慢一点.{0,10}(或者|还是|也).{0,10}(都行|也好|也行)/.test(t)) return true
  if (/心里舒服就行|舒服就好|舒服的路|最舒服的路/.test(t)) return true
  if (/怎么走.{0,8}(都行|也好|也行)/.test(t)) return true
  if (/选.{0,6}(哪条|一条).{0,6}路/.test(t)) return true
  if (/^走你/.test(t) && /(舒服|路|行)/.test(t)) return true
  if (/跟着.{0,4}(感觉|心意|节奏).{0,6}(走|来)/.test(t)) return true
  return false
}

export function buildRouteComfortPermissionRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是「走哪条路/跟着感觉/慢一点都行/心里舒服就行」类空泛许可套句。',
    '改写成全新白话：可以/不妨/今天/此刻 + 一件具体小事或身体感受；禁止路/舒服/感觉/都行连环换词。',
  ].join('')
}

/** 眼睛/肩颈 + 休息/停一下（换句连刷高频套句）。 */
export function companionTextHasBodyRestCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/处理手头|手头的事|待会再处理/.test(t)) return true
  if (/让眼睛|给眼睛|把眼睛/.test(t)) return true
  if (
    /眼睛|眼酸|眼累|眼困|肩颈|肩酸|肩头|肩膀|肩上|脖子/.test(t) &&
    /休息|歇|停|闭|松|发烫|发热|沉|重/.test(t)
  ) {
    return true
  }
  if (/稍微停一下|停一下|停一停/.test(t) && /(眼睛|休息|歇|肩|颈|沉|烫)/.test(t)) {
    return true
  }
  if (/休息.{0,4}时间|休息一下/.test(t) && /(眼睛|眼|肩|颈)/.test(t)) return true
  return false
}

/** 同句混用矛盾体感（如「沉得发烫」）。 */
export function companionTextHasContradictorySensoryMetaphor(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/(沉|重|酸|累|乏|钝|压).{0,12}(发烫|发热|滚烫|热乎|烫人)/.test(t)) {
    return true
  }
  if (/(发烫|发热|滚烫|热乎).{0,12}(沉|重|酸|累|乏|钝|压)/.test(t)) {
    return true
  }
  return false
}

export function companionRecentBodyRestSaturated(recent: string[]): boolean {
  return recent.some((line) => companionTextHasBodyRestCliche(line))
}

export function companionLineRepeatsBodyRestWithRecent(
  candidate: string,
  recent: string[],
): boolean {
  if (!companionTextHasBodyRestCliche(candidate)) return false
  return recent.some((line) => companionTextHasBodyRestCliche(line))
}

export function buildBodyRestClicheRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句又是眼睛/肩颈+休息套句（或处理手头的事+让眼睛歇）。',
    '改写成非身体部位句：白话许可或短判断（可以/不妨/晚一点也行）；禁止眼睛/眼酸/肩颈/休息/歇/停一下/闭一会儿/手头的事。',
  ].join('')
}

/** 换句连刷：今天有点累 / 先歇会儿 / 先缓缓 / 先放一放 / 晚点再处理。 */
export function companionTextHasTodayRestPermissionTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/今天.{0,10}(有点)?(累|烦|满|够了|疲)/.test(t)) return true
  if (/这会儿.{0,8}(累|烦|满)/.test(t)) return true
  if (/先(放|歇|缓缓|停)/.test(t)) return true
  if (/歇会儿|歇歇|缓缓/.test(t)) return true
  if (/晚点再(处理|想|碰)|晚点再.{0,6}也没/.test(t)) return true
  if (/烦心事/.test(t)) return true
  if (/不妨.*(歇|缓缓|休息|睡|早点)/.test(t)) return true
  if (/今天的事情/.test(t) && /(放|搁|缓)/.test(t)) return true
  return false
}

export function companionRecentRestPermissionSaturated(recent: string[]): boolean {
  let count = 0
  for (const line of recent) {
    if (companionTextHasTodayRestPermissionTemplate(line)) count += 1
    if (count >= 2) return true
  }
  return false
}

export function buildTodayRestPermissionRetryUserSuffix(): string {
  return [
    '【硬约束·重写】最近已是「今天有点累/歇会儿/缓缓/先放一放」类休息许可套句。',
    '本句须换句法：写温柔短问句（以？结尾）或一句具体身体感受/小事；禁止歇/缓缓/放一放/早点休息/烦心事。',
  ].join('')
}

export function buildBodyRestBanPromptLine(): string {
  return '【勿再套句】最近已有眼睛/肩颈+休息类句：本句禁止眼睛/眼酸/肩颈/脖子/休息/歇/停一下/闭一会儿/处理手头的事/让眼睛歇。'
}
