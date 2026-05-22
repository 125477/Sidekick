import { useEffect, useState } from 'react'
import type { MoodJournalEntry } from '../../state/moodJournalStorage'
import type { QuoteBubbleDisplayMode } from './moodHistory/quoteBubbleSettings'
import { moodEntryDisplayLabel } from './emotionChips'
import { MoodHistoryDetail } from './moodHistory/MoodHistoryDetail'

type MoodHistoryPanelProps = {
  entries: MoodJournalEntry[]
  quoteBubbleMode?: QuoteBubbleDisplayMode
  onDeleteEntry?: (id: string) => Promise<void>
  /** 进入/离开详情时通知外层隐藏列表顶栏 */
  onDetailOpenChange?: (open: boolean) => void
}

function notePreview(note: string, maxLen = 72): string {
  const t = note.replace(/\s+/g, ' ').trim()
  if (!t) return '（无文字）'
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`
}

export function MoodHistoryPanel({
  entries,
  quoteBubbleMode = 'auto',
  onDeleteEntry,
  onDetailOpenChange,
}: MoodHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    selectedId != null ? entries.find((e) => e.id === selectedId) ?? null : null

  useEffect(() => {
    onDetailOpenChange?.(selectedId != null)
  }, [selectedId, onDetailOpenChange])

  if (entries.length === 0) {
    return (
      <div className="sk-muted p-4 text-sm">
        还没有历史记录。在「今日小结」里点「确定」保存第一条后，会出现在这里。
      </div>
    )
  }

  if (selected) {
    const detailProps = {
      entry: selected,
      quoteBubbleMode,
      onBack: () => setSelectedId(null),
      ...(onDeleteEntry
        ? {
            onDelete: async () => {
              await onDeleteEntry(selected.id)
              setSelectedId(null)
            },
          }
        : {}),
    }
    return <MoodHistoryDetail {...detailProps} />
  }

  return (
    <div className="flex max-h-[min(420px,60vh)] flex-col overflow-y-auto">
      <ul className="divide-y divide-[color:var(--sk-divider)]">
        {entries.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--sk-accent-subtle-bg)] focus-visible:bg-[color:var(--sk-accent-subtle-bg)] focus-visible:outline-none"
              onClick={() => setSelectedId(e.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="sk-emotion-chip sk-emotion-chip--active shrink-0 px-2 py-0.5 text-xs">
                  {moodEntryDisplayLabel(e)}
                </span>
                <span className="text-sm font-medium text-[color:var(--sk-text-body)] tabular-nums">
                  {e.dayKey}
                </span>
              </div>
              <p className="sk-muted line-clamp-2 text-xs leading-relaxed">
                {notePreview(e.note)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
