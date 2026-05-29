/**
 * 陪伴短句「白名单句法」——每轮强制一种可写结构，从根上避免模型默认写
 * 「偶尔…，…也是/世界并不会…」式逗号升华格言。
 */

import { companionRecentBodyRestSaturated } from './companionLineSimilarity'

export type CompanionArchetypeId =
  | 'body_sense'
  | 'plain_can'
  | 'today_ok'
  | 'not_but'
  | 'short_question'
  | 'patience'
  | 'one_metaphor'
  | 'concrete_pause'

export type CompanionArchetype = {
  id: CompanionArchetypeId
  mandate: string
}

/** 每种白名单句法的示例句（结构示范，非禁词表；校验不通过时按 archetype 抽取）。 */
export const COMPANION_ARCHETYPE_EXEMPLARS: Record<
  CompanionArchetypeId,
  readonly string[]
> = {
  body_sense: [
    '脑子有点满的时候，写下来会轻一点。',
    '肩膀发紧的话，可以往后靠几秒。',
  ],
  plain_can: [
    '可以晚一点再想想今天的事。',
    '这件事不用今晚想明白，明天也行。',
  ],
  today_ok: [
    '今天已经推进了不少，停一下也合理。',
    '今天够用了，剩下的留给明天的你。',
  ],
  not_but: [
    '不是你不努力，而是今天已经够满了。',
    '难的部分留到精神好一点再做。',
  ],
  short_question: [
    '此刻更想安静一会儿，还是出去走走？',
    '今天哪件小事让你稍微松了一点？',
  ],
  patience: [
    '晚一点再回那条消息，也没关系。',
    '晚一点再处理也行，不必赶在这一刻。',
  ],
  one_metaphor: [
    '桌面乱的话，收一两样就好。',
    '可以把闹钟往后推十分钟，不丢人。',
  ],
  concrete_pause: [
    '今天到此为止也可以，不必续命加班。',
    '刚才那阵忙乱过去了，现在慢下来也行。',
  ],
}

export const COMPANION_ARCHETYPES: readonly CompanionArchetype[] = [
  {
    id: 'body_sense',
    mandate:
      '【灵感·身体感受】可写身体/感官（眼酸、肩沉、呼吸浅等）+ 短回应；勿套「偶尔」格言；勿逗号后人生升华。',
  },
  {
    id: 'plain_can',
    mandate:
      '【灵感·直白许可】可用「可以/不妨/允许」许可一件小事；单重心；勿猜用户现场（邮件/茶/家务）。',
  },
  {
    id: 'today_ok',
    mandate:
      '【灵感·此刻】可用「今天/此刻」+ 内在节奏或感受；勿抽象放空/窗外；勿猜具体事务。',
  },
  {
    id: 'not_but',
    mandate:
      '【灵感·对比】可用「不是…而是…」或「与其…不如…」口语对比；须具体，勿文艺堆砌。',
  },
  {
    id: 'short_question',
    mandate:
      '【灵感·短问句】一句温柔问句，以？结尾；问感受或选择，禁止说教套话。',
  },
  {
    id: 'patience',
    mandate:
      '【灵感·耐心】可用「晚一点/不用急」+ 内在节奏；勿写邮件/消息/茶/家务；勿逗号后升华。',
  },
  {
    id: 'one_metaphor',
    mandate:
      '【灵感·轻隐喻】一处抽象轻意象（窗缝光/安静/节奏）；勿具体物品与读书动作；勿「像…一样」。',
  },
  {
    id: 'concrete_pause',
    mandate:
      '【灵感·收束】可用「今天够用了/到此为止」类判断；禁止先到这儿/先放一放/已经很好/歇会儿套句。',
  },
] as const

/** 可选灵感方向（非强制句法模板）；写入 input.prompt 时作轻提示。 */
export function buildWritingAngleTaskHint(archetype: CompanionArchetype): string {
  const hints: Record<CompanionArchetypeId, string> = {
    body_sense: '【灵感】可写身体/感官 + 短回应；勿放空/放松/思绪口号。',
    plain_can: '【灵感】可用「可以/允许」许可小事；勿猜邮件/茶/家务。',
    today_ok: '【灵感】可用「今天/此刻」+ 内在节奏；勿猜具体事务。',
    not_but: '【灵感】可用「不是…而是…」或「与其…不如…」口语对比。',
    short_question: '【灵感】可写温柔问句，以？结尾。',
    patience: '【灵感】可用「晚一点/不用急」+ 内在节奏；勿写邮件/茶/家务。',
    one_metaphor: '【灵感】可有一处轻隐喻；勿窗外/闭上眼/思绪。',
    concrete_pause: '【灵感】可用「今天够用了/先搁着」；禁止先到这儿/先放一放/已经很好。',
  }
  return hints[archetype.id]
}

