/**
 * 陪伴文案提示词与校验（双路径）：
 *
 * - **百炼智能体（主路径）**：控制台系统提示词见 `docs/BAILIAN_AGENT_PROMPT.md`；接入说明见 `docs/BAILIAN_COMPANION_AGENT.md`；
 *   本文件提供 `buildCompanionAgentUserPromptParams` / `buildCompanionAgentUserPrompt`。
 * - **chat/completions（回退）**：`buildCompanionSystemPrompt` + user 提示 + 生成后校验/重试。
 *
 * 勿删本模块：回退链路、轻反馈、兜底句过滤仍依赖此处。
 *
 * ## 定稿原则（勿反复横跳）
 * 1. **通顺完整** > 文艺；禁止半截句（如「包括被自己。」）。
 * 2. **治愈** 自由写一句，无固定句型；单重心；禁止套句与逗号后半升华。
 * 3. **只拦硬套**：「像…一样」、轻轻停驻、风起/茶凉/暮色爆款、励志对仗、办公词、指令/拯救/条件价值、「累了就歇」类口语套句。
 * 4. **允许** 一处克制意象（书页/故事里的停顿）；**禁止** 把治愈写成七字口号（如「累了就歇会儿。」）。
 * 5. 智能体路径：**气质参考 few-shot**（`companionStyleExemplars.ts`）+ 相似度去重；**不**向模型堆禁词表。
 */
import type { EmotionKind } from '../schema/data'
import { COMPANION_DESKTOP_SCENE_CONTEXT } from './companionSceneContext'
import { buildContrastWithLastLine } from './companionArchetypeContrast'
import {
  buildStyleReferenceBlock,
} from './companionStyleExemplars'
import {
  collectRecentBigramsForAvoid,
  collectRecentOpeningPrefixes,
} from './companionLineSimilarity'
import {
  pickCompanionArchetype,
  type CompanionArchetype,
} from './companionArchetypes'
import { sanitizeRecentCompanionLinesForPrompt } from './sanitizeRecentCompanionLines'

export { pickCompanionArchetype, type CompanionArchetype } from './companionArchetypes'
export {
  buildContrastWithLastLine,
  collectBannedOpeningsFromRecent,
} from './companionArchetypeContrast'
export { buildStyleReferenceBlock, pickStyleFewShots } from './companionStyleExemplars'
export {
  buildCompanionDiversityRetrySuffix,
  collectRecentBigramsForAvoid,
  companionLineTooSimilarToAny,
  companionLineReusesRecentBigrams,
  companionTextHasSceneryMoodCliche,
  longestContiguousHanOverlap,
} from './companionLineSimilarity'

export type CompanionCopyStyle =
  | '治愈'
  | '励志'
  | '搞笑'
  | '助眠'
  | '职场解压'
  | '抽象'

/** UI 标签 → 存储枚举，用于情绪反馈与文案联动 */
export function emotionCnLabelToKind(label: string): EmotionKind | undefined {
  const map: Record<string, EmotionKind> = {
    开心: 'happy',
    愉快: 'happy',
    平静: 'calm',
    感动: 'calm',
    焦虑: 'anxious',
    烦躁: 'anxious',
    低落: 'low',
    疲惫: 'tired',
  }
  return map[label.trim()]
}

export const EMOTION_CN_LABEL: Record<EmotionKind, string> = {
  happy: '开心',
  calm: '平静',
  anxious: '焦虑',
  low: '低落',
  tired: '疲惫',
}

const EMOTION_GUIDE: Record<EmotionKind, string> = {
  happy: '此刻偏愉悦，语气轻快温暖，避免浮夸鸡血。',
  calm: '此刻偏平稳，承接与许可为主；可直白可一处轻隐喻，禁止「像…一样」与爆款套句。',
  anxious:
    '此刻偏焦虑，先承接不安再给许可，避免说教与否定感受；禁止「像…一样」与连刷口语模板。',
  low: '此刻偏低落，温柔承接；禁止搞笑转移；可直白许可或一处克制意象（如故事/路里的停顿），禁止「像…一样」。',
  tired:
    '此刻偏疲惫，体谅负荷；须写满最短字数、通顺完整（可含逗号分句），禁止「累了就歇会儿」式过短套句；禁止「像…一样」与「累了就歇」骨架连刷。',
}

/**
 * 情绪反馈触发的生成：语气类型与情绪对齐（不再沿用设置里可能与情绪冲突的全局风格）。
 */
export function companionStyleForEmotion(emotion: EmotionKind): CompanionCopyStyle {
  const map: Record<EmotionKind, CompanionCopyStyle> = {
    happy: '搞笑',
    calm: '治愈',
    anxious: '治愈',
    low: '治愈',
    tired: '治愈',
  }
  return map[emotion]
}

export type BuildCompanionPromptInput = {
  style: CompanionCopyStyle
  keyword: string | undefined
  allowEmoji: boolean
  maxChars: number
  /** 最近一次情绪反馈；与风格叠加时用一句话约束语境（单次生成内嵌，无需多轮追问）。 */
  emotion?: EmotionKind
  /** user 侧会附带最近已展示句；为 true 时在 system 中加强「禁止微改编」 */
  recentOutputsGuard?: boolean
  /** 用户在设置/引导中填写的兴趣；非空时并入通义千问（DashScope）的 system 提示，见下方 `interestLines`。 */
  companionInterests?: string[]
  /**
   * 气泡「轻反馈」经通义千问归纳后的短句（本地滚动保留若干条）。
   * 写入 system 提示，影响后续陪伴句生成。
   */
  companionLightFeedbackHints?: string[]
  /** 生成时刻，用于时段参考；不传则用调用时本地时间。 */
  now?: Date
}

const STYLE_GUIDE: Record<CompanionCopyStyle, string> = {
  治愈: '治愈=承接感受、温柔许可；一句一重心，通顺完整。',
  励志:
    '可多用「我」或无人称格言；聚焦态度与微小可能，禁止鸡血口号与抽象成功学；禁止命令式打气（加油/撑住/你必须）与「只要你…就…」式条件价值；禁止写键盘、光标、加班赶场等办公套话，勿照抄常见鸡汤句。',
  搞笑:
    '仅当用户情绪为「开心」时启用；生活化自嘲或轻巧反差，禁止命令、拯救口号与条件价值；禁止在焦虑/低落情绪下用幽默转移感受；禁止办公梗。',
  助眠:
    '语气极轻、安静；写静与许可歇着，仍须写满最短字数、通顺完整，禁止只有「歇会儿」式过短套句；禁止「像…一样」与轻轻停驻；禁止睡眠指令、布置步骤与未来承诺；禁止屏幕蓝光、敲键等提神意象。',
  职场解压:
    '用人生节奏、取舍、边界感来减压（例：允许慢下来、不必一次做完），禁止会议、邮件、通知、文件、光标、键盘等办公名词；禁止命令式加班打气与条件价值。',
  抽象:
    '偏旁观、留白或轻荒诞：一句看似有道理又不完全落地的话，可自嘲或网感哲学碎片，但不刻薄、不攻击用户。禁止治愈套句（累了就歇/像…一样/风起茶凉）、禁止鸡血励志、禁止睡眠指令与办公词；禁止命令、拯救口号与条件价值；若语境偏低落/焦虑，荒诞须克制，勿用幽默否定感受。',
}

