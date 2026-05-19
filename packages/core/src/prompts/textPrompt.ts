/**
 * 陪伴文案：默认在一次请求里把「风格 + 可选情绪」写进 system/user prompt。
 * 追问（多轮对话）更适合需要澄清意图的场景；这里固定输出一条短句，单轮注入成本更低、延迟更稳。
 */
import type { EmotionKind } from '../schema/data'

export type CompanionCopyStyle =
  | '治愈'
  | '励志'
  | '搞笑'
  | '助眠'
  | '职场解压'

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
  calm: '此刻偏平稳，语气舒缓克制。',
  anxious: '此刻偏焦虑，先承接不安再给轻柔喘息感，避免说教与否定感受。',
 low: '此刻偏低落，温柔承接情绪，禁止搞笑转移（如“笑一笑十年少”），聚焦“此刻被接纳”的安全感。',
  tired: '此刻偏疲惫，体谅身心负荷，句短声柔。',
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
    tired: '助眠',
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
  治愈:
    '格言或短诗气质：人生、时光、温柔、成长、陪伴；一句一个重心。以承接感受与存在许可为主（可以、允许、就好），禁止命令、拯救口号与条件价值；禁止纯宿命感叹（「再亮也照不亮…」）；禁止办公设备与电脑操作描写。',
  励志:
    '可多用「我」或无人称格言；聚焦态度与微小可能，禁止鸡血口号与抽象成功学；禁止命令式打气（加油/撑住/你必须）与「只要你…就…」式条件价值；禁止写键盘、光标、加班赶场等办公套话，勿照抄常见鸡汤句。',
  搞笑:
    '仅当用户情绪为「开心」时启用；生活化自嘲或轻巧反差，禁止命令、拯救口号与条件价值；禁止在焦虑/低落情绪下用幽默转移感受；禁止办公梗。',
  助眠:
    '语气极轻、句短；可写呼吸、停顿、夜色、安静与存在许可，禁止睡眠指令（「快睡吧」）、布置步骤与未来承诺；禁止屏幕蓝光、敲键等提神意象。',
  职场解压:
    '用人生节奏、取舍、边界感来减压（例：允许慢下来、不必一次做完），禁止会议、邮件、通知、文件、光标、键盘等办公名词；禁止命令式加班打气与条件价值。',
}

/** 各语气类型下的「反功能性相处」写作约束（写入 system，与生成后校验一致）。 */
const STYLE_ANTI_FUNCTIONAL: Record<CompanionCopyStyle, string> = {
  治愈:
    '【治愈·相处】优先「被看见、被接纳」：可写允许休息、此刻就好；禁止你应该/记得/别忘、禁止撑住挺过去、禁止只要你…就…/努力就会…。',
  励志:
    '【励志·相处】可写微小可能与方向感，但禁止命令（你应该/快去）、禁止拯救口号（撑住/加油/没有过不去的坎）、禁止条件价值与空洞保证。',
  搞笑:
    '【搞笑·相处】轻松但不居高临下；禁止命令与拯救口号、禁止只要你…就…；禁止「笑一笑」「别难过了」式否定感受。',
  助眠:
    '【助眠·相处】只写轻、静、许可歇着；禁止任何步骤作业（先…/试试深呼吸/快睡）、禁止加油撑住与条件价值。',
  职场解压:
    '【职场解压·相处】写边界与允许慢下来，禁止更高效/冲一把/你应该扛住、禁止只要你努力就…式交换。',
}

const ANTI_FUNCTIONAL_RELATIONSHIP_LINE =
  '【反功能性相处】勿把用户当任务或角色：禁止布置步骤（应该先…/记得…/别忘…）；禁止拯救口号（撑住/挺过去/没有过不去的坎/一切都会好起来）；禁止条件价值（只要你…就…/努力就会…/才配…）；优先存在许可（可以、允许、就好、在这、不必），少评价其表现。'

/** 每次随机抽一种写法，避免连续落在「X时，像…」文艺模板。 */
const DIVERSITY_ANGLES = [
  '用格言式判断句：短、具体、无景物比喻，禁止「X时，像…」对仗，禁止「有些…，…」励志对仗。',
  '用一句短促许可（允许休息、肯定当下），不要写景、不要比喻，勿照抄常见鸡汤句。',
  '从成长或耐心直说，禁止暮色、风起、茶凉、窗台、杯底余温等爆款意象。',
  '用极短问句或感叹，禁止「你…，我…」对称、禁止逗号后接「像…」。',
  '口语化像朋友微信，一句一个意思，禁止堆砌景物比喻。',
  '用「可以」「不妨」邀请休息，禁止「不妨让心先停一停」式套句。',
  '用对比结构（「不是…而是…」「与其…不如…」），禁止文艺散文腔。',
  '第二人称单分句，无逗号对仗，禁止起笔「风起/茶凉/暮色」。',
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
] as const

