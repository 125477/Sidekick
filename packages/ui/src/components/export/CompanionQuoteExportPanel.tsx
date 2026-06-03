import { useCallback, useEffect, useRef, useState } from 'react'
import { MoodHistoryQuoteBubble } from '../emotion/moodHistory/MoodHistoryQuoteBubble'
import { IconToolbarExport } from '../toast/EmotionToastToolbarIcons'
import {
  readCompanionExportBubbleVariant,
  saveCompanionExportBubbleVariant,
} from '../../app/companionExportBubblePreference'
import {
  MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS,
  type MoodHistoryQuoteBubbleVariant,
} from '../emotion/moodHistory/moodHistoryQuoteBubbleVariants'

export type CompanionQuoteExportPanelProps = {
  initialMessage: string
}

async function nodeToPng(node: HTMLElement, filename: string) {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: '#ffffff',
  })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function CompanionQuoteExportPanel({
  initialMessage,
}: CompanionQuoteExportPanelProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [bubbleVariant, setBubbleVariant] = useState<MoodHistoryQuoteBubbleVariant>(
    () => readCompanionExportBubbleVariant(),
  )
  const [message, setMessage] = useState(initialMessage)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setMessage(initialMessage)
  }, [initialMessage])

  const pickVariant = useCallback((variant: MoodHistoryQuoteBubbleVariant) => {
    setBubbleVariant(variant)
    saveCompanionExportBubbleVariant(variant)
  }, [])

  const onExport = useCallback(async () => {
    const el = previewRef.current
    if (!el || exporting) return
    setExporting(true)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await nodeToPng(el, `sidekick-quote-${stamp}.png`)
    } catch (e) {
      console.error('[sidekick] export card failed', e)
    } finally {
      setExporting(false)
    }
  }, [exporting])

  return (
    <main className="sk-panel-outer box-border flex h-full min-h-0 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
      <header className="mb-4 shrink-0 border-b border-[color:var(--sk-heading-rule)] pb-3">
        <h1 className="text-lg font-semibold text-[color:var(--sk-text-primary)]">
          导出陪伴卡片
        </h1>
        <p className="mt-1 text-sm text-[color:var(--sk-text-secondary)]">
          选择气泡样式并编辑文案，导出 PNG 图片。
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <label className="grid gap-1">
          <span className="sk-label">文案</span>
          <textarea
            value={message}
            rows={4}
            maxLength={200}
            className="sk-input min-h-[88px] resize-y text-sm"
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <div>
          <span className="sk-label mb-2 block">气泡样式</span>
          <div className="flex flex-wrap gap-2">
            {MOOD_HISTORY_QUOTE_BUBBLE_VARIANTS.map((meta) => (
              <button
                key={meta.id}
                type="button"
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  bubbleVariant === meta.id
                    ? 'border-violet-400 bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
                    : 'border-[color:var(--sk-divider)] text-[color:var(--sk-text-secondary)] hover:border-violet-300'
                }`}
                onClick={() => pickVariant(meta.id)}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--sk-divider)] bg-white p-6 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-[color:var(--sk-text-muted)]">预览</p>
            <button
              type="button"
              disabled={exporting || !message.trim()}
              className="sk-btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onExport()}
            >
              <IconToolbarExport className="h-3.5 w-3.5 shrink-0" />
              {exporting ? '导出中…' : '导出 PNG'}
            </button>
          </div>
          <div className="flex justify-center">
            <div ref={previewRef} className="inline-block max-w-md p-2">
              <MoodHistoryQuoteBubble variant={bubbleVariant}>
                {message.trim() || '在这里编辑你的陪伴短句…'}
              </MoodHistoryQuoteBubble>
              <p className="mt-3 text-right text-[10px] text-[color:var(--sk-text-muted)]">
                灵伴 Sidekick
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