/** 各语气类型下的「反功能性相处」写作约束（写入 system，与生成后校验一致）。 */
const STYLE_ANTI_FUNCTIONAL: Record<CompanionCopyStyle, string> = {
  治愈:
    '【治愈·相处】禁止你应该/撑住/只要你…就…；其余见上方语气要求。',
  励志:
    '【励志·相处】可写微小可能与方向感，但禁止命令（你应该/快去）、禁止拯救口号（撑住/加油/没有过不去的坎）、禁止条件价值与空洞保证。',
  搞笑:
    '【搞笑·相处】轻松但不居高临下；禁止命令与拯救口号、禁止只要你…就…；禁止「笑一笑」「别难过了」式否定感受。',
  助眠:
    '【助眠·相处】只写轻、静、许可歇着；禁止任何步骤作业（先…/试试深呼吸/快睡）、禁止加油撑住与条件价值。',
  职场解压:
    '【职场解压·相处】写边界与允许慢下来，禁止更高效/冲一把/你应该扛住、禁止只要你努力就…式交换。',
  抽象:
    '【抽象·相处】禁止你应该/撑住/只要你…就…；禁止「笑一笑」「别难过了」；允许旁观留白，禁止布置任务与拯救口号。',
}

const ANTI_FUNCTIONAL_RELATIONSHIP_LINE =
  '【反功能性相处】勿把用户当任务或角色：禁止布置步骤（应该先…/记得…/别忘…）；禁止拯救口号（撑住/挺过去/没有过不去的坎/一切都会好起来）；禁止条件价值（只要你…就…/努力就会…/才配…）；优先存在许可（可以、允许、就好、在这、不必），少评价其表现。'

const PLAIN_HEALING_STYLES = new Set<CompanionCopyStyle>(['治愈', '助眠'])

/** 治愈类重试共用收尾（勿在各 build*Retry 里写互相矛盾的示例）。 */
const HEALING_QUALITY_RETRY_TAIL =
  '改通顺完整、写满最短字数的一句；**严格按 writing_angle 白名单句法重写**，禁止逗号后半句人生升华，禁止像…一样与「累了就歇」整句。'

/** 陪伴句最短汉字数（不含标点）。 */
const COMPANION_MIN_CHARS_ABSOLUTE = 10

/** 本条陪伴句至少应达到的汉字数（不含标点）；不超过 maxChars−2。 */
export function companionMinCharsForStyle(
  maxChars: number,
  _style?: CompanionCopyStyle,
): number {
  const cap = Math.max(1, maxChars - 2)
  return Math.min(cap, COMPANION_MIN_CHARS_ABSOLUTE)
}

export function companionTextTooShort(
  text: string,
  maxChars: number,
  style: CompanionCopyStyle,
): boolean {
  const t = text.replace(/[。！？….…]+$/u, '').trim()
  if (!t) return true
  return t.length < companionMinCharsForStyle(maxChars, style)
}

/** 模型连刷的「口语许可」套句（治愈语气下过密时触发重试）。 */
export const COMPANION_ORAL_PERMISSION_CLICHES = [
  '此刻停一会儿',
  '停一会儿，也可以',
  '歇一会儿，也可以',
  '累了就歇歇',
  '累了就歇着',
  '累了就歇会儿',
  '累了就歇',
  '歇歇，不算',
  '不算偷懒',
  '先停一会儿也好',
  '不用怕耽误',
] as const

/** 模型易写的「假治愈」文艺硬套（与 POETIC 校验配合）。 */
export const COMPANION_STIFF_HEALING_MARKERS = [
  '像风一样',
  '像云一样',
  '像海一样',
  '轻轻停驻',
  '轻轻停',
  '停驻',
  '驻足',
  '栖息',
  '允许自己像',
  '不妨像',
] as const

/** 模型连刷的「散文式收束」套句（与 POETIC 校验配合）。 */
export const COMPANION_LITERARY_CLOSURE_MARKERS = [
  '馈赠',
  '温柔的馈赠',
  '安放',
  '妥善安放',
  '化作',
  '化作明日',
  '化作养分',
  '静静流淌',
  '时光静静',
  '也是前行',
  '也是一种前行',
  '平和也是一种前行',
  '停驻',
  '驻足',
  '温柔的修行',
  '生活的一种温柔',
  '也是一种温柔',
  '云朵',
  '变幻',
  '偶尔停下来',
  '偶尔停',
  '偶尔发发呆',
  '偶尔允许',
  '无所事事',
  '看看云',
  '世界并不会',
  '并不会因此',
  '也是一种必要',
] as const

const OVERUSED_ADVERBS = '轻轻、慢慢、悄悄、静静、缓缓、默默'

/** 模型易复读的办公/数码套话（除非 user 关键词明确要求）。 */
export const COMPANION_DESKTOP_CLICHE_WORDS = [
  '光标',
  '键盘',
  '指尖',
  '屏幕',
  '鼠标',
  '显示器',
  '窗口',
  '通知',
  '码字',
  '敲键',
  '追剧',
  '看电影',
  '影院',
  '剧集',
  '电影',
] as const

const DESKTOP_CLICHE_BAN_LINE = `【禁止套话】不得出现：${COMPANION_DESKTOP_CLICHE_WORDS.join('、')}；勿写「让光标歇一歇」「指尖离开键盘」「生活不是赶场」等办公文艺腔。`

/** 模型高频「散文套句」特征词（与 recent 去重、生成后校验共用）。 */
export const COMPANION_POETIC_TEMPLATE_MARKERS = [
  '风起时',
  '茶凉时',
  '暮色漫过',
  '暮色',
  '窗棂',
  '窗台',
  '像未说完的句子',
  '停在唇边',
  '杯底藏着',
  '留着一盏灯',
  '不妨让心',
  '有人正为你',
  '余温在',
  '像星辰落入',
  '像风一样',
  '轻轻停驻',
  '停驻',
] as const

