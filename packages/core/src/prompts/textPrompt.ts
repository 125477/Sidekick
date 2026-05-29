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
import { pickRegenerateStyleFewShots, pickStyleFewShots } from './companionStyleExemplars'
import { companionRewriteTargetIsRegenerateCliche } from './companionRegenerateSkeleton'
import {
  collectRecentBigramsForAvoid,
  collectRecentOpeningPrefixes,
  buildBodyRestBanPromptLine,
  companionRecentBodyRestSaturated,
  companionRecentConcretePauseSaturated,
  companionRecentRestPermissionSaturated,
} from './companionLineSimilarity'
import {
  pickArchetypeExemplarLine,
  pickCompanionArchetype,
  pickRegenerateCompanionArchetype,
  type CompanionArchetype,
} from './companionArchetypes'
import { pickCompanionInterestRegenerateLine, pickCompanionInterestQuoteFewShots } from '../fallback/companionInterestRegenerateLines'
import { pickRegenerateStyleAnchor } from '../fallback/companionRegeneratePool'
import { companionLineIsNonRewriteTarget } from './companionOutputGate'
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
  | '鸡汤'
  | '沙雕'
  | '高冷'

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
  /** chat 路径触发场景；换句/类似时用口语 prompt，勿走格言腔。 */
  trigger?: CompanionCopyTrigger
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
  治愈: '治愈=温柔承接、像一句好听的金句；通顺、有温度，可念出来；禁止说教、命令、假安慰与休息口令。',
  励志:
    '励志=写给用户看的方向感与微小可能；优先你/可以/不必/今天；禁止「你试过/每一次尝试+都在/都算数/铺路」积累口号；禁止「这一步/往前走的步/可以开始了」口号；禁止代入用户现场；禁止鸡血与只要你…就…。',
  搞笑:
    '仅当用户情绪为「开心」时启用；生活化自嘲或轻巧反差，禁止命令、拯救口号与条件价值；禁止在焦虑/低落情绪下用幽默转移感受；禁止办公梗。',
  助眠:
    '语气极轻、安静；写静与许可歇着，仍须写满最短字数、通顺完整，禁止只有「歇会儿」式过短套句；禁止「像…一样」与轻轻停驻；禁止睡眠指令、布置步骤与未来承诺；禁止屏幕蓝光、敲键等提神意象。',
  职场解压:
    '用人生节奏、取舍、边界感来减压（例：允许慢下来、不必一次做完），禁止会议、邮件、通知、文件、光标、键盘等办公名词；禁止命令式加班打气与条件价值。',
  抽象:
    '偏旁观、留白或轻荒诞：一句看似有道理又不完全落地的话，可自嘲或网感哲学碎片，但不刻薄、不攻击用户。禁止治愈套句（累了就歇/像…一样/风起茶凉）、禁止鸡血励志、禁止睡眠指令与办公词；禁止命令、拯救口号与条件价值；若语境偏低落/焦虑，荒诞须克制，勿用幽默否定感受。',
  鸡汤:
    '鸡汤=温暖的人生短句、情感共鸣与微小希望；可略带网感金句气质，须通顺可念；禁止命令（你应该/必须）、禁止空洞保证（一切都会好/只要努力就成功）、禁止「有些…，…」对仗励志口号。',
  沙雕:
    '沙雕=网感自嘲、离谱反差与轻巧吐槽；可略无厘头但不刻薄、不攻击用户；禁止命令与拯救口号；禁止在焦虑/低落时用玩笑否定感受；禁止办公梗与人身攻击。',
  高冷:
    '高冷=克制、疏离、短判断；少情感渲染，像一句懒得解释的态度；禁止温暖治愈套句（累了就歇/像…一样/灵魂/片刻）、禁止鸡血与命令；禁止过长抒情与「你应该」。',
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
  鸡汤:
    '【鸡汤·相处】可写温暖共鸣与微小希望，禁止命令、拯救口号与条件价值（只要你…就…）；禁止空洞保证与对仗式励志口号。',
  沙雕:
    '【沙雕·相处】轻松吐槽但不居高临下；禁止命令、拯救口号与「笑一笑」「别难过了」；禁止刻薄与人身攻击。',
  高冷:
    '【高冷·相处】克制短句即可；禁止你应该/撑住/只要你…就…；禁止温暖套句与过长抒情。',
}

const ANTI_FUNCTIONAL_RELATIONSHIP_LINE =
  '【反功能性相处】勿把用户当任务或角色：禁止布置步骤（应该先…/记得…/别忘…）；禁止拯救口号（撑住/挺过去/没有过不去的坎/一切都会好起来）；禁止条件价值（只要你…就…/努力就会…/才配…）；优先存在许可（可以、允许、就好、在这、不必），少评价其表现。'

const PLAIN_HEALING_STYLES = new Set<CompanionCopyStyle>(['治愈', '助眠'])

/** 治愈类重试共用收尾（勿在各 build*Retry 里写互相矛盾的示例）。 */
const HEALING_QUALITY_RETRY_TAIL =
  '改通顺完整、写满最短字数的一句；**严格按 writing_angle 白名单句法重写**，禁止逗号后半句人生升华，禁止像…一样与「累了就歇」整句。'

