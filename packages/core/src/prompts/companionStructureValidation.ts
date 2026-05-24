/**
 * 套句校验：只判「叙事骨架/句法结构」，不维护禁词表。
 * 与 `companionTextHasFormulaSkeleton` 对齐；生成链路优先用本函数。
 */

import {
  companionTextHasEllipticalTail,
  companionTextHasFormulaSkeleton,
  companionTextHasMotivationalParallelTemplate,
  companionTextTooShort,
  type CompanionCopyStyle,
} from './textPrompt'

/** 与桌面挂件场景不符的隐喻（结构/场景，非逐词黑名单）。 */
export function companionTextHasOffDesktopSceneMetaphor(text: string): boolean {
  const t = text.trim()
  if (/翻.{0,4}书|书页|读书|读一会儿书|看书|章节/.test(t)) return true
  if (/也是.{0,10}给自己/.test(t) && /(安静|角落|礼物|修行)/.test(t)) {
    return true
  }
  if (/窗外/.test(t)) return true
  if (/风景/.test(t) && /(心情|舒展|随|飘)/.test(t)) return true
  return false
}

/** 编造用户具体事务/现场（邮件、泡茶、家务等）。 */
export function companionTextHasInventedUserActivity(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/邮件|待办|报表|光标|键盘|文件/.test(t)) return true
  if (/消息|回.{0,4}信|查.{0,4}邮/.test(t)) return true
  if (/泡.{0,2}茶|喝水|喝杯|咖啡|热了.{0,4}水|缓缓神/.test(t)) return true
  if (/洗碗|做饭|买菜|快递|洗衣|家务/.test(t)) return true
  if (/处理那些|先.{0,6}再.{0,8}(吧|。)/.test(t) && /(邮件|茶|消息|家务|待办)/.test(t)) {
    return true
  }
  return false
}

/** 文艺时段+旋律+思绪类套句（local_time_hint × 音乐兴趣易触发）。 */
export function companionTextHasPoeticTimeMelodyCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/(午后|傍晚|宁静).*(思绪|旋律|飘荡)/.test(t)) return true
  if (/让(心情|心|思绪|心灵).{0,8}(随|飘|轻|飞|扬)/.test(t)) return true
  if (/让思绪.*(飘荡|飘|飞扬)/.test(t)) return true
  if (/旋律.*(响起|悠扬|飘荡|心中)/.test(t)) return true
  if (/片刻宁静|午后阳光|在这.{0,10}宁静/.test(t)) return true
  if (/阳光.*(温暖|心中|心里|多了)/.test(t)) return true
  if (/悠扬/.test(t) && /(旋律|飘荡|飞扬)/.test(t)) return true
  return false
}

/** 输出时段词与本地时刻明显不符（如 18 点仍写午后）。 */
export function companionTextHasMismatchedPeriodWord(
  text: string,
  now: Date = new Date(),
): boolean {
  const t = text.trim()
  if (!t) return false
  const h = now.getHours()
  if (h >= 15 && /午后/.test(t)) return true
  if (h >= 18 && /(下午阳光|午间|上午|清晨)/.test(t)) return true
  if ((h < 6 || h >= 22) && /(午后|下午|傍晚|阳光)/.test(t)) return true
  return false
}

/** 兴趣被误写成「建议用户去做 + 心情升华」套句。 */
export function companionTextHasInterestActivityCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/听(一?首|点|首)?/.test(t) && /(音乐|歌)/.test(t)) return true
  if (/让心情.*(飞扬|愉悦|跟着|旋律|飘|起来)/.test(t)) return true
  if (/^(去|来)(听|看|读|追)/.test(t)) return true
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
  if (companionTextHasPoeticTimeMelodyCliche(t)) return true
  if (companionTextHasMismatchedPeriodWord(t, now ?? new Date())) return true
  if (companionTextHasWellnessMantraSkeleton(t)) return true
  if (style != null && maxChars != null && companionTextTooShort(t, maxChars, style)) {
    return true
  }
  return false
}
