/**
 * 套句校验：只判「叙事骨架/句法结构」，不维护禁词表。
 * 与 `companionTextHasFormulaSkeleton` 对齐；生成链路优先用本函数。
 */

import {
  companionTextHasDoLittleTodaySkeleton,
  companionTextHasEffortAccumulationSkeleton,
  companionTextHasYesterdayComparisonSkeleton,
} from './companionRegenerateSkeleton'
import { companionTextHasRestBreakPermissionCliche, companionTextHasSceneryMoodCliche } from './companionLineSimilarity'
import {
  companionTextHasEllipticalTail,
  companionTextHasFormulaSkeleton,
  companionTextHasMotivationalParallelTemplate,
  companionTextTooShort,
  companionTextHasOralPermissionCliche,
  type CompanionCopyStyle,
} from './textPrompt'

/** 模型未收到变量时向用户索要 writing_angle / avoid_recent（须拒收并重试）。 */
export function companionTextIsAgentMetaClarification(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/请提供/.test(t) && /(写作角度|writing_angle|avoid_recent|近期句子|避免)/.test(t)) {
    return true
  }
  if (/好的[，,]?\s*请提供/.test(t)) return true
  if (/请提供具体的/.test(t) && t.length <= 48) return true
  return false
}

/** 工作日上午/下午却写「今天先到这儿/剩下的明天」（仅傍晚后可用）。 */
export function companionTextHasPrematureWorkdayEnd(
  text: string,
  now: Date = new Date(),
): boolean {
  const h = now.getHours()
  if (h >= 17 || h < 6) return false
  const t = text.trim()
  if (/今天先到这儿|剩下的明天再碰|今天只做到这里/.test(t)) return true
  if (/先到这儿[，,].{0,8}剩下的明天/.test(t)) return true
  return false
}

/** 与桌面挂件场景不符的隐喻（结构/场景，非逐词黑名单）。 */
export function companionTextHasOffDesktopSceneMetaphor(text: string): boolean {
  const t = text.trim()
  if (/翻.{0,4}书|书页|读书|读一会儿书|看书|章节/.test(t)) return true
  if (/也是.{0,10}给自己/.test(t) && /(安静|角落|礼物|修行)/.test(t)) {
    return true
  }
  if (/窗外/.test(t)) return true
  if (/阳光透过|洒在桌|杯咖啡|一切都显得那么/.test(t)) return true
  if (/风景/.test(t) && /(心情|舒展|随|飘)/.test(t)) return true
  return false
}

/** 编造用户具体事务/现场（邮件、泡茶、家务等）。 */
export function companionTextHasInventedUserActivity(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/邮件|待办|报表|光标|键盘|文件/.test(t)) return true
  if (/消息|回.{0,4}信|查.{0,4}邮/.test(t)) {
    if (/弹出|刚到|刚来|刚弹出|最小化|来了|我晚/.test(t)) return true
  }
  if (/消息来了|我晚一点回|晚一点回那条/.test(t)) return true
  if (/桌面.{0,6}乱|收走|收一两件|收一两样/.test(t)) return true
  if (/暗一点|屏幕暗|我正舒服|舒服着呢/.test(t)) return true
  if (/窗口.{0,4}最小化|最小化.{0,4}窗口|放窗口|弹窗/.test(t)) return true
  if (/消息.{0,8}窗口/.test(t)) return true
  if (/水杯|温水|杯子|拿近|拿过来/.test(t)) return true
  if (/把.{0,8}(水|杯|茶)/.test(t)) return true
  if (/喝口水|喝口温|喝杯(温|热)水|不妨先喝|喝水/.test(t)) return true
  if (/泡.{0,2}茶|茶香|品茗|咖啡/.test(t)) return true
  if (/洗碗|做饭|买菜|快递|洗衣|家务/.test(t)) return true
  if (/处理那些|先.{0,6}再.{0,8}(吧|。)/.test(t) && /(邮件|茶|消息|家务|待办)/.test(t)) {
    return true
  }
  return false
}

/**
 * 换句高频：命令式（把/先…）+ 猜测现场（消息弹出、水杯等）。
 */