/** 陪伴句最短汉字数（不含标点）；9 字完整句如「允许自己不那么完美」须放行。 */
const COMPANION_MIN_CHARS_ABSOLUTE = 8

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
  const raw = text.trim()
  const t = raw.replace(/[。！？….…]+$/u, '').trim()
  if (!t) return true
  const hanLen = t.replace(/[^\u4e00-\u9fff]/gu, '').length
  const min = companionMinCharsForStyle(maxChars, style)
  if (hanLen >= min) return false
  if (hanLen >= 8 && /[。！？]$/.test(raw)) return false
  return true
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
  '你已经做得很好',
  '你做得很好',
  '做得足够好',
  '做得已经很好',
  '做得很好了',
  '就停在这儿',
  '停在这儿',
  '就到这里停',
  '在这儿停',
  '停一会儿也没关系',
  '待一会儿也没关系',
  '就在这里停',
  '就这样待着',
  '也完全没问题',
  '完全没问题',
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
  '像片尾',
  '像书签',
  '像一首歌',
  '这一幕够用',
  '下一场留给',
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
  '【忌公式骨架】忌「你试过/每一次…都在…/都算数/铺路」式积累励志；忌前后对比式空泛励志、忌「今天+一点→少/轻」式行动口号、忌「可以/不必…，但…」转折格言；换句须换叙事骨架，禁止同骨架只换词。',
  '【禁止】不是聊天/作文/读书打卡；勿套「偶尔…也是…」「听一首/听首…让心情…」「这会儿放空/放松」；勿猜用户正在做的事；勿命令用户去听/去看/去读。',
  '【禁止散文套句】禁止茶香/晨曦/光影/午后阳光/旋律悠扬/让心灵或思绪飘荡/画笔舞动/沉睡的心灵/抚摸肌肤；禁止「在这一刻，…」空泛起笔。',
  '【换句】与最近句起笔/重心/收束至少两项不同；连续汉字重叠≤4；禁止只换副词。',
  '【桌面场景】灵伴=角落气泡；默认用户未在读书；勿编造桌上物品、窗外风景、邮件/茶/家务等。',
  '【兴趣】若有 interests：只把意象/语感织入句中，禁止建议用户去做该活动；禁止为凑兴趣写茶香/旋律/阳光散文。',
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
  鸡汤: ['你必须', '加油', '冲鸭'],
  沙雕: [],
  高冷: ['加油', '撑住', '你应该', '必须'],
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
    case '鸡汤':
      return instruction || rescue || conditional || extra
    case '沙雕':
      return instruction || rescue || conditional
    case '高冷':
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
    鸡汤:
      '上一句像命令或空洞保证。请写温暖共鸣的人生短句，禁止你应该/必须/只要你…就…/一切都会好/有些…，…对仗。',
    沙雕:
      '上一句像在命令或拯救。请保持网感自嘲与离谱反差，禁止你应该、撑住、笑一笑、别难过了。',
    高冷:
      '上一句太暖或在下指令。请写克制疏离的短判断，禁止灵魂/片刻/累了就歇/你应该/撑住/只要你…就…。',
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
  if (/就像.{0,16}里的/.test(t)) return true
  if (/像.{0,8}一样/.test(t)) return true
  if (/与其.{0,20}不如/.test(t)) return true
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
  if (/做得很好/.test(t) && /(已经|也完全|也没关系|待|待着|足够)/.test(t)) {
    return true
  }
  if (/你已经.{0,10}做得/.test(t) && /(足够|也很好|完全|挺好|够好)/.test(t)) {
    return true
  }
  if (/不必对自己那么严格/.test(t)) return true
  if (/你已经很不容易/.test(t)) return true
  if (/停在这儿|就到这里停|在这儿停|就停在这儿|就停一下/.test(t)) {
    return true
  }
  if (/停一会儿|待一会儿/.test(t) && /也没关系/.test(t)) return true
  if (/，也没关系[。！？]?$/.test(t) && /(停|待|歇|在这儿|足够|做得)/.test(t)) {
    return true
  }
  if (/待一会儿|待着也完全|就在这里待|就这样待/.test(t)) return true
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
  return [
    '【硬约束·重写】上一句是口语安慰套句（你已经做得很好/待一会儿也没关系/就这样待着/完全没问题）。',
    '改写成全新起笔：可以/不妨/晚一点 + 一件具体小事；至少8字；禁止做得很好/待一会儿/待着/完全没问题。',
  ].join('')
}

export function buildTooShortRetryUserSuffix(
  maxChars: number,
  style: CompanionCopyStyle,
): string {
  const min = companionMinCharsForStyle(maxChars, style)
  return [
    `【硬约束·重写】上一句少于 ${min} 个汉字，无效（如「今天够用了」仅 5 字）。`,
    `请写 ${min}–${maxChars} 字的通顺完整句；禁止 4–6 字口号。`,
    style === '治愈' || style === '助眠'
      ? HEALING_QUALITY_RETRY_TAIL
      : `按${style}语气写对用户的一句白话。`,
  ].join('')
}

/** 桌面挂件：知道用户在电脑前，但文风偏格言短句，不写办公场景。 */
const DESKTOP_SCENE_LINES = [
  '【场景】用户通过桌面角落挂件读一句短陪伴文案；你知道对方可能在办公，但输出应是**普适的人生短句/诗意格言**，不要写成电脑旁实况描写。',
  DESKTOP_CLICHE_BAN_LINE,
  '【文风取向】通顺短句，一句一重心；可有接纳、许可或一处克制隐喻，勿写设备与操作。禁止照抄鸡汤网句、「有些…，…」励志对仗。不写带引号的示范句。',
  '禁止眼前翻书、捧读等动作；允许抽象用「书页/故事」作一处隐喻（如书页里的停顿），勿叠多处景物。',
  '【时间】禁止编造具体时长（「才刚过五分钟」「已经两小时」）；可说「此刻」「这会儿」或不写时间。',
] as const

/** 换句 chat：口语陪伴，禁止诗意格言（与 DESKTOP_SCENE_LINES 区分）。 */
const DESKTOP_SCENE_LINES_REGENERATE = [
  '【场景】桌面角落陪伴气泡；像朋友随口一句，不是文学作品摘抄。',
  DESKTOP_CLICHE_BAN_LINE,
  '【文风】口语白话；短判断或许可（可以/不妨/晚一点）；至少8个汉字；禁止诗意格言、散文比喻、在心上静静、未拆封、春天/温柔意象堆砌。',
] as const

function isRegenerateLikeChatTrigger(
  trigger: CompanionCopyTrigger | undefined,
): boolean {
  return trigger === 'regenerate' || trigger === 'similar'
}

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