const POETIC_TEMPLATE_BAN_LINE =
  '【禁止文艺套句】禁止：①「X时，…」起句+「像…」比喻（如风起时/茶凉时/暮色漫过…）；②「像未说完的句子」「在杯底藏着」「留着一盏灯」；③暮色+窗台/窗棂组合。优先直白格言、判断句或许可，一句一个重心。'

const MOTIVATIONAL_PARALLEL_BAN_LINE =
  '【禁止励志套句】禁止：①以「有些」起头的对仗句（如「有些坚持，终会…」「有些努力，不必…」）；②「不是所有…但总有一些…」；③「终会落在心头」「不必等回应也能发光」等口号式后半句。'

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

export function companionTextHasPoeticTemplate(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (COMPANION_POETIC_TEMPLATE_MARKERS.some((m) => t.includes(m))) {
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

export function buildPoeticTemplateRetryUserSuffix(): string {
  return '【硬约束】勿用「风起时/茶凉时/暮色/窗台/像未说完的句子」等套句。改直白格言或许可，一句一重心，勿照抄常见网句或示范句。'
}

/** 桌面挂件：知道用户在电脑前，但文风偏格言短句，不写办公场景。 */
const DESKTOP_SCENE_LINES = [
  '【场景】用户通过桌面角落挂件读一句短陪伴文案；你知道对方可能在办公，但输出应是**普适的人生短句/诗意格言**，不要写成电脑旁实况描写。',
  DESKTOP_CLICHE_BAN_LINE,
  '【文风取向】普适人生短句：一句一重心，可有接纳与体谅；可写人生/时光/温柔/成长，勿写设备与操作。禁止照抄常见鸡汤与网句；禁止「有些…，…」励志对仗与「不是所有…但总有一些…」。不写带引号的示范句。',
  '禁止写眼前有实体书/纸质书：合上书本、翻书页、捧读、灯下看书、书页等。',
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
  return `【当前时段参考】本地约为${weekend ? '周末' : '工作日'}${band}。只可轻点时段氛围（如午后倦意），禁止写具体几点几分或「刚过X分钟」。`
}

const INTEREST_TAG_GUIDE: Record<string, string> = {
  影视:
    '「影视」：只化用经典台词的**情绪与节奏**（可略改写，勿标注片名演员）；禁止出现「电影」「剧集」「影院」「屏幕」等词，禁止写追剧/观影动作。',
  书籍:
    '「书籍」：化用名著/诗里**一句**短引神韵（勿标注书名作者）；禁止描写眼前实体书、合书、翻页；禁止把「书」当作眼前道具。',
  音乐:
    '「音乐」：可化用歌词意象或节奏感（勿写歌名歌手），禁止「戴上耳机听歌」等旁观描写。',
  运动:
    '「运动」：可点到身体舒展、呼吸、短暂停一下，禁止假设用户正在球场或健身房。',
  游戏:
    '「游戏」：可化用轻松胜负/暂停意象，禁止假设用户正在打游戏。',
  旅行:
    '「旅行」：可用路途、窗外风景的**一句**联想，禁止假设用户正在旅途。',
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
    `长度要求：不超过 ${input.maxChars} 个汉字。`,
    emojiRule,
    DESKTOP_CLICHE_BAN_LINE,
    POETIC_TEMPLATE_BAN_LINE,
    MOTIVATIONAL_PARALLEL_BAN_LINE,
    BLEAK_WITHOUT_COMFORT_BAN_LINE,
    ANTI_FUNCTIONAL_RELATIONSHIP_LINE,
    STYLE_ANTI_FUNCTIONAL[input.style],
    '【陪伴感底线】每句须让人感到被体谅或被托住：允许慢下来、肯定感受或当下的存在、温柔许可；禁止整句只有衰败/无力感而无接纳或指望。',
    `避免广告式文艺腔：不要叠用「${OVERUSED_ADVERBS}」；不要写「你…，我…」对称陪伴模板。`,
    '禁止输出编号、解释、引号、标题、前后缀。',
    '禁止医学建议、极端表述、负向暗示。',
    '只返回一句纯文本。',
  ].join('\n')
}

/** 应用内触发的占位词，不是用户想扩写的「主题」；勿走「围绕关键词」分支，否则易套同一两句自我关怀。 */
const COMPANION_META_KEYWORDS = new Set([
  '换一句',
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

function pickDiversityAngle(seed: number): string {
  const idx = Math.abs(seed) % DIVERSITY_ANGLES.length
  return DIVERSITY_ANGLES[idx] ?? DIVERSITY_ANGLES[0]
}

function buildOpeningConstraint(recent: string[], seed: number): string {
  const lines = recent.map(compactLineForPrompt).filter(Boolean)
  const last = lines[lines.length - 1]
  const angle = pickDiversityAngle(seed)
  const rules = [`【本次写法】${angle}`]

  if (last) {
    const firstChar = last[0]
    if (firstChar) {
      rules.push(`本句第一字不得为「${firstChar}」（上一句以它起头）。`)
    }
    if (last.startsWith('你')) {
      rules.push('禁止再次以「你」字开篇。')
    }
    if (/你.{0,10}[，,].{0,10}我/.test(last)) {
      rules.push('上一句为「你…我…」对称句式，本句不得再写你我对照陪伴。')
    }
    if (/轻轻|慢慢|悄悄|静静/.test(last)) {
      rules.push(
        `上一句已用「${OVERUSED_ADVERBS}」类叠词，本句这些词一律不要再出现。`,
      )
    }
    const clichesInRecent = COMPANION_DESKTOP_CLICHE_WORDS.filter((w) =>
      last.includes(w),
    )
    if (clichesInRecent.length > 0) {
      rules.push(
        `上一句已出现办公套话（${clichesInRecent.join('、')}），本句这些词一律不得再出现。`,
      )
    }
    const poeticInRecent = COMPANION_POETIC_TEMPLATE_MARKERS.filter((m) =>
      last.includes(m),
    )
    if (poeticInRecent.length > 0 || companionTextHasPoeticTemplate(last)) {
      rules.push(
        `上一句是文艺套句（${poeticInRecent.length > 0 ? poeticInRecent.join('、') : '时+像比喻'}），本句须换完全不同的句式，禁止再起「X时，像…」。`,
      )
    }
    if (companionTextHasMotivationalParallelTemplate(last)) {
      rules.push(
        '上一句是「有些…，…」或「不是所有…但总有一些…」励志套句，本句须换完全不同的句式与起笔。',
      )
    }
    if (companionTextHasBleakWithoutComfort(last)) {
      rules.push(
        '上一句是宿命感叹、缺少托住感；本句须写接纳、许可或温柔指望，禁止「再…也…不…」式无力格言。',
      )
    }
    if (companionTextHasFunctionalTone(last, '治愈')) {
      rules.push(
        '上一句像指令、拯救口号或条件价值；本句改为存在许可（可以、允许、就好），禁止你应该、撑住、只要你…就…。',
      )
    }
    const bannedOpeners = ['风起', '茶凉', '暮色', '雨落', '雪落', '窗', '有些']
    for (const o of bannedOpeners) {
      if (last.startsWith(o)) {
        rules.push(`禁止以「${o}」起头。`)
        break
      }
    }
  }

  const poeticInAllRecent = [
    ...new Set(
      lines.flatMap((line) =>
        COMPANION_POETIC_TEMPLATE_MARKERS.filter((m) => line.includes(m)),
      ),
    ),
  ]
  if (poeticInAllRecent.length > 0) {
    rules.push(
      `最近几句已反复出现：${poeticInAllRecent.join('、')}；本句这些意象与「时，像…」骨架一律不要再出现。`,
    )
  }

  const motivationalInAllRecent = lines.filter((line) =>
    companionTextHasMotivationalParallelTemplate(line),
  )
  if (motivationalInAllRecent.length > 0) {
    rules.push(
      '最近几句已出现「有些…，…」或「不是所有…但总有一些…」励志套句；本句禁止再用该骨架，改直白许可或判断句。',
    )
  }

  return `${rules.join('\n')}\n`
}

/** 与 UI `RECENT_COMPANION_LINES_MAX` 对齐。 */
export const COMPANION_AVOID_RECENT_MAX = 6

function buildAvoidRecentBlock(lines: string[] | undefined, seed: number): string {
  const cleaned = (lines ?? [])
    .map(compactLineForPrompt)
    .filter(Boolean)
    .slice(-COMPANION_AVOID_RECENT_MAX)
  if (cleaned.length === 0) return `${buildOpeningConstraint([], seed)}\n`
  const quoted = cleaned.map((s) => `「${s}」`).join('、')
  return [
    `【禁止微改编述】以下为最近已向用户展示过的陪伴句（从旧到新）：${quoted}`,
    '新句必须同时满足：1）不得与任一句采用同一「叙事骨架」（尤其禁止「X时，像…」「暮色+窗台」「茶凉+杯底」「有些…，…」「不是所有…但总有一些…」只换词）；2）若最近以景物比喻或励志对仗为主，本句改直白格言或许可；3）与最近一句不得共享超过 4 个连续汉字；4）禁止仅替换个别形容词应付。',
    buildOpeningConstraint(cleaned, seed + 17),
    '',
  ].join('\n')
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
  const seed = Math.floor(Math.random() * 1_000_000_000)
  const avoidBlock = buildAvoidRecentBlock(context?.avoidRecentOutputs, seed)

  const metaDiversity =
    isMeta && trimmed
      ? `【重要】用户操作是「${trimmed}」：这不是文案主题。请写一句全新的陪伴短句，在**开头、句式、意象**上与上一句明显不同；禁止「风起时/茶凉时/暮色漫过/像未说完的句子」「有些…，…」励志对仗，禁止只改一两个字。\n`
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
  return `${prefix}请给我一句陪伴短句：可有诗意，但优先接纳与存在许可（可以、允许、就好）；勿写办公设备、电脑操作与捧读实体书；禁止你应该、撑住、只要你…就…。每次换角度，避免重复上一句。（${seed}）`
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