const POETIC_TEMPLATE_BAN_LINE =
  '【禁止文艺套句】禁止：①「X时，…」+「像…」、②「像…一样」（如像风一样轻轻停驻）；③爆款意象堆砌（风起/茶凉/暮色+窗台）；④「像未说完的句子」「杯底藏着」。治愈可一处轻隐喻+许可，须通顺，一句一重心。'

const MOTIVATIONAL_PARALLEL_BAN_LINE =
  '【禁止励志套句】禁止：①以「有些」起头的对仗句（如「有些坚持，终会…」「有些努力，不必…」）；②「不是所有…但总有一些…」；③「终会落在心头」「不必等回应也能发光」等口号式后半句。'

/**
 * 通用防套句块（智能体 `style_guide` 注入 + chat system；与 `docs/BAILIAN_AGENT_PROMPT.md` 同步）。
 */
/** 与 `docs/BAILIAN_AGENT_PROMPT.md` 同步：正向写作步骤，少堆禁词。 */
export const COMPANION_ANTI_TEMPLATE_BLOCK = [
  '【怎么写】自由写一句；无固定句型、无指定起笔。对照 avoid_recent_block 避免与最近句同套路。',
  '【禁止】不是聊天/作文/读书打卡；勿套「偶尔…也是…」「听一首/听首…让心情…」「这会儿放空/放松」；勿猜用户正在做的事；勿命令用户去听/去看/去读。',
  '【换句】与最近句起笔/重心/收束至少两项不同；连续汉字重叠≤4；禁止只换副词。',
  '【桌面场景】灵伴=角落气泡；默认用户未在读书；勿编造桌上物品、窗外风景、邮件/茶/家务等。',
  '【兴趣】若有 interests：只把意象/语感织入句中，禁止建议用户去做该活动。',
].join('\n')

/** 模型高频「有些…，…」励志平行句（与 recent 去重、生成后校验共用）。 */
export const COMPANION_MOTIVATIONAL_PARALLEL_MARKERS = [
  '终会落在',
  '不必等回应',
  '也能发光',
  '落在心头',
  '但总有一些',
  /** 曾写入 prompt 示范，模型易复读 */
  '跑起来就会有风',
  '生活或许沉闷',
] as const

export function companionTextHasMotivationalParallelTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^有些[^，,。！？\s]{1,12}[，,]/.test(t)) {
    return true
  }
  if (/不是所有.+但总有一些/.test(t)) {
    return true
  }
  if (COMPANION_MOTIVATIONAL_PARALLEL_MARKERS.some((m) => t.includes(m))) {
    return true
  }
  return false
}

export function buildMotivationalParallelRetryUserSuffix(): string {
  return '【硬约束】禁止「有些…，…」「不是所有…但总有一些…」及常见鸡汤网句。改写成单分句许可或极短判断，句式与最近句明显不同，勿照抄示范句。'
}

/** 模型易写「再…也…不…」式宿命感叹：听似格言，却无接纳或托住感。 */
export const COMPANION_BLEAK_MARKERS = [
  '照不亮',
  '照不进',
  '暖不了',
  '填不满',
  '留不住',
  '回不去',
  '无能为力',
  '所有黑',
  '所有暗',
  '救不了',
  '醒不来',
  '停不下来',
] as const

const COMFORT_SIGNALS = [
  '可以',
  '不妨',
  '允许',
  '没关系',
  '慢慢来',
  '陪着',
  '留一盏',
  '留灯',
  '会好',
  '值得',
  '接纳',
  '歇',
  '休息',
  '抱抱',
  '还好',
  '够用',
  '仍有',
  '依然',
  '总会',
  '还有',
  '为你',
  '陪你',
  '托住',
  '体谅',
  '不妨',
  '就好',
  '够了',
  '在这',
  '不必',
  '已经可以',
] as const

/** 命令式 / 作业感（各语气类型普遍禁止）。 */
export const COMPANION_INSTRUCTION_MARKERS = [
  '你应该',
  '您应该',
  '你得',
  '你必须',
  '您必须',
  '别忘',
  '别忘了',
  '记得去',
  '记得要',
  '快去',
  '一定要',
  '必须先',
  '先试',
  '先做',
  '第一步',
  '试试看',
  '不妨先',
  '先去',
  '别急着',
] as const

/** 拯救者 / 打鸡血口号（各语气类型普遍禁止）。 */
export const COMPANION_RESCUE_MARKERS = [
  '撑住',
  '挺住',
  '挺过去',
  '扛过去',
  '没有过不去',
  '一切都会',
  '阳光总在',
  '加油',
  '你能行',
  '站起来',
  '打起精神',
  '振作起来',
  '笑一笑',
  '别难过了',
  '别灰心',
  '会好起来的',
] as const

/** 存在许可信号：有则弱化对「指令/拯救」的误判（如「可以先歇」）。 */
export const COMPANION_PRESENCE_MARKERS = [
  '可以',
  '不妨',
  '允许',
  '没关系',
  '慢慢来',
  '就好',
  '够了',
  '在这',
  '不必',
  '已经可以',
  '歇',
  '休息',
  '接纳',
  '陪着',
  '陪你',
] as const

/** 语气类型额外禁止词（生成后校验）。 */
const STYLE_FUNCTIONAL_EXTRA_MARKERS: Record<CompanionCopyStyle, readonly string[]> = {
  治愈: [],
  励志: ['奋斗', '拼搏', '力争', '冲鸭'],
  搞笑: [],
  助眠: ['快睡', '睡吧', '早点睡', '赶紧睡'],
  职场解压: ['更高效', '冲一把', '赶进度', '扛住'],
  抽象: ['加油', '撑住', '你必须'],
}

function companionTextHasInstruction(t: string): boolean {
  return COMPANION_INSTRUCTION_MARKERS.some((m) => t.includes(m))
}

function companionTextHasRescue(t: string): boolean {
  return COMPANION_RESCUE_MARKERS.some((m) => t.includes(m))
}

function companionTextHasConditionalValue(t: string): boolean {
  if (/只要[^，,。！？]{1,24}就/.test(t)) return true
  if (/只有[^，,。！？]{1,24}才/.test(t)) return true
  if (/努力就会|坚持就会|就会成功|才配/.test(t)) return true
  return false
}

/**
 * 「反指令、反拯救、反条件价值」：按语气类型检验是否像功能性相处（布置任务 / 打鸡血 / 交换价值）。
 */
