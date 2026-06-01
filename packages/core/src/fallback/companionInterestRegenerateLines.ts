/**
 * 换句兜底：歌词 / 影视台词 / 书本文摘，且须与「语气类型」一致。
 * API 失败时上屏；按 style × 兴趣标签抽取，避免治愈语气落到恐惧/撕裂类金句。
 */
import { companionLineTooSimilarToAny } from '../prompts/companionLineSimilarity'
import type { CompanionCopyStyle } from '../prompts/textPrompt'

/** 语气 × 兴趣 → 金句池（≤32 字为主）。 */
const QUOTE_BY_STYLE_AND_TAG: Record<
  CompanionCopyStyle,
  Record<string, readonly string[]>
> = {
  治愈: {
    音乐: [
      '春风再美也比不上你的笑。',
      '你笑起来真好看，像春天的花一样。',
      '后来我总算学会了，如何去爱。',
      '你会不会忽然地出现，在街角的咖啡店。',
      '岁月神偷，偷走许多，也留下许多。',
    ],
    影视: [
      '念念不忘，必有回响。',
      '有些鸟儿是关不住的，它们的羽毛太鲜亮了。',
      '我会成为自己的山，然后寻找大海。',
      '生活就像一盒巧克力，你永远不知道下一颗是什么。',
    ],
    书籍: [
      '生如夏花之绚烂，死如秋叶之静美。',
      '世界上只有一种英雄主义，是认清真相后依然热爱生活。',
      '人是为了活着本身而活着，不是为了活着之外的任何事物。',
      '从前车马很慢，书信很远，一生只够爱一个人。',
    ],
    运动: ['身体记得每一次呼吸，今天不必跑到终点。', '慢一点，也算在向前。'],
    游戏: ['这一局可以先存档，明天再开新地图。', '输赢之外，还有一局可以重来。'],
    旅行: ['在路上，风会把心事吹轻一点。', '下一站还远，先在这一站歇一会儿。'],
  },
  励志: {
    音乐: [
      '我要一步一步往上爬，在最高点乘着叶片往前飞。',
      '海阔天空，在勇敢以后。',
      '向前跑，迎着冷眼和嘲笑。',
      '最初的梦想，绝对会到达。',
    ],
    影视: [
      '做人如果没有梦想，跟咸鱼有什么分别。',
      '我们一路奋战，不是为了改变世界，而是为了不让世界改变我们。',
      '人生不能像做菜，等所有料齐才下锅。',
    ],
    书籍: [
      '世上无难事，只要肯登攀。',
      '所有命运赠送的礼物，早已在暗中标好了价格。',
      '当你穿过了暴风雨，就不再是原来那个人。',
    ],
    运动: ['再跑一步，也算向前。', '今天多走一点，明天就轻一点。'],
    游戏: ['这一关难，下一关也许就顺了。', '输了这局，还有下一局。'],
    旅行: ['路还长，但已经在路上了。', '远方会到，先把这一步走稳。'],
  },
  搞笑: {
    音乐: ['我是一只小小小小鸟，想要飞呀飞却飞也飞不高。', '爱情不是你想买，想买就能买。'],
    影视: [
      '做人如果没有梦想，跟咸鱼有什么分别。',
      '我养你啊。',
      '你过来啊。',
    ],
    书籍: ['生活不止眼前的苟且，还有诗和远方的田野。'],
    运动: ['运动五分钟，拍照两小时。'],
    游戏: ['又菜又爱玩，也是一种坚持。'],
    旅行: ['人在囧途，心在远方。'],
  },
  助眠: {
    音乐: [
      '月亮代表我的心。',
      '夜空中最亮的星，请照亮我前行。',
      '睡吧，睡吧，我亲爱的宝贝。',
    ],
    影视: ['晚安，好梦。', '世界安静了，你也该歇一歇。'],
    书籍: ['静夜思，床前明月光。', '人间烟火气，最抚凡人心。'],
    运动: ['拉伸一下，把力气收回来。'],
    游戏: ['先下线，明天再开服。'],
    旅行: ['到站了，先歇脚。'],
  },
  职场解压: {
    音乐: ['平凡之路，依然值得走。', '慢下来，也是一种前进。'],
    影视: [
      '人生不能像做菜，等所有料齐才下锅。',
      '不必一次做完，允许今天只到这儿。',
    ],
    书籍: [
      '生活不是赶场，允许慢下来。',
      '工作之外，还有一整块人生。',
    ],
    运动: ['下班后的步数，算给自己的。'],
    游戏: ['存档，明天再战。'],
    旅行: ['不必赶到下一站，这一站也够用。'],
  },
  抽象: {
    音乐: ['最怕空气突然安静，最怕突然的关心。', '十年之前，我不认识你，你不属于我。'],
    影视: ['人生不能像做菜，等所有料齐才下锅。', '念念不忘，必有回响。'],
    书籍: ['过去都是假的，回忆是一条没有归途的路。', '所有命运赠送的礼物，早已在暗中标好了价格。'],
    运动: ['身体在，路就在。'],
    游戏: ['这局还没结束，但也未必非赢不可。'],
    旅行: ['路在脚下，也在脑子里。'],
  },
  鸡汤: {
    音乐: [
      '后来，我总算学会了如何去爱。',
      '你笑起来真好看，像春天的花一样。',
      '岁月神偷，偷走许多，也留下许多。',
    ],
    影视: [
      '生活就像一盒巧克力，你永远不知道下一颗是什么。',
      '念念不忘，必有回响。',
      '有些鸟儿是关不住的，它们的羽毛太鲜亮了。',
    ],
    书籍: [
      '世界上只有一种英雄主义，是认清真相后依然热爱生活。',
      '从前车马很慢，书信很远，一生只够爱一个人。',
      '生如夏花之绚烂，死如秋叶之静美。',
    ],
    运动: ['慢一点，也算在向前。', '身体记得每一次呼吸。'],
    游戏: ['输赢之外，还有一局可以重来。'],
    旅行: ['在路上，风会把心事吹轻一点。'],
  },
  沙雕: {
    音乐: ['我是一只小小小小鸟，想要飞呀飞却飞也飞不高。', '爱情不是你想买，想买就能买。'],
    影视: ['做人如果没有梦想，跟咸鱼有什么分别。', '你过来啊。'],
    书籍: ['生活不止眼前的苟且，还有诗和远方的田野。'],
    运动: ['运动五分钟，拍照两小时。'],
    游戏: ['又菜又爱玩，也是一种坚持。'],
    旅行: ['人在囧途，心在远方。'],
  },
  高冷: {
    音乐: ['十年之前，我不认识你，你不属于我。'],
    影视: ['人生不能像做菜，等所有料齐才下锅。'],
    书籍: ['所有命运赠送的礼物，早已在暗中标好了价格。'],
    运动: ['今天到此为止，够了。'],
    游戏: ['先下线，明天再说。'],
    旅行: ['下一站还远，不必急着证明。'],
  },
}

