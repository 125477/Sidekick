import { MoodHistoryQuoteBubble } from './MoodHistoryQuoteBubble'
import {
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS,
  type MoodHistoryQuoteBubbleVariant,
} from './moodHistoryQuoteBubbleVariants'

const SAMPLE_LINES: Partial<Record<MoodHistoryQuoteBubbleVariant, string>> = {
  'border-card': '愿你被世界温柔以待，也愿你温柔以待自己。',
  'pill-solid': '今天的你，也值得被爱。',
  'lavender-block': '愿你的每一天，都有小小的温暖和稳稳的幸福。',
  'watercolor-wash': '心中有光，慢慢走，花会沿路盛开。',
  'arc-diamond': '一切都好，足够好，就很好。',
  'underline-accent': '每一次认真生活，都是在靠近自己想要的样子。',
  'companion-tail': '书页里的停顿，也该被允许存在。',
  'soft-violet':
    '今天开心的事就是没有难过的事，无论我身在何方，是否会有人记得我。',
  'editorial-wide':
    '今天开心的事就是没有难过的事，无论我身在何方，是否会有人记得我。写下来的时候，心里反而安静了一点。',
  'quote-bar': '晚一点也没关系，路还在。',
  'pill-chip': '今天就先到这儿，也很好。',
  'whisper-dashed': '（还没想好怎么写下去……）',
  'inset-card': '不必对自己那么严，你已经很不容易了。',
  'gradient-ring': '开心的时候，就让它多停一秒。',
  'highlight-wash': '你值得被温柔对待，也包括被自己温柔对待。',
  'closing-stamp': '今天就先到这儿，也很好。',
  'tail-left': '疲惫时，休息也是正经事。',
  'tail-right': '允许自己不那么完美。',
  'nested-echo': '平静也很好，不必非要热闹。',
  'underline-minimal': '今天能到这里，已经很不错了。',
}

/** 设计预览：`/?mode=mood-history-bubble-gallery` */
export function MoodHistoryQuoteBubbleGallery() {
  return (
    <main className="sk-panel-outer min-h-screen">
      <div className="sk-emotion-page mx-auto max-w-lg px-4 py-6">
        <header className="mb-6 border-b border-[color:var(--sk-heading-rule)] pb-4">
          <p className="sk-label mb-1 text-xs">设计预览</p>
          <h1 className="text-xl font-semibold leading-snug text-[color:var(--sk-text-primary)]">
            历史小结 · 文案气泡
          </h1>
          <p className="mt-2 text-sm text-[color:var(--sk-text-secondary)]">
            详情页已接入气泡展示；在应用中打开「情绪反馈 → 今日小结 → 历史记录」点一条即可查看。
          </p>
        </header>

        <ul className="flex flex-col gap-5">
          {MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS.map((meta, index) => (
            <li
              key={meta.id}
              className="rounded-xl border border-[color:var(--sk-divider)] bg-[color:var(--sk-card-bg)] p-4"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[color:var(--sk-accent-on-subtle)]">
                  {String(index + 1).padStart(2, '0')} · {meta.label}
                </span>
                <code className="text-[11px] text-[color:var(--sk-text-muted)]">
                  {meta.id}
                </code>
              </div>
              <p className="mb-3 text-xs text-[color:var(--sk-text-muted)]">
                {meta.usage}
              </p>
              <MoodHistoryQuoteBubble variant={meta.id}>
                {SAMPLE_LINES[meta.id] ?? '示例文案。'}
              </MoodHistoryQuoteBubble>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
