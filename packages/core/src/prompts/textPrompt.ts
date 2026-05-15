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
    平静: 'calm',
    焦虑: 'anxious',
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
}

const STYLE_GUIDE: Record<CompanionCopyStyle, string> = {
  治愈:
    '必须包含1个可感知的身体动作或环境细节（例：指尖离开键盘/窗外车声停了/水杯还剩半口）；用具体事物承接情绪，禁止抽象安慰（如“世界会温柔”“时间会治愈”）。',
  励志: '用「我」主语替代「你」主语（例：「我允许此刻喘口气」而非「你要坚强」）；聚焦微小可行动作（喝水/拉伸/停3秒），禁止抽象成功学表述；若含「相信」必须绑定具体行动（例：「我相信这杯水能让我清醒30秒」）。',
  搞笑: '仅当用户情绪为「开心」时启用；用生活化自嘲替代说教，禁止在焦虑/低落情绪下使用幽默转移感受。',
  助眠: '仅描述当下可做的微小放松动作（眨眼/呼气/手指松开），禁止睡眠指令（如“快睡吧”“安心入睡”）或未来承诺（“明天会更好”）。',
  职场解压: '必须绑定1个职场专属小动作（例：把会议通知最小化30秒/重命名文件为“待定”而非“紧急”），避免通用解压话术（如“深呼吸”）。',
}

/** 每次随机抽一种写法，避免连续落在「你轻轻…我悄悄…」同一文艺模板。 */
const DIVERSITY_ANGLES = [
  '从极具体的生活一角写起（灯光、键盘边、外套搭在椅背），但句末要落到对人的体谅或允许休息，不要用「你」字开篇。',
  '只写对方当下能做的一处小动作（喝水、拉伸、停一眼），不要写对称「我陪你/我守着」句式。',
  '用一句极短问句或感叹起句，避免「你…，我…」双分句对仗。',
  '从胸口/肩膀/呼吸确认身体状态，不要写梦、守候、悄悄、静静。',
  '随口式口语留白，像朋友发一句微信，不要叠「轻轻/慢慢」。',
  '用时间刻度（片刻、一会儿、才刚）带出节奏，别处不要文艺对仗。',
  '从窗外一种具体声音或光线写起，不要落到「世界就温柔了」式抽象收束。',
  '用第二人称但整句只有一个分句，禁止逗号前后「你」「我」各领半句。',
] as const

const OVERUSED_ADVERBS = '轻轻、慢慢、悄悄、静静、缓缓、默默'

export function buildCompanionSystemPrompt(input: BuildCompanionPromptInput): string {
  const emojiRule = input.allowEmoji
    ? '可使用 0~2 个 emoji。'
    : '禁止使用 emoji。'

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

  const interests = (input.companionInterests ?? []).map((s) => s.trim()).filter(Boolean)
  /** 兴趣 → 千问：作为 system 片段注入，由 `generateCompanionCopy` 随请求发往 DashScope。 */
  const interestLines =
    interests.length > 0
      ? [
        `【用户兴趣参考（轻量）】用户可能关注：${interests.join('、')}。仅在自然贴切时融入意象或措辞，禁止生硬罗列、禁止整句只写兴趣清单；若与当前情绪或风格冲突则忽略兴趣提示。`,
      ]
      : []

  return [
    '你是桌面情绪陪伴助手，只输出一条中文短句。',
    ...emotionLines,
    ...duplicateGuardLines,
    ...interestLines,
    `目标语气类型：${input.style}。`,
    `语气要求：${STYLE_GUIDE[input.style]}`,
    `长度要求：不超过 ${input.maxChars} 个汉字。`,
    emojiRule,
    '【陪伴感底线】每句必须让读者感到被体谅或被轻轻托住：可以是允许慢下来、肯定此刻的努力、邀请小休息、一句具体的温柔提议；禁止整句只有「事物在变冷/散去/消逝/凉了」等衰败感描写而无安抚或转向。',
    `避免广告式文艺腔：不要叠用「${OVERUSED_ADVERBS}」；不要写「你…，我…」对称陪伴模板；不要连续用「你轻轻/你慢慢」起句。`,
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
  }

  return `${rules.join('\n')}\n`
}

function buildAvoidRecentBlock(lines: string[] | undefined, seed: number): string {
  const cleaned = (lines ?? [])
    .map(compactLineForPrompt)
    .filter(Boolean)
    .slice(-4)
  if (cleaned.length === 0) return `${buildOpeningConstraint([], seed)}\n`
  const quoted = cleaned.map((s) => `「${s}」`).join('、')
  return [
    `【禁止微改编述】以下为最近已向用户展示过的陪伴句（从旧到新）：${quoted}`,
    '新句必须同时满足：1）不得与任一句采用同一「叙事骨架」（例如「你轻轻…我悄悄…」「窗外的X很Y，像在陪你Z」只换一两个词）；2）若最近一句以自然景物或对称「你/我」分句为主，本句须改用完全不同的切入点（身体感受、室内小物、声音、动作、回忆碎片等）；3）与最近一句不得共享超过 4 个连续汉字；4）禁止仅替换个别形容词或副词应付。',
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
      ? `【重要】用户操作是「${trimmed}」：这不是文案主题。请写一句全新的陪伴短句，在**意象、动词、开头、句式**上与上一句明显不同；避免高频套话（如「今天也要好好照顾自己」「好好照顾自己哦」及仅换 emoji 的变体）。\n`
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
  return `${prefix}请给我一句适合当前状态的情绪文案：要有明确的接纳、体谅或轻柔鼓励，不要只做无糖霜的景物陈述。每次换角度表达，避免重复上一句。（${seed}）`
}

