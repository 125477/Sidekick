/**
 * 陪伴短句「白名单句法」——每轮强制一种可写结构，从根上避免模型默认写
 * 「偶尔…，…也是/世界并不会…」式逗号升华格言。
 */

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
    '眼皮有点沉，允许自己先慢半拍。',
    '肩膀一直提着，可以先把它放下来。',
  ],
  plain_can: [
    '可以先把这件事放一放，不必现在想明白。',
    '允许今天只做到这里，也已经够了。',
  ],
  today_ok: [
    '今天先到这儿，剩下的明天再碰。',
    '此刻先把呼吸放慢半拍就好。',
  ],
  not_but: [
    '不是你不努力，而是今天已经够满了。',
    '与其逼自己立刻想通，不如先喘口气。',
  ],
  short_question: [
    '此刻更想安静一会儿，还是出去走走？',
    '今天哪件小事让你稍微松了一点？',
  ],
  patience: [
    '晚一点再决定也没关系。',
    '不用急着给出答案，先让心跳慢下来。',
  ],
  one_metaphor: [
    '窗缝漏进一点光，先到这儿歇口气。',
    '桌面安静了一会儿，不必急着填满它。',
  ],
  concrete_pause: [
    '先到这儿，已经很好。',
    '先放一放，不必马上接着扛。',
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
      '【灵感·口语停顿】可用「先到这儿/先放一放/先喘口气」；无世界观升华；勿「偶尔…，…」。',
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
    concrete_pause: '【灵感】可用「先到这儿/先喘口气」口语；勿抽象放松口号。',
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

function hashSeedPart(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(33, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** 模型仍违反结构时，从本轮 archetype 示例句中抽取（与 writing_angle 一致）。 */
export function pickArchetypeExemplarLine(
  archetypeId: CompanionArchetypeId,
  opts: { seed?: number; maxChars: number; avoidRecent?: string[] },
): string {
  const pool = [...COMPANION_ARCHETYPE_EXEMPLARS[archetypeId]]
  const seed = opts.seed ?? Date.now()
  const avoid = (opts.avoidRecent ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const ordered = pool.sort(
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
  return ordered[0] ?? '先到这儿也很好。'
}