export function companionTextHasFunctionalTone(
  text: string,
  style: CompanionCopyStyle,
): boolean {
  const t = text.trim()
  if (!t) return false

  const instruction = companionTextHasInstruction(t)
  const rescue = companionTextHasRescue(t)
  const conditional = companionTextHasConditionalValue(t)
  const extra = STYLE_FUNCTIONAL_EXTRA_MARKERS[style].some((m) => t.includes(m))

  switch (style) {
    case '治愈':
      return instruction || rescue || conditional
    case '励志':
      return instruction || rescue || conditional || extra
    case '搞笑':
      return instruction || rescue || conditional
    case '助眠':
      return instruction || rescue || conditional || extra
    case '职场解压':
      return instruction || rescue || conditional || extra
    case '抽象':
      return instruction || rescue || conditional || extra
    default:
      return instruction || rescue || conditional
  }
}

export function buildFunctionalToneRetryUserSuffix(
  style: CompanionCopyStyle,
): string {
  const byStyle: Record<CompanionCopyStyle, string> = {
    治愈:
      '上一句像在下指令、打鸡血或讲条件。请改为：承认感受 + 允许休息/存在即可（可以、允许、就好），禁止你应该、撑住、只要你…就…。',
    励志:
      '上一句像命令式励志或条件价值。请写微小可能或方向感，禁止加油/撑住/你必须/只要你…就…/奋斗拼搏。',
    搞笑:
      '上一句像在命令或拯救。请保持轻巧自嘲，禁止你应该、撑住、笑一笑、别难过了、只要你…就…。',
    助眠:
      '上一句像在布置作业或打气。请极轻、极短，只写静与许可歇着，禁止应该先…/深呼吸/快睡/加油/撑住。',
    职场解压:
      '上一句像在要求更高效或扛住。请写边界与允许慢下来，禁止你应该、冲一把、更高效、只要你努力就…。',
    抽象:
      '上一句像治愈/励志或在下指令。请写旁观、留白或轻荒诞的一句，禁止你应该、撑住、只要你…就…、累了就歇、像…一样。',
  }
  return `【硬约束·${style}·反功能性相处】${byStyle[style]}`
}

const BLEAK_WITHOUT_COMFORT_BAN_LINE =
  '【禁止宿命感叹】禁止「再…也…不/没法…」式无力格言（如「灯火再亮，也照不亮所有黑夜」）；若写夜/暗/难，须带接纳、许可或温柔指望，让人感到被托住。'

export function companionTextHasBleakWithoutComfort(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (COMFORT_SIGNALS.some((s) => t.includes(s))) {
    return false
  }
  if (COMPANION_BLEAK_MARKERS.some((m) => t.includes(m))) {
    return true
  }
  if (/再[^，,。！？]{1,16}也(不|没|无法|不能|没法)/.test(t)) {
    return true
  }
  if (/就算[^，,。！？]{1,20}也(不|没|无法|不能|没法)/.test(t)) {
    return true
  }
  if (
    /也(不|没|无法|不能|没法)[^，,。！？]{0,20}(黑|暗|痛|冷|空|尽头|意义|用)/.test(
      t,
    )
  ) {
    return true
  }
  return false
}

export function buildBleakWithoutComfortRetryUserSuffix(): string {
  return '【硬约束】上一句像宿命感叹、只有无力感。请改写成让人被体谅或被托住的短句：允许慢下来、温柔许可或微小指望；禁止「再…也…不…」与「照不亮所有黑夜」式格言。'
}

export function companionTextHasLiteraryClosureTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  /** 只判收束句式结构，不靠禁词表 includes。 */
  if (/也是一?种.{0,8}(前行|馈赠|礼物|温柔|修行|生活)/.test(t)) {
    return true
  }
  if (/也是.{0,6}一份/.test(t)) {
    return true
  }
  if (/生活的一?种温柔/.test(t)) {
    return true
  }
  if (/此刻的.+是.+的(馈赠|礼物)/.test(t)) {
    return true
  }
  return false
}

/**
 * 逗号后半句人生升华（套句根结构，优先于关键词黑名单）。
 */
export function companionTextHasCommaPhilosophyClosure(text: string): boolean {
  const t = text.trim()
  const commaIdx = t.search(/[，,]/)
  if (commaIdx < 0) return false
  const head = t.slice(0, commaIdx).trim()
  const tail = t.slice(commaIdx + 1).trim()
  if (!tail) return false
  if (/^(也是|便是|并不|并不会|其实|毕竟|原来)/.test(tail)) return true
  if (/(也是|便是).{0,10}(必要|修行|温柔|前行|馈赠|礼物|正事|生活)/.test(tail)) {
    return true
  }
  if (/(世界|人生|生活|命运|岁月|时光).{0,12}(并不|不会|仍|依然|照样)/.test(tail)) {
    return true
  }
  if (
    /^偶尔/.test(head) ||
    /(发呆|无所事事|放空|停一?停|看看云|望望天)/.test(head)
  ) {
    return true
  }
  if (/^[^，,]{1,14}(时|刻|候)[，,]/.test(t) && /(也是|便是|并不)/.test(tail)) {
    return true
  }
  return false
}

/** 通用公式化骨架（句法结构，非禁词表）。 */
export function companionTextHasFormulaSkeleton(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (companionTextHasCommaPhilosophyClosure(t)) return true
  if (companionTextHasLiteraryClosureTemplate(t)) return true
  if (/^偶尔/.test(t) && /[，,]/.test(t)) return true
  if (/也是一种.{0,6}(必要|修行|温柔|前行|馈赠|礼物|生活)/.test(t)) {
    return true
  }
  if (/世界.{0,8}并不.{0,8}(停|转|倒|垮|因此)/.test(t)) {
    return true
  }
  if (
    /(看看|望望|瞧瞧).{0,14}(云|风|叶|花|天|变幻)/.test(t) &&
    /也是.{0,12}(温柔|修行|前行|馈赠|礼物|生活)/.test(t)
  ) {
    return true
  }
  if (/不妨让.{0,8}(心|自己|思绪)/.test(t)) return true
  if (/时光.{0,8}(静静|缓缓|慢慢)/.test(t)) return true
  if (/^[^，,。！？]{1,12}时[，,]/.test(t) && /(像|仿佛|好似)/.test(t)) {
    return true
  }
  if (/^有些[^，,]{1,20}[，,]/.test(t)) return true
  if (/不是所有[^，,]{1,24}但总有一些/.test(t)) return true
  return false
}

export function companionTextHasPoeticTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (companionTextHasFormulaSkeleton(t)) {
    return true
  }
  if (companionTextHasLiteraryClosureTemplate(t)) {
    return true
  }
  if (COMPANION_POETIC_TEMPLATE_MARKERS.some((m) => t.includes(m))) {
    return true
  }
  if (/像[^，,。！？]{1,14}一样/.test(t)) {
    return true
  }
  if (/^[^，,。！？]{1,10}时[，,]/.test(t) && /像/.test(t)) {
    return true
  }
  if (/暮色|风起|茶凉/.test(t) && /(窗台|窗棂|窗边|掠过|漫过)/.test(t)) {
    return true
  }
  return false
}

export function companionTextHasOralPermissionCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (COMPANION_ORAL_PERMISSION_CLICHES.some((m) => t.includes(m))) {
    return true
  }
  if (/累了.{0,4}歇/.test(t)) return true
  if (t.length <= 10 && /歇.{0,3}会儿/.test(t)) return true
  return false
}

/** 「包括被自己。」等省略宾语、读起来没说完的尾巴。 */
export function companionTextHasEllipticalTail(text: string): boolean {
  const t = text.trim()
  if (/包括被自己[。！？]?$/.test(t)) return true
  if (
    /，包括被[^，,。！？]{1,10}[。！？]$/.test(t) &&
    !/对待|温柔|善待|爱惜/.test(t)
  ) {
    return true
  }
  return false
}

export function buildEllipticalTailRetryUserSuffix(): string {
  return `【硬约束】后半句像没说完（如「包括被自己」）。${HEALING_QUALITY_RETRY_TAIL}`
}

export function companionTextHasStiffHealingCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (COMPANION_STIFF_HEALING_MARKERS.some((m) => t.includes(m))) {
    return true
  }
  if (/像[^，,。！？]{1,14}一样/.test(t)) {
    return true
  }
  if (/轻轻/.test(t) && /像|如|似|风|云|海|停驻|驻足/.test(t)) {
    return true
  }
  if (/停驻|驻足|栖息/.test(t)) {
    return true
  }
  return false
}

export function companionTextNeedsPlainHealingCheck(
  style: CompanionCopyStyle,
): boolean {
  return PLAIN_HEALING_STYLES.has(style)
}

export function buildPoeticTemplateRetryUserSuffix(): string {
  return `【硬约束】上一句命中公式化骨架（停顿看云+也是温柔/修行、馈赠安放化作、X时像…、有些对仗等）。须换完全不同的叙事骨架，按 writing_angle 写；禁止同模板换词。${HEALING_QUALITY_RETRY_TAIL}`
}

export function buildFormulaSkeletonRetryUserSuffix(): string {
  return buildPoeticTemplateRetryUserSuffix()
}

export function buildLiteraryClosureRetryUserSuffix(): string {
  return `【硬约束】上一句像散文套句（馈赠、安放、化作、静静流淌、驻足前行）。改写成直白许可、身体感受或口语白描，禁止上述词与「X是Y的馈赠」骨架。${HEALING_QUALITY_RETRY_TAIL}`
}

export function buildStiffHealingRetryUserSuffix(): string {
  return `【硬约束】上一句太硬或不通顺（如像…一样轻轻停驻）。${HEALING_QUALITY_RETRY_TAIL}`
}

export function buildOralPermissionRetryUserSuffix(): string {
  return `【硬约束】上一句像口语许可套句（如累了就歇/歇会儿/不用怕耽误）。${HEALING_QUALITY_RETRY_TAIL}`
}

export function buildTooShortRetryUserSuffix(
  maxChars: number,
  style: CompanionCopyStyle,
): string {
  const min = companionMinCharsForStyle(maxChars, style)
  return `【硬约束】上一句过短、像口号。请写不少于 ${min} 个汉字、不超过 ${maxChars} 个汉字的通顺完整句，最好含一个逗号分句；禁止「累了就歇会儿」式套句。${HEALING_QUALITY_RETRY_TAIL}`
}

/** 桌面挂件：知道用户在电脑前，但文风偏格言短句，不写办公场景。 */
const DESKTOP_SCENE_LINES = [
  '【场景】用户通过桌面角落挂件读一句短陪伴文案；你知道对方可能在办公，但输出应是**普适的人生短句/诗意格言**，不要写成电脑旁实况描写。',
  DESKTOP_CLICHE_BAN_LINE,
  '【文风取向】通顺短句，一句一重心；可有接纳、许可或一处克制隐喻，勿写设备与操作。禁止照抄鸡汤网句、「有些…，…」励志对仗。不写带引号的示范句。',
  '禁止眼前翻书、捧读等动作；允许抽象用「书页/故事」作一处隐喻（如书页里的停顿），勿叠多处景物。',
  '【时间】禁止编造具体时长（「才刚过五分钟」「已经两小时」）；可说「此刻」「这会儿」或不写时间。',
] as const

export function companionTextHasDesktopCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return COMPANION_DESKTOP_CLICHE_WORDS.some((w) => t.includes(w))
}

export function buildDesktopClicheRetryUserSuffix(): string {
  return `【硬约束】本句禁止出现：${COMPANION_DESKTOP_CLICHE_WORDS.join('、')}。写成人生格言或诗意短句，一句一个重心。`
}

function buildLocalTimeHintLine(now: Date): string {
  const h = now.getHours()
  let band: string
  if (h < 6) band = '深夜'
  else if (h < 9) band = '清晨'
  else if (h < 12) band = '上午'
  else if (h < 14) band = '午间'
  else if (h < 18) band = '下午'
  else if (h < 22) band = '傍晚'
  else band = '夜间'
  const weekend = now.getDay() === 0 || now.getDay() === 6
  return `${weekend ? '周末' : '工作日'}${band}`
}

const INTEREST_TAG_GUIDE: Record<string, string> = {
  影视:
    '「影视」：只可化用台词的情绪节奏或留白感（勿写片名/演员/追剧/屏幕）；禁止「去看电影」式建议；禁止「听一首…让心情…」骨架。',
  书籍:
    '「书籍」：只可化用诗性短句或抽象「故事/留白」一处语感（勿写书名/翻书/捧读）；禁止读书动作与「听一首式」骨架。',
  音乐:
    '「音乐」：只可把留白/轻重/停顿等抽象语感织入句中（一句一处）；禁止出现「旋律/悠扬/飘荡/歌声/听歌/听一首」；禁止「让心情/让思绪…」式升华；禁止命令用户去听音乐。',
  运动:
    '「运动」：只可点到舒展、呼吸等身体感；禁止假设用户正在球场或健身房；禁止活动建议口号。',
  游戏:
    '「游戏」：只可化用轻松胜负/暂停的抽象语感；禁止假设用户正在打游戏。',
  旅行:
    '「旅行」：只可化用路途/远方的抽象联想一词；禁止假设用户正在旅途；禁止窗外风景堆砌。',
}

const QUOTE_FORWARD_INTERESTS = new Set(['影视', '书籍'])