const STYLE_GENERIC_QUOTE: Record<CompanionCopyStyle, readonly string[]> = {
  治愈: ['春风再美也比不上你的笑。', '后来我总算学会了，如何去爱。'],
  励志: ['海阔天空，在勇敢以后。', '我要一步一步往上爬。'],
  搞笑: ['做人如果没有梦想，跟咸鱼有什么分别。'],
  助眠: ['月亮代表我的心。', '夜空中最亮的星，请照亮我前行。'],
  职场解压: ['平凡之路，依然值得走。', '不必一次做完，允许今天只到这儿。'],
  抽象: ['最怕空气突然安静，最怕突然的关心。', '十年之前，我不认识你，你不属于我。'],
  鸡汤: ['后来，我总算学会了如何去爱。', '世界上只有一种英雄主义，是认清真相后依然热爱生活。'],
  沙雕: ['做人如果没有梦想，跟咸鱼有什么分别。', '又菜又爱玩，也是一种坚持。'],
  高冷: ['不必解释，懂的人自然懂。', '就这样，也挺好。'],
}

const DEFAULT_STYLE: CompanionCopyStyle = '治愈'

function resolveStylePool(style: CompanionCopyStyle | undefined): Record<string, readonly string[]> {
  return QUOTE_BY_STYLE_AND_TAG[style ?? DEFAULT_STYLE] ?? QUOTE_BY_STYLE_AND_TAG[DEFAULT_STYLE]
}

