import { companionRegenerateModelLineUnacceptable } from '../prompts/companionRegenerateGate'
import type { CompanionCopyStyle } from '../prompts/textPrompt'
import {
  companionLineDuplicateOfReplaceTarget,
  companionLineExactDuplicateInList,
} from '../prompts/companionOutputGate'
import { companionLineTooSimilarToAny } from '../prompts/companionLineSimilarity'

/**
 * 换一句 / 类似这句：人工维护白名单（对用户说话：你/可以/不妨，非「我」扮演用户）。
 */
export const COMPANION_REGENERATE_POOL: readonly string[] = [
  '可以晚一点再想想今天的事。',
  '今天的事情够多了，不必再加码。',
  '这件事不用今晚想明白，明天也行。',
  '可以先把最急的那件做完，别的先搁着。',
  '今天已经推进了不少，停一下也合理。',
  '难的部分留到精神好一点再做。',
  '允许自己今天只完成一小步。',
  '可以把闹钟往后推十分钟，不丢人。',
  '刚才那阵忙乱过去了，现在慢下来也行。',
  '不必把话说满，留一点空白给自己。',
  '今天到此为止也可以，不必续命加班。',
  '你已经在处理了，不必再责备自己。',
  '可以换个小任务，让大脑换个频道。',
  '今天够用了，剩下的留给明天的你。',
  '可以伸个懒腰，再决定要不要继续。',
  '手头这件事在动了，不必再催自己。',
  '脑子有点满的时候，写下来会轻一点。',
  '不必一次想明白，分几次想也行。',
  '累的时候，允许自己慢半拍也行。',
  '今天做到这里，已经算对自己交代了。',
  '晚一点再处理也行，不必赶在这一刻。',
  '你不必对每个待办都立刻做完。',
  '今天已经推进了不少，停一下也合理。',
  '今天够用了，剩下的留给明天的你。',
] as const

/** 励志换句专用参考句（无「一步/分量/方向」词，避免模型套「这一步你可以开始了」）。 */
const REGENERATE_MOTIVATIONAL_ANCHORS: readonly string[] = [
  '今天已经推进了不少，停一下也合理。',
  '今天够用了，剩下的留给明天的你。',
  '你不必对每个待办都立刻做完。',
  '今天的事情够多了，不必再加码。',
  '难的部分留到精神好一点再做。',
  '晚一点再处理也行，不必赶在这一刻。',
] as const

const REGENERATE_CHICKEN_SOUP_ANCHORS: readonly string[] = [
  '你已经很勇敢了，只是今天看起来不明显。',
  '生活不会一直难，也不会一直顺，但你会慢慢学会和自己相处。',
  '今天的你，已经比昨天多撑过了一天。',
  '有些路得一个人走，但你不等于一个人。',
  '慢慢来，比较快；先把自己照顾好。',
] as const

const REGENERATE_COOL_ANCHORS: readonly string[] = [
  '不必解释，懂的人自然懂。',
  '就这样，也挺好。',
  '今天到此为止，够了。',
  '话少，不代表没在想。',
  '不必把话说满，留白也行。',
] as const

/** 不宜作【语气参考】：模型易改写成「我+猜现场」或「这一步」口号。 */
const REGENERATE_ANCHOR_SKIP =
  /窗口|关掉|关几个|少开|呼吸|算数|分量|付出|走的这一步|一小步|往前|方向对了|桌面|消息|屏幕|暗|舒服|通知|乱|收走|收一两|喝口|肩膀|眼睛|站起来|那条消息|铃声|待办都|这一步|可以开始|本来就有|心里的光|一首歌|可以只|但别|每一次尝试|试过的每|都在为下|都在悄悄|铺路|不必对自己那么严格|你已经很不容易/

