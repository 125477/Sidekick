import { MoodHistoryQuoteBubble } from './MoodHistoryQuoteBubble'
import { splitNoteIntoDisplayBlocks } from './moodHistoryNoteLayout'
import {
  resolveHistoryQuoteBubbleVariant,
  type QuoteBubbleDisplayMode,
} from './quoteBubbleSettings'

type MoodHistoryNoteBubblesProps = {
  note: string
  quoteBubbleMode?: QuoteBubbleDisplayMode
}

export function MoodHistoryNoteBubbles({
  note,
  quoteBubbleMode = 'auto',
}: MoodHistoryNoteBubblesProps) {
  const blocks = splitNoteIntoDisplayBlocks(note)

  if (blocks.length === 0) {
    return <p className="sk-muted text-sm">（无文字）</p>
  }

  return (
    <div className="flex flex-col gap-3" role="article" aria-label="日记正文">
      {blocks.map((block, index) => (
        <MoodHistoryQuoteBubble
          key={`${index}-${block.slice(0, 24)}`}
          variant={resolveHistoryQuoteBubbleVariant(
            quoteBubbleMode,
            index,
            blocks.length,
            block,
          )}
        >
          {block}
        </MoodHistoryQuoteBubble>
      ))}
    </div>
  )
}