export function companionTextHasRegenerateImperativeOrGuess(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (companionTextHasInventedUserActivity(t)) return true
  if (/^(把|让|先)/.test(t) && !/^(可以|不妨|允许)/.test(t)) return true
  if (/^先(把|让|放|去)/.test(t)) return true
  if (
    /(肩膀|眼睛|脖子|腰).{0,6}(有点|发|酸|紧|僵)/.test(t) &&
    /(现在|先|就).{0,6}(松|动|停|做|歇)/
  ) {
    return true
  }
  if (/现在(松|动|停|做|喝|拿)/.test(t)) return true
  if (/松一松|动一动|喝一口|拿近/.test(t)) return true
  if (companionTextHasRegenerateVagueMantraCliche(t)) return true
  if (companionTextHasRegenerateNarratorFabrication(t)) return true
  if (companionTextHasRegenerateStepMantraCliche(t)) return true
  if (companionTextHasRegenerateCanButSkeleton(t)) return true
  if (companionTextHasDoLittleTodaySkeleton(t)) return true
  if (companionTextHasYesterdayComparisonSkeleton(t)) return true
  if (companionTextHasEffortAccumulationSkeleton(t)) return true
  if (companionTextHasProductMarketingCliche(t)) return true
  return false
}

/**
 * 换句：「我」扮演用户或编造现场（消息来了/桌面乱/暗一点舒服）。
 */
export function companionTextHasRegenerateNarratorFabrication(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/消息来了|我晚一点回/.test(t)) return true
  if (/桌面.{0,8}乱|收走.{0,4}件|收一两/.test(t)) return true
  if (/暗一点|屏幕暗|舒服着呢|我正舒服/.test(t)) return true
  if (/^我/.test(t) && /(消息|桌面|屏幕|暗|回|收|舒服|乱|通知)/.test(t)) {
    return true
  }
  return false
}

/**
 * 「这一步，你已经可以开始了」类口号（励志换句连刷）。
 */
export function companionTextHasRegenerateStepMantraCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/这一步|往前.{0,6}步|一小步/.test(t)) return true
  if (/已经.?可以开始|可以开始了|本来就有方向/.test(t)) return true
  if (/你往前|走的这一步/.test(t)) return true
  return false
}

export function buildRegenerateStepMantraRetryUserSuffix(): string {
  return [
    '【硬约束·重写】禁止「这一步/往前走的步/可以开始了/本来就有方向」。',
    '改写成励志白话：你/可以/今天/不必 + 具体判断；勿用「步」字口号。',
  ].join('')
}

/** 「今天你可以…，但…」/ 不必完美…但可以 / 兴趣渗入套句骨架。 */
export function companionTextHasRegenerateCanButSkeleton(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/，但/.test(t) && /(可以|不妨|允许|只|不必)/.test(t)) return true
  if (/不必完美|必须完美|真实地|真实地在场|向前走/.test(t)) return true
  if (/今天.{0,10}可以只/.test(t)) return true
  if (/但别错过|心里的光|一首歌|听一首|只听一|旋律|光影/.test(t)) {
    return true
  }
  if (/^今天够用了[。！？]?$/.test(t)) return true
  return false
}

export function buildRegenerateCanButRetryUserSuffix(
  style: CompanionCopyStyle,
): string {
  const min = 8
  return [
    '【硬约束·重写】禁止「不必…，但…」、禁止必须/不必完美、禁止真实地/在场/向前走。',
    `写${style}白话单句，至少${min}个汉字，如「你已经在路上了，这本身就不容易」。`,
  ].join('')
}

/** App 更新/功能公告腔（改写「更多功能将在 V1.1 解锁」时模型易产出）。 */
export function companionTextHasProductMarketingCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/新功能|功能正|奔赴|马上相见|全力|即将上线|版本更新/.test(t)) {
    return true
  }
  if (/V1[\.\d]|解锁/.test(t) && /功能|更新|上线|相见/.test(t)) {
    return true
  }
  return false
}

export function buildRegenerateProductMarketingRetryUserSuffix(
  style: CompanionCopyStyle,
): string {
  return [
    '【硬约束·重写】禁止 App 更新/新功能/版本/解锁/上线/奔赴/相见等产品公告。',
    `写一句${style}陪伴短话：对用户（你/今天/不必），不是写软件功能。`,
  ].join('')
}

