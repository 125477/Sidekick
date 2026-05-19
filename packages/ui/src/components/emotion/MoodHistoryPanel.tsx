import { useState } from 'react'
import type { MoodJournalEntry } from '../../state/moodJournalStorage'
import { moodEntryDisplayLabel } from './emotionChips'

type MoodHistoryPanelProps = {
  entries: MoodJournalEntry[]
  onDeleteEntry?: (id: string) => Promise<void>
}

function notePreview(note: string, maxLen = 72): string {
  const t = note.replace(/\s+/g, ' ').trim()
  if (!t) return '（无文字）'
  return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`
}

export function MoodHistoryPanel({
  entries,
  onDeleteEntry,
}: MoodHistoryPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    selectedId != null ? entries.find((e) => e.id === selectedId) ?? null : null

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

function MoodHistoryDetail({
  entry,
  onBack,
  onDelete,
}: {
  entry: MoodJournalEntry
  onBack: () => void
  onDelete?: () => Promise<void>
}) {
  const mood = moodEntryDisplayLabel(entry)
  const attachments = entry.attachments ?? []
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!onDelete || deleting) return
    const ok = window.confirm(
      `确定删除 ${entry.dayKey} 的心情小结吗？此操作不可恢复。`,
    )
    if (!ok) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex max-h-[min(420px,60vh)] flex-col overflow-y-auto p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="sk-emotion-chip-outline-btn"
          onClick={onBack}
          disabled={deleting}
        >
          返回列表
        </button>
        {onDelete ? (
          <button
            type="button"
            className="rounded-full border border-rose-200 px-3 py-1 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            {deleting ? '删除中…' : '删除这条记录'}
          </button>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="sk-emotion-chip sk-emotion-chip--active inline-flex px-3 py-0.5 text-sm">
            {mood}
          </span>
          <span className="text-base font-medium text-[color:var(--sk-text-body)] tabular-nums">
            {entry.dayKey}
          </span>
        </div>
        <section>
          <h4 className="sk-label mb-1 text-xs">日记</h4>
          {entry.note.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--sk-text-body)]">
              {entry.note}
            </p>
          ) : (
            <p className="sk-muted text-sm">（无文字）</p>
          )}
        </section>
        {attachments.length > 0 ? (
          <section>
            <h4 className="sk-label mb-2 text-xs">
              图片与视频
            </h4>
            <ul className="grid grid-cols-2 gap-2">
              {attachments.map((att) => (
                <li
                  key={att.id}
                  className="overflow-hidden rounded-lg border border-[color:var(--sk-card-border)] bg-[color:var(--sk-card-bg)]"
                >
                  {att.type === 'video' ? (
                    <video
                      src={att.dataUrl}
                      className="aspect-video w-full object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="aspect-square w-full object-cover"
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
