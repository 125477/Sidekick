import type { CompanionCopyTrigger } from '../prompts/textPrompt'

const FALLBACK: Partial<Record<CompanionCopyTrigger, string[]>> = {
  similar: [
    '还是这种轻轻的语气，换一句陪在你身边。',
    '顺着刚才的心意，再送你一句不一样的温柔。',
  ],
  unlock: [
    '屏幕又亮了，这会儿不用赶，慢慢来就好。',
    '回来了呀，先喝口水，再接着过今天。',
  ],
  'focus-end': [
    '这一段专注先告一段落，肩膀松一松也很好。',
    '刚专注完，给自己一点空白，也算照顾了自己。',
  ],
  'journal-closure': [
    '今天这些话已经收好了，明天的你会读到它们。',
    '写下来就好，不必完美，你已经很认真地陪了自己一天。',
  ],
  'streak-nudge': [
    '连续几天都记得看看自己，这份坚持本身就很珍贵。',
    '你一直在留下痕迹，灵伴都看见了，继续按你的节奏就好。',
  ],
  'interest-deepen': [
    '最近有什么小事，会让你嘴角轻轻上扬？',
    '若用一句话形容今天的你，你会选哪个词？',
  ],
}

export function pickCompanionTriggerFallback(
  trigger: CompanionCopyTrigger,
): string {
  const list = FALLBACK[trigger]
  if (!list?.length) return '此刻，你值得被温柔地看见。'
  return list[Math.floor(Math.random() * list.length)]!
}