function hashStringForArchetype(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(33, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function hashRecentForArchetype(recent: string[]): number {
  return recent.reduce((acc, line) => acc + hashStringForArchetype(line), 0)
}

/** 本轮唯一允许的句法（写入 writing_angle / opening constraint）。 */
export function pickCompanionArchetype(
  seed: number,
  recent: string[] = [],
): CompanionArchetype {
  const cleaned = recent.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const idx =
    Math.abs(seed + hashRecentForArchetype(cleaned) * 19 + cleaned.length * 11) %
    COMPANION_ARCHETYPES.length
  return COMPANION_ARCHETYPES[idx]!
}

export function companionArchetypeIndex(id: CompanionArchetypeId): number {
  return COMPANION_ARCHETYPES.findIndex((a) => a.id === id)
}

/** 模型套句时换用相邻句法，避免与上一轮同 archetype 示例。 */
export function pickAlternateCompanionArchetype(
  current: CompanionArchetype,
  seed: number,
): CompanionArchetype {
  const offset =
    1 + (Math.abs(seed) % Math.max(1, COMPANION_ARCHETYPES.length - 1))
  const idx =
    (companionArchetypeIndex(current.id) + offset) %
    COMPANION_ARCHETYPES.length
  return COMPANION_ARCHETYPES[idx]!
}

/** 换句且有兴趣时：body_sense 置后；最近已有身体+休息句时剔除 body_sense。 */
const REGENERATE_INTEREST_SAFE_IDS: readonly CompanionArchetypeId[] = [
  'plain_can',
  'concrete_pause',
  'patience',
  'not_but',
  'short_question',
  'body_sense',
] as const

function poolWithoutBodySenseIfRecent(
  pool: readonly CompanionArchetype[],
  recent: string[],
): CompanionArchetype[] {
  if (!companionRecentBodyRestSaturated(recent)) {
    return [...pool]
  }
  const filtered = pool.filter((a) => a.id !== 'body_sense')
  return filtered.length > 0 ? filtered : [...pool]
}

export function pickRegenerateCompanionArchetype(
  seed: number,
  recent: string[] = [],
  hasInterests = false,
): CompanionArchetype {
  const cleaned = recent.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (!hasInterests) {
    const base = pickCompanionArchetype(seed, cleaned)
    const alt = pickAlternateCompanionArchetype(base, seed)
    if (alt.id === 'body_sense' && companionRecentBodyRestSaturated(cleaned)) {
      const pool = poolWithoutBodySenseIfRecent(COMPANION_ARCHETYPES, cleaned)
      const idx =
        Math.abs(seed + cleaned.length * 31) % pool.length
      return pool[idx]!
    }
    return alt
  }
  const basePool = COMPANION_ARCHETYPES.filter((a) =>
    REGENERATE_INTEREST_SAFE_IDS.includes(a.id),
  )
  const pool = poolWithoutBodySenseIfRecent(basePool, cleaned)
  const idx =
    Math.abs(
      seed + cleaned.length * 31 + hashRecentForArchetype(cleaned) * 7,
    ) % pool.length
  return pool[idx]!
}

function hashSeedPart(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(33, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** 模型仍违反结构时，从本轮 archetype 示例句中抽取（与 writing_angle 一致）。 */
function exemplarFitsLocalTime(line: string, now: Date = new Date()): boolean {
  const h = now.getHours()
  if (h >= 17 || h < 6) return true
  if (/今天先到这儿|剩下的明天再碰|今天只做到这里.*已经够了/.test(line)) {
    return false
  }
  return true
}

/** 模型或兜底是否原样输出 archetype 示范句（用户会看到「全是一个类型」）。 */
export function companionLineEqualsArchetypeExemplar(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  for (const pool of Object.values(COMPANION_ARCHETYPE_EXEMPLARS)) {
    for (const exemplar of pool) {
      if (t === exemplar.replace(/\s+/g, ' ').trim()) return true
    }
  }
  return false
}

export function pickArchetypeExemplarLine(
  archetypeId: CompanionArchetypeId,
  opts: { seed?: number; maxChars: number; avoidRecent?: string[]; now?: Date },
): string {
  const now = opts.now ?? new Date()
  const pool = [...COMPANION_ARCHETYPE_EXEMPLARS[archetypeId]].filter((line) =>
    exemplarFitsLocalTime(line, now),
  )
  const seed = opts.seed ?? Date.now()
  const avoid = (opts.avoidRecent ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const ordered = (pool.length > 0 ? pool : [...COMPANION_ARCHETYPE_EXEMPLARS.body_sense]).sort(
    (a, b) => hashSeedPart(`${seed}:${a}`) - hashSeedPart(`${seed}:${b}`),
  )

  for (const line of ordered) {
    const trimmed =
      line.length <= opts.maxChars
        ? line
        : `${line.slice(0, Math.max(1, opts.maxChars - 1))}…`
    if (avoid.some((r) => r.length >= 5 && trimmed.includes(r.slice(0, 5)))) {
      continue
    }
    return trimmed
  }
  return ordered[0] ?? '可以晚一点再想想今天的事。'
}