export function buildRegenerateNarratorFabricationRetryUserSuffix(
  style: CompanionCopyStyle = '治愈',
): string {
  const tone =
    style === '励志'
      ? '语气须励志：方向感/微小可能（你/可以/今天/不必）；'
      : '写许可或判断（你/可以/不妨）；'
  return [
    '【硬约束·重写】上一句像在替用户编故事（我+消息/桌面/屏幕/暗/舒服）。',
    `${tone}禁止「我」扮演用户；禁止消息来了、桌面乱、暗一点、收走东西。`,
  ].join('')
}

/**
 * 换句套句：窗口+呼吸、空泛励志（算数/分量/这一步）。
 */
export function companionTextHasRegenerateVagueMantraCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/少开几个|关掉几个|关.{0,3}窗口|开.{0,3}窗口|几个窗口/.test(t)) {
    return true
  }
  if (/呼吸.{0,6}自在|自在.{0,4}呼吸/.test(t)) return true
  if (/自有.{0,6}分量|已经算数|走的这一步|此刻的付出|这一步.{0,4}算|付出的.{0,6}分量/.test(t)) {
    return true
  }
  if (companionTextHasRegenerateStepMantraCliche(t)) return true
  if (/^我(少开|关掉|关几个|走的这一步|此刻的付出)/.test(t)) return true
  if (/^我.{0,8}，.{0,8}(算数|分量|自在)/.test(t)) return true
  return false
}

export function buildRegenerateVagueMantraRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句空泛或猜现场（少开/关窗口/呼吸自在/我走的这一步/自有分量/已经算数）。',
    '改写成具体白话许可：可以/不妨/晚一点/今天/不必；一句一事；禁止窗口、呼吸、算数、分量、付出。',
  ].join('')
}

export function buildRegenerateImperativeGuessRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句像在猜用户现场或下命令（把/先/现在做/消息弹出/水杯/窗口）。',
    '改写成许可句：可以/不妨/晚一点/今天/不必起笔；禁止把/让/先/现在+动词。',
  ].join('')
}

/** 文艺时段+旋律+思绪类套句（local_time_hint × 音乐兴趣易触发）。 */
export function companionTextHasPoeticTimeMelodyCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/(午后|傍晚|宁静|静谧).*(思绪|旋律|飘荡|灵魂|安宁)/.test(t)) return true
  if (/让(心情|心|思绪|心灵|灵魂).{0,8}(随|飘|轻|飞|扬|栖)/.test(t)) return true
  if (/让思绪.*(飘荡|飘|飞扬)/.test(t)) return true
  if (/旋律.*(响起|悠扬|飘荡|心中)/.test(t)) return true
  if (/片刻宁静|午后的?阳光|午后阳光|在这.{0,10}(宁静|静谧|安静|片刻)/.test(t)) {
    return true
  }
  if (/灵魂.{0,6}栖息|让灵魂|心中.{0,8}安宁|一片安宁/.test(t)) return true
  if (/阳光.*(温暖|心中|心里|多了)/.test(t)) return true
  if (/悠扬/.test(t) && /(旋律|飘荡|飞扬)/.test(t)) return true
  return false
}

/** 输出时段词与本地时刻明显不符（如上午仍写午后）。 */
export function companionTextHasMismatchedPeriodWord(
  text: string,
  now: Date = new Date(),
): boolean {
  const t = text.trim()
  if (!t) return false
  const h = now.getHours()
  if (h < 12 && /(午后|午后阳光|下午|傍晚)/.test(t)) return true
  if (h < 6 && /(上午|午间|午后|下午|傍晚|阳光)/.test(t)) return true
  if (h >= 18 && /(清晨|上午|午间)/.test(t)) return true
  if (h >= 22 && /(午后|下午|午间|上午|清晨)/.test(t)) return true
  if (h < 7 && /(午后|下午|傍晚)/.test(t)) return true
  return false
}

export function buildMismatchedPeriodRetryUserSuffix(now: Date = new Date()): string {
  const h = now.getHours()
  let band: string
  if (h < 6) band = '深夜'
  else if (h < 9) band = '清晨'
  else if (h < 12) band = '上午'
  else if (h < 14) band = '午间'
  else if (h < 18) band = '下午'
  else if (h < 22) band = '傍晚'
  else band = '夜间'
  return [
    `【硬约束】上一句时段词与当前本地时刻不符。此刻是${band}，`,
    '禁止写与此时段矛盾的词（如上午写午后/下午，傍晚写清晨/上午）。',
    '可写身体感受或许可，勿堆砌阳光/旋律/思绪套句。',
  ].join('')
}