const INTEREST_STYLE_MISMATCH_BAN: Record<CompanionCopyStyle, string> = {
  治愈:
    '须温柔承接或许可；禁止恐惧撕裂、悲观断句（如「最怕…」）、鸡血与说教。',
  励志: '须有方向感或小可能；禁止纯丧感、过短口号与空洞保证。',
  搞笑: '须轻松不刻薄；禁止否定感受与命令式玩笑。',
  助眠: '须轻静许可；禁止焦虑、励志鸡血与提神意象。',
  职场解压: '用人生节奏与边界减压；禁止办公名词与加班打气。',
  抽象: '可留白旁观；禁止治愈套句、鸡血与命令。',
  鸡汤: '须温暖共鸣与小希望；禁止命令、空洞保证与纯丧感。',
  沙雕: '须网感自嘲不刻薄；禁止否定感受与命令式玩笑。',
  高冷: '须克制疏离；禁止温暖治愈套句、鸡血与过长抒情。',
}

const INTEREST_TAG_GUIDE: Record<string, string> = {
  影视:
    '「影视」：写**一句电影台词/对白**气质（像名场面金句，可对人说话）；须与当前语气类型一致；禁止书名号片名；禁止「像片尾/像一幕戏」假比喻。',
  书籍:
    '「书籍」：写**一句书本金句/文摘**气质（像经典作品里摘出的一句）；须与当前语气类型一致；禁止书名/翻页/书签动作；禁止假比喻代替正文。',
  音乐:
    '「音乐」：写**一句歌词金句**气质（可传唱、有节奏、像副歌里的一句）；须与当前语气类型一致；禁止「旋律/听歌/像一首歌」假比喻；禁止活动建议。',
  运动:
    '「运动」：只可点到舒展、呼吸等身体感；禁止假设用户正在球场或健身房；禁止活动建议口号。',
  游戏:
    '「游戏」：只可化用轻松胜负/暂停的抽象语感；禁止假设用户正在打游戏。',
  旅行:
    '「旅行」：只可化用路途/远方的抽象联想一词；禁止假设用户正在旅途；禁止窗外风景堆砌。',
}

const QUOTE_FORWARD_INTERESTS = new Set(['音乐', '影视', '书籍'])

function hasQuoteTags(tags: string[]): boolean {
  return tags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))
}

