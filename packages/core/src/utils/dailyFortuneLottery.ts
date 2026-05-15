import type { DailyLotteryDraw, FortuneTier } from '../schema/data'

const TIERS: FortuneTier[] = [
  '上上签',
  '上签',
  '中上签',
  '中签',
  '中下签',
  '下签',
]

/** 权重总和 100；中签仍略多；上上/上签略抬高；下签刻意压低（约 3%）。 */
const WEIGHTS = [12, 20, 20, 31, 14, 3]

const VERSES: Record<FortuneTier, readonly string[]> = {
  上上签: [
    '云开见月，水到渠成。',
    '吉星高照，所求皆顺。',
    '心诚则灵，好事将近。',
    '春风得意，步履生风。',
  ],
  上签: [
    '小有耕耘，终有收获。',
    '守正待时，贵人相助。',
    '稳中求进，勿急勿躁。',
    '顺水行舟，一日千里。',
  ],
  中上签: [
    '平常心是道，今日宜整理心情。',
    '细水方能长流，宜小步快跑。',
    '先照顾好自己，再顾世界。',
    '把一件小事做完，就是胜利。',
  ],
  中签: [
    '无大吉亦无大凶，宜守不宜冒。',
    '今日宜喝温水、伸懒腰、早点睡。',
    '事缓则圆，话少则安。',
    '把期待调低一格，快乐会高一点。',
  ],
  中下签: [
    '偶有阻滞，当作修行。',
    '宜退一步，不争一日短长。',
    '情绪有浪，记得靠岸休息。',
    '今日宜独处片刻，少做决定。',
  ],
  下签: [
    '逆风时更要护住心火。',
    '宜止损、宜休息、宜求助。',
    '乌云会散，先把自己安顿好。',
    '退一步海阔天空，明日再议。',
  ],
}

const HINTS: Record<FortuneTier, readonly string[]> = {
  上上签: ['宜主动推进一件你真正在意的事。', '宜分享好消息给在意的人。'],
  上签: ['宜完成一件拖延的小任务。', '宜对身边人说一句谢谢。'],
  中上签: ['宜整理桌面与待办清单。', '宜散步十分钟，晒晒太阳。'],
  中签: ['宜保持节奏，不追加新承诺。', '宜喝水、拉伸、远眺。'],
  中下签: ['宜早睡，少刷短视频。', '宜把大决定留到睡饱之后。'],
  下签: ['宜降低强度，允许自己慢下来。', '宜向信任的人倾诉一句真话。'],
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T
}

function pickTier(): FortuneTier {
  const r = Math.random() * 100
  let acc = 0
  for (let i = 0; i < TIERS.length; i++) {
    acc += WEIGHTS[i] ?? 0
    if (r < acc) return TIERS[i] as FortuneTier
  }
  return '中签'
}

export function localCalendarDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 生成一条新的当日签（不读写存储）。 */
export function rollDailyDraw(now = new Date()): DailyLotteryDraw {
  const tier = pickTier()
  return {
    date: localCalendarDate(now),
    tier,
    verse: pickRandom(VERSES[tier]),
    hint: pickRandom(HINTS[tier]),
  }
}