function buildInterestPromptLines(
  interests: string[],
  style: CompanionCopyStyle,
): string[] {
  if (interests.length === 0) return []

  const tagGuides = interests
    .map((tag) => INTEREST_TAG_GUIDE[tag])
    .filter((line): line is string => Boolean(line))

  const hasQuoteInterest = interests.some((t) => QUOTE_FORWARD_INTERESTS.has(t))

  const lines: string[] = [
    ...DESKTOP_SCENE_LINES,
    `【用户兴趣】${interests.join('、')}。`,
    ...tagGuides,
  ]

  if (hasQuoteInterest) {
    lines.push(
      `【影视/书籍优先】本条须像文学作品里摘出的一句格言，再按「${style}」语气收束；${DESKTOP_CLICHE_BAN_LINE}`,
      '禁止仅把兴趣当装饰词（如「像合上一本书」）；要有名句神韵，但不必加书名号或片名，且不得出现办公数码套话。',
    )
  } else {
    lines.push(
      '仅在自然贴切时轻点兴趣意象，禁止生硬罗列；若与情绪或风格冲突则忽略。',
    )
  }

  return lines
}

export function buildCompanionSystemPrompt(input: BuildCompanionPromptInput): string {
  const emojiRule = input.allowEmoji
    ? '可使用 0~2 个 emoji。'
    : '禁止使用 emoji、颜文字与 ★✨🌿 等符号；只输出纯汉字与常用标点。'

  const emotionLines =
    input.emotion != null
      ? [
        `【情绪反馈优先】用户标记：${EMOTION_CN_LABEL[input.emotion]}。取向：${EMOTION_GUIDE[input.emotion]}。输出必须与该情绪一致，不可写成无关情绪口吻。`,
      ]
      : []

  const duplicateGuardLines = input.recentOutputsGuard
    ? [
      '若 user 消息中列出「最近已向用户展示」的陪伴句：新句与其中任一句都必须在母题与句法上明显不同，禁止缩句、扩句或同一模板只替换少数词。',
    ]
    : []

  const rawInterests = (input.companionInterests ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
  const interestTags = rawInterests.filter((s) => !s.startsWith('补充：'))
  const interestNote = (
    rawInterests.find((s) => s.startsWith('补充：'))?.slice(3) ?? ''
  ).trim()
  /** 兴趣 → 千问：作为 system 片段注入，由 `generateCompanionCopy` 随请求发往 DashScope。 */
  const interestLines = buildInterestPromptLines(interestTags, input.style)
  const interestNoteLines =
    interestNote.length > 0
      ? [`【用户补充】${interestNote}。可轻量参考，勿喧宾夺主。`]
      : []

  const hints = (input.companionLightFeedbackHints ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-6)
  const lightFeedbackLines =
    hints.length > 0
      ? [
        `【用户轻反馈（通义归纳）】${hints.join('；')}。写作时优先顺应这些偏好；若与当前情绪、长度或「禁止微改编」冲突，则以情绪与硬约束为准。`,
      ]
      : []

  const timeLine = buildLocalTimeHintLine(input.now ?? new Date())
  const minChars = companionMinCharsForStyle(input.maxChars, input.style)

  return [
    '你是桌面情绪陪伴助手，只输出一条中文短句。',
    timeLine,
    ...emotionLines,
    ...duplicateGuardLines,
    ...interestLines,
    ...interestNoteLines,
    ...lightFeedbackLines,
    `目标语气类型：${input.style}。`,
    `语气要求：${STYLE_GUIDE[input.style]}`,
    `长度要求：不少于 ${minChars}、不超过 ${input.maxChars} 个汉字（不含标点）；须通顺完整、单重心；禁止「累了就歇会儿」式过短套句；禁止「前半+逗号+后半人生升华」套句。`,
    emojiRule,
    DESKTOP_CLICHE_BAN_LINE,
    POETIC_TEMPLATE_BAN_LINE,
    MOTIVATIONAL_PARALLEL_BAN_LINE,
    BLEAK_WITHOUT_COMFORT_BAN_LINE,
    COMPANION_ANTI_TEMPLATE_BLOCK,
    ANTI_FUNCTIONAL_RELATIONSHIP_LINE,
    STYLE_ANTI_FUNCTIONAL[input.style],
    '【陪伴感底线】每句须让人感到被体谅或被托住：允许慢下来、肯定感受或当下的存在、温柔许可；禁止整句只有衰败/无力感而无接纳或指望。',
    `避免广告式文艺腔：不要叠用「${OVERUSED_ADVERBS}」；不要写「你…，我…」对称陪伴模板。`,
    '禁止输出编号、解释、引号、标题、前后缀。',
    '禁止半截句：不得写「包括被自己。」等省略宾语；须写全「也包括被自己温柔对待」或改成完整句。',
    '禁止医学建议、极端表述、负向暗示。',
    '只返回一句纯文本。',
  ].join('\n')
}

/** 应用内触发的占位词，不是用户想扩写的「主题」；勿走「围绕关键词」分支，否则易套同一两句自我关怀。 */
const COMPANION_META_KEYWORDS = new Set([
  '换一句',
  '类似这句',
  '再来一句',
  '换一条',
  '点击精灵互动',
])

const PROMPT_SNIPPET_MAX = 72

function compactLineForPrompt(line: string): string {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  return t.length <= PROMPT_SNIPPET_MAX ? t : `${t.slice(0, PROMPT_SNIPPET_MAX)}…`
}

export function buildCompanionTriggerContextLines(input: {
  trigger?: CompanionCopyTrigger
  momentContextText?: string | null
  similarToLine?: string | null
  yesterdayContextText?: string | null
}): string[] {
  const lines: string[] = []
  if (input.trigger) {
    lines.push(`【触发场景】${input.trigger}。`)
  }
  const moment = input.momentContextText?.trim()
  if (moment) lines.push(`【本轮情境】${moment}`)
  const similar = input.similarToLine?.trim()
  if (similar) {
    lines.push(
      `【参考句（similar）】${compactLineForPrompt(similar)}。请语气与骨架相近，措辞明显换新，禁止照抄。`,
    )
  }
  const yesterday = input.yesterdayContextText?.trim()
  if (yesterday && yesterday !== '无昨日记录') {
    lines.push(`【昨日情境】${compactLineForPrompt(yesterday)}`)
  }
  return lines
}

/** @deprecated 使用 sanitizeRecentCompanionLines.ts 导出 */
export { COMPANION_AVOID_RECENT_MAX } from './sanitizeRecentCompanionLines'

function buildAvoidRecentBlock(lines: string[] | undefined): string {
  const cleaned = sanitizeRecentCompanionLinesForPrompt(lines)
    .map(compactLineForPrompt)
    .filter(Boolean)
  if (cleaned.length === 0) {
    return '无'
  }
  const quoted = cleaned.map((s) => `「${s}」`).join('、')
  const bigrams = collectRecentBigramsForAvoid(cleaned)
  const openings = collectRecentOpeningPrefixes(cleaned)
  const lexicalLine =
    bigrams.length > 0
      ? `【勿再用词】${bigrams.join('、')}（来自最近句，本句不得再出现这些二字词）`
      : ''
  const openingLine =
    openings.length > 0
      ? `【勿再用起笔】${openings.map((s) => `「${s}」`).join('、')}（本句起笔/前半句须明显不同，禁止只改后半）`
      : ''
  return [
    `【最近句】${quoted}（从旧到新）`,
    lexicalLine,
    openingLine,
    buildContrastWithLastLine(cleaned),
  ]
    .filter(Boolean)
    .join('\n')
}

export type CompanionUserPromptContext = {
  /** 最近已向用户展示的陪伴句，用于显式去重、禁止「只改一个字」式复述 */
  avoidRecentOutputs?: string[]
}

export function buildCompanionUserPrompt(
  keyword?: string,
  emotion?: EmotionKind,
  context?: CompanionUserPromptContext,
): string {
  const trimmed = keyword?.trim()
  const isMeta = trimmed ? COMPANION_META_KEYWORDS.has(trimmed) : false
  const kw = trimmed && !isMeta ? trimmed : undefined
  const seed =
    Date.now() ^ Math.floor(Math.random() * 1_000_000_000)
  const archetype = pickCompanionArchetype(
    seed,
    context?.avoidRecentOutputs ?? [],
  )
  const avoidBlock = buildAvoidRecentBlock(context?.avoidRecentOutputs)

  const metaDiversity =
    isMeta && trimmed
      ? `【换句】用户操作「${trimmed}」：写一句全新短句，对照 avoid_recent_block，起笔/重心/收束至少两项不同；无固定句型模板。\n`
      : ''

  const prefix = `${avoidBlock}${avoidBlock && metaDiversity ? '\n' : ''}${metaDiversity}`

  if (kw && emotion != null) {
    return `${prefix}关键词线索：${kw}。用户标记的情绪：「${EMOTION_CN_LABEL[emotion]}」。请写一句自然融合的陪伴短句，换角度表达。（${seed}）`
  }
  if (emotion != null) {
    return `${prefix}用户在情绪反馈里选择了「${EMOTION_CN_LABEL[emotion]}」。请严格按该情绪来写这一句：语气、意象、节奏都要吻合，不要写成「励志口号」或其他情绪的泛泛安慰。承认感受为主，不给诊断或医疗建议。换角度表达。（${seed}）`
  }
  if (kw) {
    return `${prefix}请围绕这个关键词生成文案：${kw}。（${seed}）`
  }
  return `${prefix}请给我一句陪伴短句：通顺完整、写满字数；**只按【本轮唯一句法·白名单】写**，禁止逗号后半句人生升华。禁止像…一样、轻轻停驻、「累了就歇」、过短口号、半截句、办公词与拯救口号。（${seed}）`
}

export function parseCompanionInterestTags(interests: string[] | undefined): {
  tags: string[]
  note: string
} {
  const list = interests ?? []
  const noteRow = list.find((s) => s.startsWith('补充：'))
  const note = noteRow ? noteRow.slice(3).trim() : ''
  const tags = list.filter(
    (s) => !s.startsWith('补充：') && s.trim().length > 0,
  )
  return { tags, note }
}

/** 带兴趣标签时追加 user 侧提示（由 generateCompanionCopy 调用）。 */
export function buildCompanionUserPromptWithInterests(
  keyword: string | undefined,
  emotion: EmotionKind | undefined,
  context: CompanionUserPromptContext | undefined,
  interestTags: string[],
): string {
  const base = buildCompanionUserPrompt(keyword, emotion, context)
  const hasQuote = interestTags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))
  if (!hasQuote) return base
  return `${base}\n【本条】用户选了影视或书籍类兴趣：请写出像文学作品里摘出的一句格言（可改写），贴合 system 语气；禁止「电影」「剧集」及合书、翻页等动作，禁止光标/键盘等办公词。（${Math.floor(Math.random() * 1_000_000_000)}）`
}

