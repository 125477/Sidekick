/**
 * 陪伴短句「气质参考」池——每轮随机抽 2 条人类示范，让模型学气质而非套模板。
 * 正向 few-shot，不指定起笔、不堆禁词。
 */

import type { CompanionCopyStyle } from './textPrompt'

const STYLE_EXEMPLARS: Record<CompanionCopyStyle, readonly string[]> = {
  治愈: [
    '你撑到今天，本身就挺不容易的。',
    '有些乱，先放着，也算在喘气。',
    '不必把今天解释清楚，先坐稳就好。',
    '事情没做完，不等于你不够好。',
    '刚才那一下，大概真的有点重。',
    '心里的噪音大的时候，先不急着关掉它。',
    '今天做到这儿，已经算给自己留了余地。',
    '回消息慢半拍，不算失礼。',
    '你不必立刻变好，能稳住就挺好。',
    '先把这口气匀过来，别的等一等。',
    '难缠的事留在桌上，人可以先离开一会儿。',
    '有些话现在说不出来，就先不说。',
    '你已经很用力了，只是今天看起来不明显。',
    '肩膀松不下来也正常，身体比人诚实。',
    '把标准放低一点，不是放弃，是省电。',
    '今天不顺，不代表后面都会这样。',
    '没答上来的题，可以先搁在纸上。',
    '情绪堆着的时候，先别逼自己整理清楚。',
    '你不需要马上振作，先把水喝了也行。',
    '世界还在转，你可以先慢一步。',
    '有些疲惫，是心里在要一个边界。',
    '不完美的今天，也值得被正常对待。',
    '心里发紧的时候，先承认它发紧。',
    '把「应该」放一边，听听自己现在需要什么。',
    '今天哪一件小事，让你稍微轻了一些？',
    '眼皮沉的时候，允许自己就慢半拍。',
    '先到这儿，也已经够了。',
    '与其逼自己立刻答完，不如先让肩膀松一点。',
    '不是你不努力，是今天已经够满了。',
  ],
  励志: [
    '再小的一步，也算在向前。',
    '今天能开始，就已经很难得。',
    '方向还没看清没关系，脚先挪半步也行。',
    '进步不用很大，只要比昨天诚实一点。',
    '卡住的时候，说明你在认真想。',
    '你已经在路上了，这本身就不容易。',
    '把目标放小一点，先完成眼前这一件。',
    '不必一次做完，但可以先动一下。',
    '今天能把手边这一件做完，就算赢一小局。',
    '先把能做的做了，不能做的留给明天。',
    '没准备好也可以开始，开始后再调整。',
    '状态一般的日子，也要算进生活里。',
    '把「再试一次」当成给今天留的缝。',
    '你已经在试，这就比停在原地强。',
  ],
  搞笑: [
    '脑子罢工了？那就先给它放个短假。',
    '今日 CPU 过载，建议切换省电模式。',
    '人还在线，但灵魂已经去隔壁串门了。',
    '事情很多，但你的拖延仍然很有天赋。',
    '今天这个进度条，像网速一样随缘。',
    '世界没崩，主要是你的专注先溜了。',
    '今天状态一般，但奶茶还在。',
    '事情一堆，但你的可爱还在线。',
    '先摸鱼三分钟，不算犯罪吧？',
    '任务堆成山，但零食还在召唤你。',
    '脑子今天请假，我帮它写条理由。',
  ],
  助眠: [
    '今天先到这儿，剩下的交给明天。',
    '把没做完的事先放在明天门口。',
    '夜深了，先把注意力从屏幕挪开。',
    '桌面可以暗下来，脑子也可以。',
    '没回完的消息，明天再出现也不算晚。',
    '把今天轻轻盖过去，像盖薄毯。',
    '你值得在这会儿什么都不做。',
    '让眼皮先沉下去，心可以跟上。',
    '醒着也行，但不必再用力了。',
    '可以什么都不想，先让呼吸慢下来。',
    '夜很深了，允许世界先安静一会儿。',
  ],
  职场解压: [
    '不必一次扛完，先放下一角也好。',
    '今天已经够满，剩下的明天再碰。',
    '不必把明天的债今天全还完。',
    '下班了，你的价值不必靠回消息证明。',
    '今天已经交卷，剩下的不必续写。',
    '先把边界画出来，心才能松一点。',
    '一次扛不完的事，本来就可以分次。',
    '允许今天只做百分之七十。',
    '先把工作留在工作里，人回人这边。',
    '允许下班后再想工作的事。',
    '先把这一件做完，别的稍后再说。',
  ],
  抽象: [
    '有些答案，本来就不需要今天出现。',
    '世界很大，你的小情绪也算数。',
    '人生像未读红点，永远清不完。',
    '你现在的状态，像半加载的页面。',
    '意义可以是后话，存在感不能欠费。',
    '宇宙不在乎 KPI，但你在乎也正常。',
    '今天像随机掉落，捡起来也算收集。',
    '情绪像后台进程，不占屏也在跑。',
    '世界按自己的节奏转，你可以不同步。',
    '今天像一张没写完的便签，也没关系。',
    '意义可以晚一点再找，人要先在。',
  ],
}

function hashSeed(seed: number, salt: string): number {
  let h = seed | 0
  for (let i = 0; i < salt.length; i++) {
    h = (Math.imul(31, h) + salt.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function lineOverlapsAvoid(line: string, avoid: string[]): boolean {
  const t = line.trim()
  if (!t) return true
  for (const a of avoid) {
    const b = a.trim()
    if (!b) continue
    if (t === b) return true
    if (t.length >= 6 && b.length >= 6 && (t.includes(b.slice(0, 6)) || b.includes(t.slice(0, 6)))) {
      return true
    }
  }
  return false
}

/** 按 seed 抽 2 条与 recent 重叠少的示范句。 */
export function pickStyleFewShots(
  style: CompanionCopyStyle,
  seed: number,
  avoidRecent: string[] = [],
  count = 2,
): string[] {
  const pool = [...STYLE_EXEMPLARS[style]]
  if (pool.length === 0) return []

  const ordered = pool
    .filter((line) => !lineOverlapsAvoid(line, avoidRecent))
    .sort(
      (a, b) =>
        hashSeed(seed, a) - hashSeed(seed, b) ||
        a.localeCompare(b, 'zh-CN'),
    )

  const picked: string[] = []
  for (const line of ordered.length > 0 ? ordered : pool) {
    if (picked.includes(line)) continue
    picked.push(line)
    if (picked.length >= count) break
  }
  return picked
}

/** 写入百炼 `writing_angle` 变量：气质参考（正向 few-shot）。 */
export function buildStyleReferenceBlock(
  style: CompanionCopyStyle,
  seed: number,
  avoidRecent: string[] = [],
): string {
  const shots = pickStyleFewShots(style, seed, avoidRecent, 2)
  if (shots.length === 0) {
    return '【气质参考】写一句通顺、单重心的桌面短句即可；勿照抄最近句。'
  }
  const lines = shots.map((s, i) => `${i + 1}. 「${s}」`)
  return [
    '【气质参考·勿照抄】以下只学语气与粒度，不得复述或只改几个字：',
    ...lines,
    '请写一句气质接近但措辞、起笔、重心都全新的短句。',
  ].join('\n')
}
