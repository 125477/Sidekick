import { useState } from 'react'
import type { MoodJournalEntry } from '../../../state/moodJournalStorage'
import type { QuoteBubbleDisplayMode } from './quoteBubbleSettings'
import { moodEntryDisplayLabel } from '../emotionChips'
import { MoodHistoryNoteBubbles } from './MoodHistoryNoteBubbles'
import {
  MOOD_MEDIA_TILE_CLASS,
  MoodMediaTileFrame,
  MoodMediaTileMedia,
} from '../moodMediaTile'
import {
  formatMoodHistoryDateLabel,
  moodHistoryDetailTitle,
} from './moodHistoryNoteLayout'

type MoodHistoryDetailProps = {
  entry: MoodJournalEntry
  quoteBubbleMode?: QuoteBubbleDisplayMode
  onBack: () => void
  onDelete?: () => Promise<void>
}

function IconChevronLeft() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12.5 15L7.5 10L12.5 5"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MoodHistoryDetail({
  entry,
  quoteBubbleMode = 'auto',
  onBack,
  onDelete,
}: MoodHistoryDetailProps) {
  const mood = moodEntryDisplayLabel(entry)
  const attachments = entry.attachments ?? []
  const [deleting, setDeleting] = useState(false)
  const dateLabel = formatMoodHistoryDateLabel(entry.dayKey, entry.createdAt)
  const headerTitle = moodHistoryDetailTitle(entry.note)

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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="sk-emotion-history-head sk-mood-history-head shrink-0">
        <div className="flex w-full min-w-0 items-start gap-0.5">
          <button
            type="button"
            className="sk-mood-history-back-btn mt-0.5"
            onClick={onBack}
            disabled={deleting}
            aria-label="返回列表"
          >
            <IconChevronLeft />
          </button>
          <div className="min-w-0 flex-1 px-0.5">
            <h3
              className="sk-emotion-heading mb-0 line-clamp-2 text-base leading-snug"
              title={headerTitle}
            >
              {headerTitle}
            </h3>
            <div className="sk-mood-history-meta mt-1.5">
              <span className="sk-mood-history-mood-tag">{mood}</span>
              <span
                className="sk-mood-history-meta-dot"
                aria-hidden
              >
                ·
              </span>
              <time
                className="text-xs leading-none text-[color:var(--sk-text-muted)] tabular-nums"
                dateTime={entry.createdAt}
              >
                {dateLabel}
              </time>
            </div>
          </div>
          {onDelete ? (
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-full border border-rose-200 px-3 py-1 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? '删除中…' : '删除'}
            </button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <article className="sk-mood-history-detail rounded-2xl border border-[color:var(--sk-content-border)] bg-[color:var(--sk-content-surface)] px-4 py-4 shadow-[var(--sk-frame-shadow)]">
          <section aria-labelledby="mood-history-note-heading">
            <h2 id="mood-history-note-heading" className="sr-only">
              日记正文
            </h2>
            <MoodHistoryNoteBubbles
              note={entry.note}
              quoteBubbleMode={quoteBubbleMode}
            />
          </section>

          {attachments.length > 0 ? (
            <section
              className="mt-4 border-t border-[color:var(--sk-heading-rule)] pt-4"
              aria-labelledby="mood-history-media-heading"
            >
              <h3
                id="mood-history-media-heading"
                className="sk-label mb-2 text-xs"
              >
                图片/视频
              </h3>
              <ul className="flex flex-wrap items-start gap-3">
                {attachments.map((att) => (
                  <li key={att.id} className={MOOD_MEDIA_TILE_CLASS}>
                    <MoodMediaTileFrame>
                      <MoodMediaTileMedia att={att} playback="controls" />
                    </MoodMediaTileFrame>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </div>
    </div>
  )
}