/** 百炼智能体应用：本轮触发场景（写入 user_prompt_params.trigger）。 */
export type CompanionCopyTrigger =
  | 'scheduled'
  | 'regenerate'
  | 'similar'
  | 'emotion'
  | 'manual'
  | 'yesterday-greeting'
  | 'focus-end'
  | 'unlock'
  | 'journal-closure'
  | 'streak-nudge'
  | 'interest-deepen'

export type BuildCompanionAgentContextInput = {
  trigger: CompanionCopyTrigger
  style: CompanionCopyStyle
  keyword?: string
  allowEmoji: boolean
  maxChars: number
  emotion?: EmotionKind
  companionInterests?: string[]
  companionLightFeedbackHints?: string[]
  yesterdayContextText?: string | null
  /** ritual / 收束 / streak 等本轮情境（写入 moment_context） */
  momentContextText?: string | null
  /** similar 触发时用户喜欢的参考句（写入 similar_to_line） */
  similarToLine?: string | null
  avoidRecentOutputs?: string[]
  now?: Date
  seed?: number
  /** 与本轮 writing_angle 一致；不传则按 seed 选取。 */
  archetype?: CompanionArchetype
}

function formatInterestsForAgent(tags: string[]): string {
  return tags.length > 0 ? tags.join('、') : '无'
}

function buildStyleGuideForAgent(style: CompanionCopyStyle): string {
  return STYLE_GUIDE[style]
}

function buildInterestGuideForAgent(
  tags: string[],
  style: CompanionCopyStyle,
  note: string,
): string {
  if (tags.length === 0 && !note) return '无'
  const parts: string[] = []
  if (tags.length > 0) {
    parts.push(
      `用户自选兴趣：${tags.join('、')}。本条宜让对方感到「懂我的喜好」：用兴趣相关意象自然织入一句（一句一处，勿罗列标签名、勿活动建议）。`,
    )
    parts.push(
      ...tags
        .map((tag) => INTEREST_TAG_GUIDE[tag])
        .filter((line): line is string => Boolean(line)),
    )
    if (tags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))) {
      parts.push(
        `【影视/书籍】优先像文学作品里摘出的一句格言，再按「${style}」语气收束；不必加书名号或片名。`,
      )
    }
    parts.push(
      '若与本轮情境（moment_context / yesterday_context）或当前情绪冲突，以情境与情绪优先，兴趣仅作轻点缀。',
    )
  }
  if (note) parts.push(`用户补充（可优先化用）：${note}`)
  return parts.join('\n')
}