/** 「允许未拆封…在心上静静…」类散文许可套句（书籍兴趣 + 治愈最易触发）。 */
export function companionTextHasLiteraryPermissionCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/未拆封|在心上/.test(t)) return true
  if (/允许.{0,12}(春天|温柔|月光|花期|馈赠|美好)/.test(t)) return true
  if (/静静(放着|落座|存放|流淌|静置|安放|停留)/.test(t)) return true
  if (
    /^允许[^，,。！？]{0,24}[，,]/.test(t) &&
    /(心上|静静|春天|温柔|落座|存放|安放|馈赠)/.test(t)
  ) {
    return true
  }
  return false
}

export function buildLiteraryPermissionRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是散文格言套句（允许未拆封/在心上静静/春天温柔落座）。',
    '改写成口语白话：可以/不妨/晚一点 + 具体小事；至少8个汉字；禁止未拆封/在心上/静静/春天/温柔/馈赠/安放意象。',
  ].join('')
}

/** 茶香/晨曦/光影等散文感官堆砌（模型在治愈+兴趣场景极高频）。 */
export function companionTextHasLiterarySensoryCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/茶香|晨曦|抹淡雅|沉睡的心灵|悄然唤醒|悄然升起|抚摸/.test(t)) {
    return true
  }
  if (/在.{0,6}(清晨|光影|午后|傍晚).{0,8}[，,]/.test(t) && /(茶香|阳光|风|心灵)/.test(t)) {
    return true
  }
  if (/一缕.{0,6}(茶香|阳光|风)/.test(t)) return true
  if (/在这一刻[，,]/.test(t) && /(心灵|思绪|画笔|灵魂)/.test(t)) return true
  if (/让.{0,8}(心灵|思绪|灵魂).{0,10}(随|飘|舞|荡|飞|栖)/.test(t)) return true
  if (/在这.{0,10}(宁静|静谧).{0,8}片刻/.test(t)) return true
  if (/灵魂.{0,6}栖息|心中.{0,8}安宁|一片安宁/.test(t)) return true
  return false
}

export function buildLiterarySensoryRetryUserSuffix(): string {
  return [
    '【硬约束】上一句像茶香/晨曦/光影/旋律类散文套句。',
    '改写成口语桌面短句：身体感受、直白许可或短判断；禁止茶香/晨曦/午后阳光/让心灵飘荡/画笔舞动。',
    '严格按 writing_angle 白名单句法重写，一句一重心。',
  ].join('')
}

/** 兴趣被误写成「建议用户去做 + 心情升华」套句。 */
export function companionTextHasInterestActivityCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/听(一?首|点|首)?/.test(t) && /(音乐|歌)/.test(t)) return true
  if (/让心情.*(飞扬|愉悦|跟着|旋律|飘|起来)/.test(t)) return true
  if (/^(去|来)(听|看|读|追)/.test(t)) return true
  if (/旋律|情节|留白/.test(t)) return true
  if (/旋律|悠扬|飘荡/.test(t) && /(心情|思绪|宁静|午后)/.test(t)) return true
  return false
}

/**
 * 模型高频 wellness 口号骨架：
 * 这会儿+放空/放松、让心情+缓缓/舒展 等，无具体身体/许可重心。
 */
export function companionTextHasWellnessMantraSkeleton(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/^这会儿[^。！？]{0,18}(放空|放松|歇|慢下来|让自己)/.test(t)) {
    return true
  }
  if (/^这会儿[，,]/.test(t) && /(心情|放松|放空|舒展|缓缓|慢慢)/.test(t)) {
    return true
  }
  if (/让自己.{0,6}放松/.test(t)) return true
  if (/放空一下/.test(t)) return true
  if (
    /让(自己|心情|心|思绪).{0,12}(缓缓|慢慢|静静|轻轻|舒展|松下来|慢下来|飘)/.test(
      t,
    )
  ) {
    return true
  }
  return false
}