export function pickCompanionInterestRegenerateLine(input: {
  interestTags: string[]
  style?: CompanionCopyStyle
  maxChars: number
  seed?: number
  avoidRecent?: string[]
  replaceTarget?: string
}): string {
  const style = input.style ?? DEFAULT_STYLE
  const byTag = resolveStylePool(style)
  const pool: string[] = []
  for (const tag of input.interestTags) {
    const lines = byTag[tag]
    if (lines) pool.push(...lines)
  }
  if (pool.length === 0) {
    pool.push(...(STYLE_GENERIC_QUOTE[style] ?? STYLE_GENERIC_QUOTE[DEFAULT_STYLE]))
  }

  const recent = [...(input.avoidRecent ?? [])]
  const target = input.replaceTarget?.replace(/\s+/g, ' ').trim()
  if (target) recent.push(target)

  const fits = pool.filter(
    (line) =>
      line.length <= input.maxChars &&
      !companionLineTooSimilarToAny(line, recent, {
        maxContiguousOverlap: 6,
        sameFirstChar: false,
      }),
  )
  const candidates = fits.length > 0 ? fits : pool.filter((l) => l.length <= input.maxChars)
  const seed =
    input.seed ?? (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const start = Math.abs(seed) % Math.max(1, candidates.length)
  for (let i = 0; i < candidates.length; i++) {
    const line = candidates[(start + i) % candidates.length]!
    if (target && line.replace(/\s+/g, ' ').trim() === target) continue
    return line.length <= input.maxChars
      ? line
      : `${line.slice(0, Math.max(1, input.maxChars - 1))}…`
  }
  const fallback = STYLE_GENERIC_QUOTE[style]?.[0] ?? STYLE_GENERIC_QUOTE[DEFAULT_STYLE][0]!
  return fallback.length <= input.maxChars
    ? fallback
    : `${fallback.slice(0, Math.max(1, input.maxChars - 1))}…`
}

/** 换句 prompt：抽 2 条与语气一致的歌词/台词参考（勿照抄）。 */
export function pickCompanionInterestQuoteFewShots(input: {
  interestTags: string[]
  style?: CompanionCopyStyle
  maxChars: number
  count?: number
  seed?: number
  avoidRecent?: string[]
}): string[] {
  const count = input.count ?? 2
  const baseSeed = input.seed ?? Date.now()
  const picked: string[] = []
  for (let i = 0; i < count + 8; i++) {
    const line = pickCompanionInterestRegenerateLine({
      interestTags: input.interestTags,
      maxChars: input.maxChars,
      seed: baseSeed + i * 991,
      avoidRecent: [...(input.avoidRecent ?? []), ...picked],
      ...(input.style !== undefined ? { style: input.style } : {}),
    })
    if (!picked.includes(line)) picked.push(line)
    if (picked.length >= count) break
  }
  return picked
}

const GENERIC_HEAL_NOT_QUOTE =
  /今天不顺|明天会好|深呼吸|广阔的世界|今天有点累|晚一点也没关系|不妨先|让自己放松|慢慢来|在这广阔|每个人都有自己的位置/

/** 选了兴趣却写成「晚风/午后/片刻/灵魂」类散文，不算歌词/台词。 */
const FAUX_POETIC_NOT_QUOTE =
  /愿你|愿你如|月光洒落|温柔照亮|洗净尘世|潺潺流淌|晚风|午后|心灵|灵魂|片刻|安宁|静谧|栖息|在这.{0,6}片刻|缓缓舒展|慢慢流淌|静静感受|放下也是一种|每一次呼吸|今天够用了|明天再说|慢慢品味|慢慢归位|不妨让时间|不妨就这样|心事渐远|在这温柔的|让心慢慢|让时间慢慢|也是一种拥有|得以栖息|心中自/

const POETIC_MARKER_SNIPPETS = [
  '风起时',
  '茶凉时',
  '暮色',
  '窗棂',
  '像未说完',
  '轻轻停驻',
  '不妨让心',
] as const

/** 已选兴趣时：模型若仍写休息许可/散文套句，视为未达标（应重试或走金句兜底）。 */
export function companionRegenerateLineFailsInterestQuoteMode(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (GENERIC_HEAL_NOT_QUOTE.test(t)) return true
  if (FAUX_POETIC_NOT_QUOTE.test(t)) return true
  if (POETIC_MARKER_SNIPPETS.some((m) => t.includes(m))) return true
  return false
}

export function companionInterestTagsRequireQuote(
  tags: string[],
): boolean {
  return tags.some((t) =>
    ['音乐', '影视', '书籍', '运动', '游戏', '旅行'].includes(t),
  )
}