function formatLightFeedbackForAgent(hints: string[] | undefined): string {
  const list = (hints ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-6)
  return list.length > 0 ? list.join('；') : '无'
}

function resolveCompanionCopyTrigger(
  trigger: CompanionCopyTrigger,
  keyword?: string,
): CompanionCopyTrigger {
  if (trigger !== 'manual') return trigger
  const trimmed = keyword?.trim()
  if (trimmed === '类似这句') return 'similar'
  if (trimmed && COMPANION_META_KEYWORDS.has(trimmed)) return 'regenerate'
  return 'manual'
}

/** 百炼控制台自定义变量 → `input.user_prompt_params`。 */
export function buildCompanionAgentUserPromptParams(
  input: BuildCompanionAgentContextInput,
): Record<string, string> {
  const seed =
    input.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const { tags, note } = parseCompanionInterestTags(input.companionInterests)
  const emotionLabel =
    input.emotion != null ? EMOTION_CN_LABEL[input.emotion] : '无'
  const emotionGuide =
    input.emotion != null ? EMOTION_GUIDE[input.emotion] : '无'
  const yesterday =
    input.yesterdayContextText?.trim() || '无昨日记录'
  const moment = input.momentContextText?.trim() || '无'
  const similarLine = input.similarToLine?.trim() || '无'
  const trigger = resolveCompanionCopyTrigger(input.trigger, input.keyword)
  const avoidBlock = buildAvoidRecentBlock(input.avoidRecentOutputs)
  const minChars = companionMinCharsForStyle(input.maxChars, effectiveStyle)
  const styleReference = buildStyleReferenceBlock(
    effectiveStyle,
    seed,
    sanitizeRecentCompanionLinesForPrompt(input.avoidRecentOutputs),
  )

  return {
    trigger,
    scene_context: COMPANION_DESKTOP_SCENE_CONTEXT,
    text_style: effectiveStyle,
    style_guide: buildStyleGuideForAgent(effectiveStyle),
    interests: formatInterestsForAgent(tags),
    interest_guide: buildInterestGuideForAgent(tags, effectiveStyle, note),
    interest_note: note.length > 0 ? note : '无',
    light_feedback_hints: formatLightFeedbackForAgent(
      input.companionLightFeedbackHints,
    ),
    emotion_label: emotionLabel,
    emotion_guide: emotionGuide,
    yesterday_context: yesterday,
    moment_context: moment,
    similar_to_line: similarLine,
    local_time_hint: buildLocalTimeHintLine(input.now ?? new Date()),
    writing_angle: styleReference,
    writing_angle_index: String(Math.abs(seed) % 997),
    avoid_recent_block: avoidBlock,
    min_chars: String(minChars),
    max_chars: String(input.maxChars),
    allow_emoji: input.allowEmoji ? '是' : '否',
  }
}

/** 百炼应用 completion 的 `input.prompt`（短句任务说明）。 */
export function buildCompanionAgentUserPrompt(
  input: BuildCompanionAgentContextInput,
): string {
  const trigger = resolveCompanionCopyTrigger(input.trigger, input.keyword)
  const trimmed = input.keyword?.trim()
  const isMeta = trimmed ? COMPANION_META_KEYWORDS.has(trimmed) : false
  const kw = trimmed && !isMeta ? trimmed : undefined

  const zhOnly =
    '仅输出一条简体中文短句，禁止出现任何英文字母或英文单词；勿写中英夹杂。'

  const { tags: interestTags } = parseCompanionInterestTags(
    input.companionInterests,
  )
  const interestTaskHint =
    interestTags.length > 0
      ? '若 interests 非无，须读 interest_guide 与 interest_note，自然体现用户兴趣（一句一处意象）。'
      : ''

  const taskCore = [
    '写一句桌面陪伴短句。读 writing_angle 里的气质参考，读 avoid_recent_block 避免复读；写全新措辞。',
    interestTaskHint,
    zhOnly,
  ]
    .filter(Boolean)
    .join('')

  const finishTask = (extra: string) => `${taskCore}\n${extra}`

  if (trigger === 'regenerate') {
    return finishTask('用户点「换一句」：须与 avoid_recent_block 明显不同。')
  }
  if (trigger === 'similar') {
    return finishTask(
      '用户点「类似这句」：语气贴近 similar_to_line，措辞明显换新，禁止照抄。',
    )
  }
  if (trigger === 'emotion') {
    return finishTask('用户刚完成情绪反馈：写一句贴合当前情绪的陪伴短句。')
  }
  if (trigger === 'scheduled') {
    return finishTask('定时推送：写一句桌面陪伴短句。')
  }
  if (trigger === 'yesterday-greeting') {
    return [
      '用户今天第一次打开应用或从休眠恢复；请根据 yesterday_context 写一句昨日情绪续接的关怀短句，',
      '自然提及昨日心情或日记关键词，勿说教、勿列步骤；与定时推送句明显不同。',
      zhOnly,
    ].join('')
  }
  if (trigger === 'unlock') {
    return [
      '用户刚解锁屏幕或从休眠恢复（非昨日续接场景）；结合 moment_context 与本地时段，',
      '写一句轻柔的情境陪伴，像刚回到桌面的招呼；勿列步骤。',
      zhOnly,
    ].join('')
  }
  if (trigger === 'focus-end') {
    return [
      '用户刚结束专注会话；结合 moment_context，写一句认可这段专注、邀请松一口气的陪伴短句，',
      '禁止命令式「你应该休息」。',
      zhOnly,
    ].join('')
  }
  if (trigger === 'journal-closure') {
    return [
      '用户刚保存今日小结；结合 moment_context 写一句收束陪伴，承接日记情绪与关键词，',
      '让人感到「被看见、已收好」，勿展开聊天、勿说教。',
      zhOnly,
    ].join('')
  }
  if (trigger === 'streak-nudge') {
    return [
      '用户连续多日记录心情/日记；结合 moment_context 写一句轻激励，肯定坚持本身，',
      '禁止内疚式「你怎么断档」、禁止夸张口号。',
      zhOnly,
    ].join('')
  }
  if (trigger === 'interest-deepen') {
    return [
      '每日兴趣深化：结合 interests / interest_note，写一句极短、温柔的问句（须以？结尾），',
      '用于收集用户兴趣补充；禁止医学建议、禁止命令句；仍须控制在字数上限内。',
      zhOnly,
    ].join('')
  }
  if (kw) {
    return finishTask(`围绕关键词写一句陪伴短句：${kw}。`)
  }
  return finishTask('写一句桌面陪伴短句。')
}