export function pickRegenerateStyleAnchor(
  seed: number,
  style: CompanionCopyStyle = '治愈',
): string {
  if (style === '励志' || style === '鸡汤') {
    const pool =
      style === '鸡汤' ? REGENERATE_CHICKEN_SOUP_ANCHORS : REGENERATE_MOTIVATIONAL_ANCHORS
    const idx = Math.abs(seed) % pool.length
    return pool[idx]!
  }
  if (style === '高冷') {
    const idx = Math.abs(seed) % REGENERATE_COOL_ANCHORS.length
    return REGENERATE_COOL_ANCHORS[idx]!
  }
  let pool = COMPANION_REGENERATE_POOL.filter(
    (line) => !REGENERATE_ANCHOR_SKIP.test(line),
  )
  if (pool.length === 0) {
    pool = [...COMPANION_REGENERATE_POOL]
  }
  const idx = Math.abs(seed) % pool.length
  return pool[idx]!
}

export type PickCompanionRegenerateLineInput = {
  maxChars: number
  avoidRecent?: string[]
  replaceTarget?: string
  seed?: number
  style?: CompanionCopyStyle
}

function buildRecentGuard(input: PickCompanionRegenerateLineInput): string[] {
  const recent = [...(input.avoidRecent ?? [])]
  const target = input.replaceTarget?.replace(/\s+/g, ' ').trim()
  if (target) recent.push(target)
  return recent
}

function poolLineAcceptable(
  line: string,
  maxChars: number,
  style: CompanionCopyStyle = '治愈',
): boolean {
  return !companionRegenerateModelLineUnacceptable(line, {
    maxChars,
    style,
  })
}

/**
 * 从白名单句库选一句：与最近展示 / 当前气泡在起笔与词组上明显不同。
 */
function regeneratePoolForStyle(style: CompanionCopyStyle): readonly string[] {
  if (style === '励志') {
    return REGENERATE_MOTIVATIONAL_ANCHORS
  }
  if (style === '鸡汤') {
    return REGENERATE_CHICKEN_SOUP_ANCHORS
  }
  if (style === '高冷') {
    return REGENERATE_COOL_ANCHORS
  }
  return COMPANION_REGENERATE_POOL
}

export function pickCompanionRegenerateLine(
  input: PickCompanionRegenerateLineInput,
): string {
  const recent = buildRecentGuard(input)
  const style = input.style ?? '治愈'
  const sourcePool = regeneratePoolForStyle(style)
  const fitsLength = sourcePool.filter(
    (line) =>
      line.length <= input.maxChars &&
      poolLineAcceptable(line, input.maxChars, style),
  )
  const pool =
    fitsLength.length > 0
      ? fitsLength
      : sourcePool.filter((line) =>
          poolLineAcceptable(line, input.maxChars, style),
        )

  const diverse = pool.filter((line) => {
    if (companionLineExactDuplicateInList(line, recent)) return false
    if (companionLineTooSimilarToAny(line, recent)) return false
    const target = input.replaceTarget?.replace(/\s+/g, ' ').trim()
    if (target && companionLineDuplicateOfReplaceTarget(line, target)) {
      return false
    }
    return true
  })

  const candidates =
    diverse.length > 0
      ? diverse
      : pool.filter((line) => !companionLineExactDuplicateInList(line, recent))
  const seed =
    input.seed ?? (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const start = Math.abs(seed) % candidates.length
  for (let i = 0; i < candidates.length; i++) {
    const line = candidates[(start + i) % candidates.length]!
    if (!companionLineTooSimilarToAny(line, recent)) return line
  }
  return candidates[start] ?? '可以晚一点再想想今天的事。'
}

/** 换句：必须与屏上句字面不同（避免模型连刷同一句或句库误选同条）。 */
export function pickCompanionRegenerateLineDistinct(
  input: PickCompanionRegenerateLineInput & { mustDifferFrom?: string },
): string {
  const must = input.mustDifferFrom?.replace(/\s+/g, ' ').trim()
  if (!must) return pickCompanionRegenerateLine(input)
  for (let i = 0; i < 16; i++) {
    const seed =
      (input.seed ?? Date.now()) + i * 1_048_583
    const line = pickCompanionRegenerateLine({
      ...input,
      seed,
      replaceTarget: must,
    })
    if (line.replace(/\s+/g, ' ').trim() !== must) return line
  }
  return '可以晚一点再想想今天的事。'
}
