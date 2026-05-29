/**
 * 陪伴短句「气质参考」池——每轮随机抽 2 条人类示范，让模型学气质而非套模板。
 * 正向 few-shot，不指定起笔、不堆禁词。
 */

import type { CompanionCopyStyle } from './textPrompt'
import { REGENERATE_FEWSHOT_SKIP } from './companionRegenerateSkeleton'

const STYLE_EXEMPLARS: Record<CompanionCopyStyle, readonly string[]> = {
  治愈: [
    '你值得的温柔，也可以先留给自己。',
    '慢一点没关系，月亮也是慢慢圆的。',
    '你已经在很认真生活了，这本身就很勇敢。',
    '有些夜很长，但总会亮一点。',
    '你不必解释今天的自己，被理解可以慢慢来。',
    '温柔不是软弱，是你还在好好活着。',
    '难的时候，允许自己只做一个人，不做英雄。',
    '今天辛苦了，可以先对自己说一句谢谢。',
    '你不需要完美，只需要还在这里。',
    '雨会停，你也会重新变得柔软。',
    '把今天轻轻收好，明天还来得及继续。',
    '你心里那点疼，值得被好好对待。',
    '你已经走了很远，歇脚不丢人。',
    '风还在吹，你会慢慢找到自己的节奏。',
    '事情没做完，不等于你不够好。',
    '刚才那一下，大概真的有点重。',
    '你已经很用力了，只是今天看起来不明显。',
    '不完美的今天，也值得被正常对待。',
    '不是你不努力，是今天已经够满了。',
    '你撑到今天，本身就挺不容易的。',
    '有些话现在说不出来，就先不说。',
    '你不必立刻变好，能稳住就挺好。',
    '世界吵的时候，你也可以安静一会儿。',
    '累了就靠一会儿，这不叫认输。',
    '有人懂你慢，这本身就是一种温柔。',
    '把心放下一点点，世界不会因此塌掉。',
    '你扛过的那些，其实都值得被看见。',
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
  ],
  鸡汤: [
    '生活不会一直难，也不会一直顺，但你会慢慢学会和自己相处。',
    '你已经很勇敢了，只是今天看起来不明显。',
    '有些路得一个人走，但你不等于一个人。',
    '允许自己偶尔脆弱，这不影响你值得被好好对待。',
    '世界很大，你的小情绪也值得被认真看见。',
    '不必向所有人解释，懂你的人会在。',
    '今天的你，已经比昨天多撑过了一天。',
    '慢慢来，比较快；先把自己照顾好。',
    '你不必完美，只需要还在认真生活。',
    '有些夜晚很长，但天亮总会来一点。',
  ],
  沙雕: [
    '今天的脑子：已离线，请稍后再试。',
    '任务很多，但你的摸鱼技巧也很成熟。',
    '世界没崩，主要是你的专注先跑路了。',
    '今日状态：人还在，魂在隔壁。',
    '进度条像网速，时快时慢，随缘吧。',
    '事情一堆，但零食还在坚定地召唤你。',
    'CPU 过热，建议切换省电模式。',
    '今天这个班，上得很有创意。',
    '先摸鱼三分钟，不算犯罪吧？',
    '脑子罢工了，身体还在硬撑，挺感人。',
  ],
  高冷: [
    '不必解释，懂的人自然懂。',
    '就这样，也挺好。',
    '话少，不代表没在想。',
    '今天到此为止，够了。',
    '不必讨好所有期待。',
    '安静一点，没什么不好。',
    '不必证明什么，时间会说。',
    '有些答案，本来就不急着给。',
    '可以慢，但不必慌。',
    '不必把话说满，留白也行。',
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

/** 换句专用 few-shot：排除易诱发「今天做一点就少一点」的示范句。 */
export function pickRegenerateStyleFewShots(
  style: CompanionCopyStyle,
  seed: number,
  avoidRecent: string[] = [],
  count = 2,
): string[] {
  const pool = [...STYLE_EXEMPLARS[style]].filter(
    (line) => !REGENERATE_FEWSHOT_SKIP.test(line),
  )
  if (pool.length === 0) {
    return pickStyleFewShots(style, seed, avoidRecent, count)
  }

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