function buildInterestPromptLines(
  interests: string[],
  style: CompanionCopyStyle,
  trigger?: CompanionCopyTrigger,
): string[] {
  if (isRegenerateLikeChatTrigger(trigger)) {
    if (interests.length > 0) {
      return buildRegenerateInterestPromptLines({
        companionInterests: interests,
        style,
      })
    }
    return [...DESKTOP_SCENE_LINES_REGENERATE]
  }
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
      `【兴趣·金句优先】用户选了音乐/影视/书籍：本条须写一句可念出的歌词/影视台词/书本金句气质，再按「${style}」语气收束；${DESKTOP_CLICHE_BAN_LINE}`,
      '禁止散文套句（在这/片刻/灵魂/安宁/栖息/宁静/静谧/让心灵飘荡）；禁止仅把兴趣当装饰词。',
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
  const interestLines = buildInterestPromptLines(
    interestTags,
    input.style,
    input.trigger,
  )
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
  const regenerateChat = isRegenerateLikeChatTrigger(input.trigger)

  return [
    '你是桌面情绪陪伴助手，只输出一条中文短句。',
    timeLine,
    ...emotionLines,
    ...duplicateGuardLines,
    ...interestLines,
    ...interestNoteLines,
    ...lightFeedbackLines,
    ...(regenerateChat
      ? [
          '【换句】像身边朋友随口一句；不少于8个汉字；起笔与 user 里最近句明显不同；勿写散文格言或空洞表扬。',
        ]
      : []),
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

/** 换一句 / chat 与百炼换句共用的硬约束（写入 system，避免只改控制台）。 */
export const COMPANION_REGENERATE_ANTI_CLICHE_BLOCK = [
  '【换句·硬约束】像朋友随口一句；至少8个汉字（不含标点）；短判断或许可；一句一重心；禁止4–6字口号。',
  '【禁止起笔套句】先放一放、先到这儿、先喘口气、先停一下、不用逼、不必逼、别逼自己、给自己喘息/缓冲/放松、缓缓心情、放松心情。',
  '【禁止休息套句】歇会儿、中午歇、不是非得、停在这里、已经很好、允许慢慢来、你已经做得很好、待一会儿也没关系。',
  '【禁止命令与猜现场】勿把/先/现在+动词；勿邮件/茶/窗口/消息来了/我晚一点回/桌面乱/收走/屏幕暗/暗一点/舒服；勿扮演用户说话。',
  '【禁止空泛格言】勿写这一步/往前走的步/可以开始了/本来就有方向/自有分量/已经算数。',
  '【禁止路线许可套句】走哪条路/跟着感觉/慢一点都行/心里舒服就行/最舒服的路。',
  '【禁止散文套句】就像/不是每/旋律/情节/书页/留白、茶香/晨曦/光影/午后阳光、让心灵/思绪飘荡、偶尔…也是…、像…一样。',
].join('\n')

function buildRegenerateCompactAvoidBlock(lines: string[] | undefined): string {
  const cleaned = sanitizeRecentCompanionLinesForPrompt(lines)
    .map(compactLineForPrompt)
    .filter(Boolean)
    .slice(-3)
  if (cleaned.length === 0) return ''
  return `【勿与下列雷同】${cleaned.map((s) => `「${s}」`).join('、')}`
}

/** 换一句专用：按产品规格组 system（场景→语气→字数→禁止）。 */
export function buildRegenerateChatSystemPrompt(input: {
  maxChars: number
  allowEmoji: boolean
  style: CompanionCopyStyle
  now?: Date
  companionInterests?: string[]
  trigger?: 'regenerate' | 'similar'
  seed?: number
}): string {
  const minChars = companionMinCharsForStyle(input.maxChars, input.style)
  const emojiRule = input.allowEmoji ? '可 0~1 emoji。' : '禁 emoji。'
  const { tags } = parseCompanionInterestTags(input.companionInterests)
  const interestSystem =
    tags.length > 0
      ? buildRegenerateInterestPromptLines({
          ...(input.companionInterests?.length
            ? { companionInterests: input.companionInterests }
            : {}),
          style: input.style,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
        })
      : buildInterestPromptLines(
          tags,
          input.style,
          input.trigger ?? 'regenerate',
        )
  const interestHardRule =
    tags.length > 0
      ? '【兴趣·硬约束】已选兴趣：换句必须写歌词/影视台词/书本金句（可念、可辨认）；禁止散文（晚风/午后/心灵舒展/慢慢流淌/放下也是一种拥有）。'
      : ''
  return [
    ...DESKTOP_SCENE_LINES_REGENERATE,
    '【角色】对用户说一句话；换句=写全新短句，不是产品公告、不是聊天。',
    `【语气·${input.style}】${STYLE_GUIDE[input.style]}`,
    STYLE_ANTI_FUNCTIONAL[input.style],
    ...(interestHardRule ? [interestHardRule] : []),
    buildLocalTimeHintLine(input.now ?? new Date()),
    `【字数·最高优先级】不少于 ${minChars} 个汉字、不超过 ${input.maxChars}（标点不计）；须通顺完整，禁止 4–6 字口号。`,
    `${emojiRule} 禁中英夹杂。`,
    COMPANION_ANTI_TEMPLATE_BLOCK,
    ...interestSystem,
    '只输出一句纯文本，无引号无解释；禁止在外层加「」或""包裹整句。',
  ].join('\n')
}

/** 换一句专用：按产品规格组 user（任务→待改写→气质参考→字数）。 */
export function buildRegenerateChatUserPrompt(input: {
  maxChars: number
  avoidRecentOutputs?: string[]
  replaceTargetLine?: string
  similarToLine?: string
  trigger: 'regenerate' | 'similar'
  seed?: number
  style: CompanionCopyStyle
  companionInterests?: string[]
  companionLightFeedbackHints?: string[]
  emotion?: EmotionKind
}): string {
  const minChars = companionMinCharsForStyle(input.maxChars, input.style)
  const parts: string[] = [`【触发】${input.trigger}。`]
  const { tags: interestTagsEarly } = parseCompanionInterestTags(
    input.companionInterests,
  )
  if (interestTagsEarly.length > 0) {
    parts.push(
      `【最高优先级】已选兴趣「${interestTagsEarly.join('、')}」：本条必须是歌词/影视台词/书本金句（可念、有辨识度）；禁止散文套句（晚风/午后/心灵/慢慢流淌/放下也是一种/每一次呼吸）。`,
    )
  }
  parts.push(`【字数】至少 ${minChars} 个汉字，否则无效。`)

  const seed =
    input.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  const sanitizedAvoid = sanitizeRecentCompanionLinesForPrompt(
    input.avoidRecentOutputs,
  )
  const hasInterests = (input.companionInterests?.length ?? 0) > 0

  const avoid = buildRegenerateCompactAvoidBlock(input.avoidRecentOutputs)
  if (avoid) parts.push(avoid)

  if (input.emotion != null) {
    parts.push(`情绪=${EMOTION_CN_LABEL[input.emotion]}。`)
  }
  const hints = (input.companionLightFeedbackHints ?? [])
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(-2)
  if (hints.length > 0) {
    parts.push(`轻反馈：${hints.join('；')}。`)
  }

  const interestLines = buildRegenerateInterestPromptLines({
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
    style: input.style,
    seed,
    recentAvoidCount: sanitizedAvoid.length,
  })
  if (interestLines.length > 0) parts.push(...interestLines)

  const weaveInterest =
    hasInterests &&
    regenerateShouldWeaveInterest(
      seed,
      sanitizedAvoid.length > 0
        ? { recentAvoidCount: sanitizedAvoid.length, hasInterests: true }
        : { hasInterests: true },
    )

  const archetype = pickRegenerateCompanionArchetype(
    seed,
    sanitizedAvoid,
    hasInterests,
  )
  parts.push(archetype.mandate)
  if (!weaveInterest) {
    const exemplar = pickArchetypeExemplarLine(archetype.id, {
      seed,
      maxChars: input.maxChars,
      avoidRecent: sanitizedAvoid,
    })
    parts.push(`【结构示范·勿照抄】「${compactLineForPrompt(exemplar)}」`)
  } else {
    parts.push(
      `【结构】须写与语气「${input.style}」一致的歌词/台词/金句；禁止照抄示范全文、禁止风格冲突与「像片尾/像书签」假比喻。`,
    )
  }

  const restSaturated = companionRecentRestPermissionSaturated(sanitizedAvoid)
  const safeSlotIds = ['B', 'F', 'A'] as const
  const interestSlotIdx = REGENERATE_WRITING_SLOTS.findIndex((s) =>
    s.startsWith('G'),
  )
  let slotIdx =
    Math.abs(seed + sanitizedAvoid.length * 17) % REGENERATE_WRITING_SLOTS.length
  if (weaveInterest && interestSlotIdx >= 0) {
    slotIdx = interestSlotIdx
  } else if (restSaturated) {
    const safeIndices = REGENERATE_WRITING_SLOTS.map((s, i) =>
      safeSlotIds.some((id) => s.startsWith(id)) ? i : -1,
    ).filter((i) => i >= 0)
    if (safeIndices.length > 0) {
      slotIdx = safeIndices[Math.abs(seed) % safeIndices.length]!
    }
  }
  parts.push(`【本轮句法·必须遵守】${REGENERATE_WRITING_SLOTS[slotIdx]!}`)

  const openings = collectRecentOpeningPrefixes(sanitizedAvoid, 8)
  if (openings.length > 0) {
    parts.push(
      `【勿再用起笔】${openings.map((s) => `「${s}」`).join('、')}`,
    )
  }
  if (companionRecentConcretePauseSaturated(sanitizedAvoid)) {
    parts.push(
      '最近已有多句「先放/先到/喘息/逼」套句，本句不得再用上述起笔。',
    )
  }
  if (restSaturated && !hasInterests) {
    parts.push(
      '最近已连续多句休息许可（歇会儿/缓缓/先放一放/今天有点累），本句须换句法：写短问句或具体身体感受，禁止再写歇/缓缓/放一放/早点休息。',
    )
  } else if (restSaturated && hasInterests) {
    parts.push(
      '最近休息许可套句过多：本句须写与兴趣相关的歌词/台词/金句，禁止「今天不顺/深呼吸/晚点再做/慢慢来」类口头禅。',
    )
  }

  const contrast = buildContrastWithLastLine(sanitizedAvoid)
  if (contrast) parts.push(contrast)
  const bigrams = collectRecentBigramsForAvoid(sanitizedAvoid)
  if (bigrams.length > 0) {
    parts.push(`【勿再用词】${bigrams.join('、')}`)
  }

  const { tags: interestTagsForShots } = parseCompanionInterestTags(
    input.companionInterests,
  )
  if (weaveInterest && interestTagsForShots.length > 0) {
    const quoteShots = pickCompanionInterestQuoteFewShots({
      interestTags: interestTagsForShots,
      style: input.style,
      maxChars: input.maxChars,
      seed,
      avoidRecent: sanitizedAvoid,
      count: 2,
    })
    if (quoteShots.length > 0) {
      parts.push(
        `【台词/歌词参考·勿照抄】${quoteShots.map((s) => `「${compactLineForPrompt(s)}」`).join('、')}`,
      )
    }
  } else {
    const shots = pickRegenerateStyleFewShots(
      input.style,
      seed,
      sanitizedAvoid,
      2,
    )
    if (shots.length > 0) {
      parts.push(
        `【气质参考·勿照抄】${shots.map((s) => `「${compactLineForPrompt(s)}」`).join('、')}`,
      )
    }
  }

  const target = input.replaceTargetLine?.replace(/\s+/g, ' ').trim()
  const similar = input.similarToLine?.replace(/\s+/g, ' ').trim()
  const rewriteTarget =
    target && !companionLineIsNonRewriteTarget(target) ? target : undefined

  if (input.trigger === 'similar' && similar) {
    parts.push(
      `【任务】写一句${input.style}短话：语气接近参考句，措辞全新；禁止照抄；至少 ${minChars} 字。`,
    )
    parts.push(`【参考】「${compactLineForPrompt(similar)}」`)
  } else if (rewriteTarget) {
    const forceFreshLine =
      input.trigger === 'regenerate' ||
      companionRewriteTargetIsRegenerateCliche(rewriteTarget)
    if (forceFreshLine) {
      const taskCore = weaveInterest
        ? `【任务】写一句与语气「${input.style}」一致的歌词/影视台词/书本金句（可念、有辨识度）；与屏上句起笔/重心/收束至少两项不同；禁止休息许可套句与「今天不顺/深呼吸/慢慢来」；至少 ${minChars} 字。`
        : `【任务】写全新${input.style}陪伴短话；与屏上句起笔/重心/收束至少两项不同；禁止同骨架换词（走哪条路/跟着感觉/慢一点都行/心里舒服就行等）；至少 ${minChars} 字。`
      parts.push(taskCore)
      parts.push(`【勿沿用】「${compactLineForPrompt(rewriteTarget)}」`)
    } else {
      parts.push(
        `【任务】参考【待改写】语气写一句${input.style}短话：措辞全新、骨架须换；至少 ${minChars} 字；禁止只换同义副词。`,
      )
      parts.push(`【参考】「${compactLineForPrompt(rewriteTarget)}」`)
    }
  } else {
    parts.push(
      `【任务】写一句${input.style}陪伴短话（对用户；不是 App 功能介绍）；至少 ${minChars} 字。`,
    )
  }
  parts.push(`salt=${seed}`)
  parts.push('【多样性】同一待改写句多次换句时，须换表达与叙事骨架，勿重复常见套句。')
  return parts.join('\n')
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
  const bodyRestLine = companionRecentBodyRestSaturated(cleaned)
    ? buildBodyRestBanPromptLine()
    : ''
  return [
    `【最近句】${quoted}（从旧到新）`,
    lexicalLine,
    openingLine,
    bodyRestLine,
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
  trigger?: CompanionCopyTrigger,
): string {
  const base = buildCompanionUserPrompt(keyword, emotion, context)
  if (isRegenerateLikeChatTrigger(trigger)) {
    const seed = Date.now() ^ Math.floor(Math.random() * 1_000_000_000)
    const anchor = pickRegenerateStyleAnchor(seed)
    return `${base}\n【参考语气·勿照抄】「${anchor}」\n写一句全新白话短句，起笔与参考句、最近句都不同；兴趣可省略。（${seed}）`
  }
  const hasQuote = interestTags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))
  if (!hasQuote) return base
  return `${base}\n【本条·硬约束】用户选了音乐/影视/书籍兴趣：须写一句可念出的歌词/台词/金句气质，贴合 system 语气；禁止「在这/片刻/灵魂/安宁」散文套句；禁止办公数码词。（${Math.floor(Math.random() * 1_000_000_000)}）`
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
  /** 换一句时屏幕上正在展示的原句（写入 prompt，防模型复读）。 */
  replaceTargetLine?: string
  now?: Date
  seed?: number
  /** 与本轮 writing_angle 一致；不传则按 seed 选取。 */
  archetype?: CompanionArchetype
}

function formatInterestsForAgent(tags: string[]): string {
  return tags.length > 0 ? tags.join('、') : '无'
}

const REGENERATE_COMPACT_ANTI_TEMPLATE = COMPANION_REGENERATE_ANTI_CLICHE_BLOCK

const REGENERATE_WRITING_SLOTS = [
  'A【许可】可以/不妨/允许 + 一件具体小事（至少8字；起笔禁止：先/眼/肩/到/放/喘）',
  'B【短问】一句温柔问句，以？结尾，至少8个汉字（禁止说教套话）',
  'C【放宽】晚一点/慢一步 + 一句具体状态（至少8字；禁止不是非得/歇会儿/与其不如）',
  'D【此刻】今天/此刻/这会儿 + 一句状态（至少8字；禁止先到/先放/喘息/逼）',
  'E【耐心】晚一点/不用急 + 一句（至少8字；禁止口号与歇会儿）',
  'F【短判断】一句完整判断，至少8个汉字（禁止「这样也行」「今天够满了」等短口号）',
  'G【台词/歌词】写一句与当前语气类型一致的歌词/对白/金句（可念、有节奏；至少8字；禁止风格冲突与假比喻）',
] as const

/** 换句是否本轮须织入兴趣：用户已选兴趣则**每轮**必含（不再隔句轮换）。 */
export function regenerateShouldWeaveInterest(
  seed: number | undefined,
  opts?: { recentAvoidCount?: number; hasInterests?: boolean },
): boolean {
  if (opts?.hasInterests) return true
  const clickIdx = Math.max(0, (opts?.recentAvoidCount ?? 1) - 1)
  if (clickIdx === 0) return true
  const s = seed ?? Date.now()
  return Math.abs(s) % 2 === 0
}

/** 换句 user/agent 共用的兴趣块（chat 与百炼 compact payload 均注入）。 */
export function buildRegenerateInterestPromptLines(input: {
  companionInterests?: string[]
  style: CompanionCopyStyle
  seed?: number
  recentAvoidCount?: number
}): string[] {
  const { tags, note } = parseCompanionInterestTags(input.companionInterests)
  if (tags.length === 0 && !note.trim()) return []

  const weave = regenerateShouldWeaveInterest(
    input.seed,
    tags.length > 0
      ? input.recentAvoidCount !== undefined
        ? { recentAvoidCount: input.recentAvoidCount, hasInterests: true }
        : { hasInterests: true }
      : input.recentAvoidCount !== undefined
        ? { recentAvoidCount: input.recentAvoidCount }
        : undefined,
  )
  const tagGuides = tags
    .map((tag) => INTEREST_TAG_GUIDE[tag])
    .filter((line): line is string => Boolean(line))

  const lines = [
    `【语气对齐·${input.style}】${STYLE_GUIDE[input.style]} ${INTEREST_STYLE_MISMATCH_BAN[input.style]}`,
    `【用户兴趣】${tags.join('、')}。`,
    ...tagGuides,
  ]
  if (note.trim()) lines.push(`【用户补充】${note}。`)

  if (weave) {
    lines.push(
      `【本轮·台词/歌词】写**一句**经典歌词、影视对白或书本金句（可念、有辨识度）；**须与语气「${input.style}」一致**；可化用名篇语感，勿标书名片名；禁止「像片尾/像书签/像一首歌」假比喻。`,
    )
    if (tags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))) {
      lines.push(
        '【影视/书籍】对白或文摘金句气质；禁止散文套句与情节堆砌。',
      )
    }
    if (tags.includes('音乐')) {
      lines.push(
        '【音乐】歌词金句气质（副歌/主歌里的一句）；禁止假比喻与「去听/旋律飘荡」。',
      )
    }
  } else {
    lines.push(
      '【本轮】可写通用白话；下一句换句会轮换兴趣相关表达，本轮不强求。',
    )
  }
  return lines
}

