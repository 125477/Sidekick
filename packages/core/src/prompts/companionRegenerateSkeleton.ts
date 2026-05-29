/**
 * 换句高频骨架检测（句法结构，非禁词表）。
 * 独立模块，供 prompt 组装与出参质检共用。
 */

import { companionTextHasRouteComfortPermissionCliche } from './companionLineSimilarity'

/** 换句 few-shot 排除：易诱发套句骨架或难听的「假治愈」示范。 */
export const REGENERATE_FEWSHOT_SKIP =
  /今天.{0,12}(做|完成|动|开始|把手边).{0,10}一点|做一点.{0,10}(少|轻|减)|一点.{0,8}(就).{0,6}(少|轻)|再小的一步|挪半步|赢一小局|把目标放小|先完成眼前|留给明天|不必一次做完|比昨天|诚实一点|往哪走|每一次尝试|试过的每|都在为下|都在悄悄|都算数|铺路|走.{0,8}路|跟着感觉|慢一点.{0,6}都行|心里舒服|今天不顺|马上振作|先把水喝|省电|难缠的事留在桌上|留在桌上|肩膀松|眼皮沉|回消息慢/

/** 「比昨天更懂/更清楚自己 / 看清真正想要 / 下一步往哪走」空泛励志骨架。 */
export function companionTextHasYesterdayComparisonSkeleton(
  text: string,
): boolean {
  const t = text.trim()
  if (!t) return false
  if (/比昨天/.test(t)) {
    if (
      /(手上的|手里的|手头|这件事|这一步|那个|待办|清单|进度|心里|桌上|眼前)/.test(
        t,
      )
    ) {
      return false
    }
    return true
  }
  if (/^(你比|你已经|你正在)/.test(t) && /(更|多|慢慢)/.test(t)) {
    return true
  }
  if (/慢慢看清/.test(t)) return true
  if (/更清楚.*想要|真正想要/.test(t)) return true
  if (/多懂了一点自己|更懂.*自己/.test(t)) return true
  if (/更知道.*(往哪|方向|下一步)/.test(t)) return true
  if (/下一步往哪/.test(t)) return true
  return false
}

/**
 * 「你试过的每一步/每一次尝试，都在…/都算数/铺路」积累型励志口号（换句三连刷）。
 * 判句法骨架，非禁词表。
 */
export function companionTextHasEffortAccumulationSkeleton(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/每一次尝试/.test(t)) return true
  if (/试过的每(一)?(步|回|次)/.test(t)) return true
  if (/^你/.test(t) && /(试过|每一次|每次尝试|每一次尝试)/.test(t)) {
    if (/(都在|都算|铺路|改写|叠|积|攒)/.test(t)) return true
  }
  if (/^你.{0,14}(步|回|次|尝试).{0,10}(都算|在铺路|在改|都在|会改)/.test(t)) {
    return true
  }
  if (/为下(一)?次铺路/.test(t)) return true
  if (/都在悄悄/.test(t)) return true
  if (/^你[^，,。！？]{0,16}，?都算数[。！？]?$/.test(t)) return true
  if (/每一刻[，,].{0,8}都算数/.test(t)) return true
  if (/允许自己.{0,12}停顿/.test(t) && /都算数/.test(t)) return true
  if (/^你/.test(t) && /停顿/.test(t) && /都算数/.test(t)) return true
  return false
}

/** 「今天做一点，事情就少一点 / 负担轻一点 / 你手头这事」励志口号骨架。 */
export function companionTextHasDoLittleTodaySkeleton(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/今天.{0,10}(做|完成|推进).{0,8}一点/.test(t)) return true
  if (/做一点.{0,10}(少|轻|减)/.test(t)) return true
  if (/一点.{0,6}就.{0,6}(少|轻|减)/.test(t)) return true
  if (/你手头这事/.test(t)) return true
  if (/负担就.{0,8}(实实在在)?轻一点/.test(t)) return true
  if (/事情就.{0,6}(真|确实)?少一点/.test(t)) return true
  if (/完成一点/.test(t) && /[少轻减]/.test(t)) return true
  return false
}

/** 屏上句已是套句时，不再走「改写」，改要求全新句法。 */
export function companionRewriteTargetIsRegenerateCliche(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (companionTextHasRouteComfortPermissionCliche(t)) return true
  if (companionTextHasDoLittleTodaySkeleton(t)) return true
  if (companionTextHasYesterdayComparisonSkeleton(t)) return true
  if (companionTextHasEffortAccumulationSkeleton(t)) return true
  if (REGENERATE_FEWSHOT_SKIP.test(t)) return true
  if (/，但/.test(t) && /(可以|不必|不妨)/.test(t)) return true
  if (/不必完美|真实地|在场|向前走/.test(t)) return true
  if (/新功能|奔赴|解锁|V1[\.\d]/.test(t)) return true
  if (/这一步|可以开始了|本来就有方向/.test(t)) return true
  return false
}

export function buildRegenerateDoLittleTodayRetryUserSuffix(
  style: string,
): string {
  return [
    '【硬约束·重写】禁止「今天做一点/少一点/轻一点/手头这事/负担轻」式口号。',
    `写${style}白话：判断或承认（如「卡住的时候，说明你在认真想」）；禁止「一点」配「少/轻」。`,
  ].join('')
}

export function buildRegenerateYesterdayComparisonRetryUserSuffix(
  style: string,
): string {
  return [
    '【硬约束·重写】禁止「比昨天/更懂自己/看清真正想要/下一步往哪走」式空泛励志。',
    `写${style}白话：写当下判断（如「你已经在路上了，这本身就不容易」）；禁比昨天、禁自我认知口号。`,
  ].join('')
}

export function buildRegenerateEffortAccumulationRetryUserSuffix(
  style: string,
): string {
  return [
    '【硬约束·重写】上一句是「你试过/每一次…都在…/都算数/铺路」式积累励志口号，须换完全不同的叙事方式。',
    `写${style}白话：此刻许可或判断（可以/不妨/今天够用了/晚一点也行）；一句一事；禁止积累/铺路/改写结果式收束。`,
  ].join('')
}