/** 「你此刻的节奏，就是刚刚好的样子」类空泛对仗（换句三连刷）。 */
export function companionTextHasPaceMantraCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/你此刻的节奏|你的节奏[，,]就是/.test(t)) return true
  if (/节奏[，,]就是.{0,10}(刚刚|最合|最好|正好|合适|对的)/.test(t)) {
    return true
  }
  if (/刚刚好的样子|最合适的样子|最好的样子|刚刚好的节奏/.test(t)) {
    return true
  }
  if (/^你.{0,6}此刻/.test(t) && /节奏/.test(t)) return true
  if (/就是.{0,8}最.{0,2}(合适|好)的(样子|节奏)/.test(t)) return true
  return false
}

export function buildPaceMantraRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是「你此刻的节奏/刚刚好的样子」类空泛对仗套句。',
    '改写成具体白话：可以/不妨 + 一件小事（喝水、肩膀、晚一点、今天够满了）；禁止节奏/刚刚好/最合适/样子。',
  ].join('')
}

/** 兴趣+比喻套句：不是每段…/就像…/留白/旋律/情节/书页（换句高频）。 */
export function companionTextHasInterestProseMetaphorTemplate(
  text: string,
): boolean {
  const t = text.trim()
  if (!t) return false
  if (/不是每(段|一|次|种|句|场|个)?/.test(t)) return true
  if (/偶尔留白/.test(t)) return true
  if (/留白/.test(t) && /(给自己|也是|温柔|种|不妨)/.test(t)) return true
  if (/就像/.test(t)) return true
  if (/像.{0,10}一样/.test(t)) return true
  if (/与其.{0,24}不如/.test(t)) return true
  if (/书页|片刻宁静|慢镜头|休止符|故事情节|一段情节|一段旋律/.test(t)) {
    return true
  }
  if (/旋律|情节/.test(t)) return true
  return false
}

export function buildInterestProseMetaphorRetryUserSuffix(): string {
  return [
    '【硬约束·重写】上一句是兴趣比喻/散文套句（就像/不是每/旋律/情节/书页/留白/偶尔留白/与其不如）。',
    '改写成口语桌面短句：身体感受+直白许可（可以/不妨/允许）；一句一重心；兴趣可完全不写；禁止任何比喻从句。',
  ].join('')
}

/** 是否命中禁止的叙事骨架（逗号升华、偶尔+逗号、对仗格言等）。 */
export function companionTextViolatesBannedStructure(
  text: string,
  style?: CompanionCopyStyle,
  maxChars?: number,
  now?: Date,
): boolean {
  const t = text.trim()
  if (!t) return true
  if (companionTextHasFormulaSkeleton(t)) return true
  if (companionTextHasMotivationalParallelTemplate(t)) return true
  if (companionTextHasEllipticalTail(t)) return true
  if (companionTextHasOffDesktopSceneMetaphor(t)) return true
  if (companionTextHasInventedUserActivity(t)) return true
  if (companionTextHasInterestActivityCliche(t)) return true
  if (companionTextHasInterestProseMetaphorTemplate(t)) return true
  if (companionTextHasPoeticTimeMelodyCliche(t)) return true
  if (companionTextHasSceneryMoodCliche(t)) return true
  if (companionTextHasLiterarySensoryCliche(t)) return true
  if (companionTextHasLiteraryPermissionCliche(t)) return true
  if (companionTextIsAgentMetaClarification(t)) return true
  if (companionTextHasPrematureWorkdayEnd(t, now ?? new Date())) return true
  if (companionTextHasMismatchedPeriodWord(t, now ?? new Date())) return true
  if (companionTextHasWellnessMantraSkeleton(t)) return true
  if (companionTextHasPaceMantraCliche(t)) return true
  if (companionTextHasRestBreakPermissionCliche(t)) return true
  if (companionTextHasOralPermissionCliche(t)) return true
  if (companionTextHasRegenerateImperativeOrGuess(t)) return true
  if (companionTextHasRegenerateVagueMantraCliche(t)) return true
  if (companionTextHasRegenerateNarratorFabrication(t)) return true
  if (companionTextHasRegenerateStepMantraCliche(t)) return true
  if (companionTextHasRegenerateCanButSkeleton(t)) return true
  if (companionTextHasDoLittleTodaySkeleton(t)) return true
  if (companionTextHasYesterdayComparisonSkeleton(t)) return true
  if (companionTextHasEffortAccumulationSkeleton(t)) return true
  if (companionTextHasProductMarketingCliche(t)) return true
  if (style != null && maxChars != null && companionTextTooShort(t, maxChars, style)) {
    return true
  }
  return false
}