/** 换句：语气参考 + 全新生成（非照抄场景）。 */
function buildRegenerateWritingAngleBlock(
  input: BuildCompanionAgentContextInput,
  seed: number,
): string {
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const avoid = sanitizeRecentCompanionLinesForPrompt(input.avoidRecentOutputs)
  const { tags: interestTags } = parseCompanionInterestTags(input.companionInterests)
  const anchor =
    interestTags.length > 0
      ? pickCompanionInterestRegenerateLine({
          interestTags,
          style: effectiveStyle,
          maxChars: input.maxChars,
          seed,
          avoidRecent: avoid,
        })
      : pickRegenerateStyleAnchor(seed, effectiveStyle)
  const openings = collectRecentOpeningPrefixes(avoid, 8)
  const pauseBan = companionRecentConcretePauseSaturated(avoid)
    ? '最近已有多句「先放/先到/喘息/逼」套句，本句不得再用上述起笔。'
    : ''
  const minChars = companionMinCharsForStyle(input.maxChars, effectiveStyle)
  const interestLines = buildRegenerateInterestPromptLines({
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
    style: effectiveStyle,
    seed,
    recentAvoidCount: avoid.length,
  })
  return [
    `【换句·语气】${effectiveStyle}；对用户写全新短句；【语气参考】为同语气下的歌词/台词/金句示例，只学语气与风格勿照抄全文。`,
    `【语气参考·勿照抄场景】「${anchor}」`,
    `【字数】不少于 ${minChars} 个汉字（不含标点）。`,
    '【禁止】「我」+消息/桌面/屏幕/暗/回/收/舒服；消息来了、桌面乱、暗一点。',
    COMPANION_REGENERATE_ANTI_CLICHE_BLOCK,
    ...interestLines,
    pauseBan,
    openings.length
      ? `【勿再用起笔】${openings.map((s) => `「${s}」`).join('、')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCompanionInterestTaskHint(
  tags: string[],
  note: string,
  trigger: CompanionCopyTrigger,
  style: CompanionCopyStyle,
  seed?: number,
  recentAvoidCount?: number,
): string {
  if (tags.length === 0 && !note.trim()) return ''
  if (trigger === 'regenerate' || trigger === 'similar') {
    const weaveOpts =
      tags.length > 0
        ? recentAvoidCount !== undefined
          ? { recentAvoidCount, hasInterests: true }
          : { hasInterests: true }
        : recentAvoidCount !== undefined
          ? { recentAvoidCount }
          : undefined
    const weave = regenerateShouldWeaveInterest(seed, weaveOpts)
    return [
      weave
        ? `本轮换句须写与语气「${style}」一致的歌词/台词/金句（见 interest_guide 与【语气对齐】）；禁止风格冲突与假比喻。`
        : '本轮可写通用白话；勿眼睛/肩颈+休息套句。',
      note.trim() ? `用户补充可轻参考：${note.trim()}。` : '',
    ]
      .filter(Boolean)
      .join('')
  }
  return hasQuoteTags(tags)
    ? `【任务·金句】用户选了音乐/影视/书籍：须写一句可念出的歌词/台词/金句，与 style_guide 语气一致；禁止在这/片刻/灵魂/安宁类散文套句。`
    : '若自然贴切可读 interest_guide；台词/金句须与 style_guide 语气一致；禁止活动建议与比喻套句。'
}

/** 百炼 `style_guide`：与 chat `buildCompanionSystemPrompt` 对齐，勿只注入半句语气。 */
export function buildStyleGuideForAgent(
  style: CompanionCopyStyle,
  now: Date = new Date(),
): string {
  const timeBand = buildLocalTimeHintLine(now)
  return [
    `【当前时段】${timeBand}；输出须与此时段一致，上午禁写午后/下午，夜间禁写午后阳光等。`,
    `【语气】${STYLE_GUIDE[style]}`,
    STYLE_ANTI_FUNCTIONAL[style],
    ANTI_FUNCTIONAL_RELATIONSHIP_LINE,
    COMPANION_ANTI_TEMPLATE_BLOCK,
    DESKTOP_CLICHE_BAN_LINE,
    POETIC_TEMPLATE_BAN_LINE,
    MOTIVATIONAL_PARALLEL_BAN_LINE,
    BLEAK_WITHOUT_COMFORT_BAN_LINE,
    '【陪伴感底线】须让人感到被体谅或被托住；禁止整句只有衰败无力感而无接纳。',
  ].join('\n')
}

/** 百炼 `writing_angle`：白名单句法；换句不给示范全文。 */
function buildAgentWritingAngleBlock(
  input: BuildCompanionAgentContextInput,
  trigger: CompanionCopyTrigger,
): string {
  const seed =
    input.seed ??
    (Date.now() ^ Math.floor(Math.random() * 1_000_000_000))
  if (trigger === 'regenerate' || trigger === 'similar') {
    return buildRegenerateWritingAngleBlock(input, seed)
  }
  const avoid = sanitizeRecentCompanionLinesForPrompt(input.avoidRecentOutputs)
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const archetype = pickCompanionArchetype(seed, avoid)
  const exemplar = pickArchetypeExemplarLine(archetype.id, {
    seed,
    maxChars: input.maxChars,
    avoidRecent: avoid,
  })
  const toneRef = pickStyleFewShots(effectiveStyle, seed, avoid, 1)[0]
  return [
    archetype.mandate,
    '【白名单句法·必须遵守】本轮只写这一种口语结构；禁止茶香/晨曦/光影/旋律/让心灵飘荡类散文。',
    `【结构示范·勿照抄】「${exemplar}」`,
    toneRef ? `【语气参考·勿照抄】「${toneRef}」` : '',
    '请写一句结构接近示范、措辞全新的短句。',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildInterestGuideForAgent(
  tags: string[],
  style: CompanionCopyStyle,
  note: string,
  trigger?: CompanionCopyTrigger,
  seed?: number,
  recentAvoidCount?: number,
): string {
  if (tags.length === 0 && !note) return '无'
  const parts: string[] = []
  if (tags.length > 0) {
    parts.push(
      `用户自选兴趣：${tags.join('、')}。换句时写**可念出的歌词/台词/金句**，且**须与语气「${style}」一致**（见 style_guide）；一句一处，勿罗列标签、勿活动建议。`,
    )
    parts.push(
      ...tags
        .map((tag) => INTEREST_TAG_GUIDE[tag])
        .filter((line): line is string => Boolean(line)),
    )
    if (tags.some((t) => QUOTE_FORWARD_INTERESTS.has(t))) {
      parts.push(
        `【影视/书籍】对白或文摘金句气质；按「${style}」收束；禁止书名号/片名与「像片尾/像书签」假比喻。`,
      )
    }
    if (trigger === 'regenerate' || trigger === 'similar') {
      const weaveOpts =
        tags.length > 0
          ? recentAvoidCount !== undefined
            ? { recentAvoidCount, hasInterests: true }
            : { hasInterests: true }
          : recentAvoidCount !== undefined
            ? { recentAvoidCount }
            : undefined
      const weave = regenerateShouldWeaveInterest(seed, weaveOpts)
      parts.push(
        weave
          ? `【换句·本轮】须写与「${style}」一致的歌词/台词/金句（见【本轮·台词/歌词】与【语气对齐】）；禁止假比喻与风格冲突。`
          : '【换句·本轮】可写通用白话；下一句会轮换兴趣表达。',
      )
    } else {
      parts.push(
        hasQuoteTags(tags)
          ? `【推送·金句】须写与「${style}」一致的歌词/台词/金句；禁止在这/片刻/灵魂/安宁/栖息类散文。`
          : '仅在自然贴切时轻点兴趣；写对白/金句感，禁止假比喻与旋律/情节堆砌。',
      )
    }
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
  const now = input.now ?? new Date()
  const writingAngle = buildAgentWritingAngleBlock(input, trigger)
  const recentCount = sanitizeRecentCompanionLinesForPrompt(
    input.avoidRecentOutputs,
  ).length

  return {
    trigger,
    scene_context: COMPANION_DESKTOP_SCENE_CONTEXT,
    text_style: effectiveStyle,
    style_guide: buildStyleGuideForAgent(effectiveStyle, now),
    interests: formatInterestsForAgent(tags),
    interest_guide: buildInterestGuideForAgent(
      tags,
      effectiveStyle,
      note,
      trigger,
      seed,
      recentCount,
    ),
    interest_note: note.length > 0 ? note : '无',
    light_feedback_hints: formatLightFeedbackForAgent(
      input.companionLightFeedbackHints,
    ),
    emotion_label: emotionLabel,
    emotion_guide: emotionGuide,
    yesterday_context: yesterday,
    moment_context: moment,
    similar_to_line: similarLine,
    local_time_hint: buildLocalTimeHintLine(now),
    writing_angle: writingAngle,
    writing_angle_index: String(Math.abs(seed) % 997),
    avoid_recent_block: avoidBlock,
    min_chars: String(minChars),
    max_chars: String(input.maxChars),
    allow_emoji: input.allowEmoji ? '是' : '否',
  }
}

/**
 * 将 `user_prompt_params` 关键字段写入 `input.prompt`，避免控制台未替换 `{{变量}}` 时模型索要参数。
 */
function buildCompactRegenerateAgentPayload(
  input: BuildCompanionAgentContextInput,
): { prompt: string; userPromptParams: Record<string, string> } {
  const userPromptParams = buildCompanionAgentUserPromptParams(input)
  const task = buildCompanionAgentUserPrompt(input)
  const recent = sanitizeRecentCompanionLinesForPrompt(input.avoidRecentOutputs)
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const bodyRestBan = companionRecentBodyRestSaturated(recent)
    ? buildBodyRestBanPromptLine()
    : ''
  const pauseBan = companionRecentConcretePauseSaturated(recent)
    ? '【勿再套句】最近已有「先放一放/先到这儿/喘息/不用逼」类句：本句禁止上述起笔与「缓缓心情/放松/逼自己」。'
    : ''
  const hasInterests = userPromptParams.interests !== '无'
  const interestWeaveLines = buildRegenerateInterestPromptLines({
    ...(input.companionInterests?.length
      ? { companionInterests: input.companionInterests }
      : {}),
    style: effectiveStyle,
    ...(input.seed !== undefined ? { seed: input.seed } : {}),
    recentAvoidCount: recent.length,
  })
  const prompt = [
    task,
    '【已注入】只输出一条陪伴短句；禁止索要参数。',
    `【local_time_hint】${userPromptParams.local_time_hint}`,
    `【writing_angle】\n${userPromptParams.writing_angle}`,
    ...(hasInterests
      ? [
          `【interests】${userPromptParams.interests}`,
          `【interest_guide】\n${userPromptParams.interest_guide}`,
          `【interest_note】${userPromptParams.interest_note}`,
          ...interestWeaveLines,
        ]
      : []),
    `【avoid_recent_block】\n${userPromptParams.avoid_recent_block}`,
    REGENERATE_COMPACT_ANTI_TEMPLATE,
    bodyRestBan,
    pauseBan,
    `【字数·硬约束】不少于 ${userPromptParams.min_chars} 个汉字（不含标点），不超过 ${userPromptParams.max_chars}；少于 ${userPromptParams.min_chars} 字视为无效；emoji=${userPromptParams.allow_emoji}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { prompt, userPromptParams }
}

export function buildCompanionAgentCompletionPayload(
  input: BuildCompanionAgentContextInput,
): { prompt: string; userPromptParams: Record<string, string> } {
  const trigger = resolveCompanionCopyTrigger(input.trigger, input.keyword)
  if (trigger === 'regenerate' || trigger === 'similar') {
    return buildCompactRegenerateAgentPayload(input)
  }
  const userPromptParams = buildCompanionAgentUserPromptParams(input)
  const task = buildCompanionAgentUserPrompt(input)
  const hasInterests = userPromptParams.interests !== '无'
  const prompt = [
    task,
    '【已注入·禁止索要参数】下列内容即 writing_angle / avoid_recent_block / style_guide；',
    '禁止回复「请提供写作角度」等；只输出一条陪伴短句。',
    `【local_time_hint】${userPromptParams.local_time_hint}`,
    `【trigger】${userPromptParams.trigger}`,
    `【writing_angle】\n${userPromptParams.writing_angle}`,
    ...(hasInterests
      ? [
          `【interests】${userPromptParams.interests}`,
          `【interest_guide】\n${userPromptParams.interest_guide}`,
          `【interest_note】${userPromptParams.interest_note}`,
        ]
      : []),
    `【avoid_recent_block】\n${userPromptParams.avoid_recent_block}`,
    `【style_guide】\n${userPromptParams.style_guide}`,
    `【字数·硬约束】不少于 ${userPromptParams.min_chars} 个汉字（不含标点），不超过 ${userPromptParams.max_chars}；少于 ${userPromptParams.min_chars} 字视为无效；emoji=${userPromptParams.allow_emoji}`,
  ].join('\n\n')
  return { prompt, userPromptParams }
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

  const { tags: interestTags, note: interestNote } = parseCompanionInterestTags(
    input.companionInterests,
  )
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const recentCount = sanitizeRecentCompanionLinesForPrompt(
    input.avoidRecentOutputs,
  ).length
  const interestTaskHint = buildCompanionInterestTaskHint(
    interestTags,
    interestNote,
    trigger,
    effectiveStyle,
    input.seed,
    recentCount,
  )

  const taskCore = [
    '写一句桌面陪伴短句。下文【writing_angle】【avoid_recent_block】已给出；勿向用户索要参数；写全新措辞。',
    interestTaskHint,
    zhOnly,
  ]
    .filter(Boolean)
    .join('')

  const finishTask = (extra: string) => `${taskCore}\n${extra}`

  if (trigger === 'regenerate') {
    const screenLine = input.replaceTargetLine?.replace(/\s+/g, ' ').trim()
    const screenHint = screenLine
      ? `屏幕上正在展示：「${screenLine}」——本句禁止相同或仅改一二字/副词。\n`
      : ''
    return finishTask(
      `${screenHint}用户点「换一句」：写全新陪伴短句（起笔/重心/收束与屏上句至少两项不同）；须与 avoid_recent_block 明显不同；若已选兴趣则写与语气「${effectiveStyle}」一致的歌词/台词/金句；不少于 ${companionMinCharsForStyle(input.maxChars)} 个汉字。`,
    )
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

