/** 历史小结详情 · 日记文案展示气泡变体（设计稿 / 实现共用 id） */
export type MoodHistoryQuoteBubbleVariant =
  | 'companion-tail'
  | 'soft-violet'
  | 'editorial-wide'
  | 'quote-bar'
  | 'pill-chip'
  | 'pill-solid'
  | 'whisper-dashed'
  | 'inset-card'
  | 'gradient-ring'
  | 'highlight-wash'
  | 'closing-stamp'
  | 'tail-left'
  | 'tail-right'
  | 'nested-echo'
  | 'underline-minimal'
  | 'underline-accent'
  | 'border-card'
  | 'lavender-block'
  | 'watercolor-wash'
  | 'arc-diamond'

export type MoodHistoryQuoteBubbleVariantMeta = {
  id: MoodHistoryQuoteBubbleVariant
  label: string
  usage: string
}

export const MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS: MoodHistoryQuoteBubbleVariantMeta[] =
  [
    { id: 'border-card', label: '紫框白底', usage: '参考：愿你被世界温柔以待' },
    { id: 'pill-solid', label: '实心胶囊', usage: '参考：今天的你，也值得被爱' },
    { id: 'lavender-block', label: '淡紫居中', usage: '参考：愿你的每一天都有温暖' },
    { id: 'watercolor-wash', label: '水彩晕染', usage: '参考：心中有光，花会沿路盛开' },
    { id: 'arc-diamond', label: '弧框钤印', usage: '参考：一切都好，就很好' },
    { id: 'underline-accent', label: '底线强调', usage: '参考：每一次认真生活' },
    { id: 'editorial-wide', label: '文章通栏', usage: '长段落首块' },
    { id: 'soft-violet', label: '淡紫衬底', usage: '正文主阅读' },
    { id: 'highlight-wash', label: '高亮铺底', usage: '段内重点句' },
    { id: 'quote-bar', label: '引语竖线', usage: '摘录 / 金句' },
    { id: 'companion-tail', label: '陪伴尾泡', usage: '收束、灵伴口吻' },
    { id: 'closing-stamp', label: '收束钤印', usage: '日记结尾' },
    { id: 'pill-chip', label: '描边胶囊', usage: '极短一句' },
    { id: 'gradient-ring', label: '渐变描边', usage: '高光时刻' },
    { id: 'inset-card', label: '嵌套卡片', usage: '强调块' },
    { id: 'whisper-dashed', label: '虚线轻语', usage: '旁白、未写完' },
    { id: 'nested-echo', label: '双层回响', usage: '重复默念' },
    { id: 'tail-left', label: '尾在左下', usage: '灵伴左侧' },
    { id: 'tail-right', label: '尾在右下', usage: '回顾口吻' },
    { id: 'underline-minimal', label: '底线极简', usage: '克制装饰' },
  ]
