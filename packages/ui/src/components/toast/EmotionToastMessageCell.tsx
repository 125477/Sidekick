import { MoodHistoryQuoteBubble } from '../emotion/moodHistory/MoodHistoryQuoteBubble'
import type { MoodHistoryQuoteBubbleVariant } from '../emotion/moodHistory/moodHistoryQuoteBubbleVariants'
import { usesCompanionToastShell } from '../emotion/moodHistory/quoteBubbleSettings'
import {
  toastMessageCellWrapClass,
  toastMessageTextClass,
} from './toastMessageLayout'

type EmotionToastMessageCellProps = {
  message: string
  messageClickable: boolean
  regenerating: boolean
  toastPassthroughLocked: boolean
  maxChars?: number
  onRegenerateClick: () => void | Promise<void>
  multiline?: boolean
  compactLayout?: boolean
  quoteBubbleVariant?: MoodHistoryQuoteBubbleVariant
}

export function EmotionToastMessageCell({
  message,
  messageClickable,
  regenerating,
  toastPassthroughLocked,
  onRegenerateClick,
  multiline = false,
  compactLayout = false,
  quoteBubbleVariant = 'companion-tail',
}: EmotionToastMessageCellProps) {
  const textClass = toastMessageTextClass(compactLayout, multiline)
  const tipDisabled = regenerating || toastPassthroughLocked
  const useStyledBubble = !usesCompanionToastShell(quoteBubbleVariant)

  const plainContent = messageClickable ? (
    <button
      type="button"
      disabled={tipDisabled}
      onClick={async (event) => {
        event.stopPropagation()
        await onRegenerateClick()
      }}
      className={`${textClass} sk-toast-clickable rounded-md transition-colors outline-none focus-visible:outline-none disabled:cursor-wait disabled:opacity-90`}
    >
      {message}
    </button>
  ) : (
    <span
      className={`${textClass} ${
        toastPassthroughLocked ? 'pointer-events-none' : ''
      }`}
    >
      {message}
    </span>
  )

  const bubbleInner = messageClickable ? (
    <button
      type="button"
      disabled={tipDisabled}
      onClick={async (event) => {
        event.stopPropagation()
        await onRegenerateClick()
      }}
      className="sk-toast-clickable w-full text-left outline-none focus-visible:outline-none disabled:cursor-wait disabled:opacity-90"
    >
      <MoodHistoryQuoteBubble variant={quoteBubbleVariant}>
        {message}
      </MoodHistoryQuoteBubble>
    </button>
  ) : (
    <MoodHistoryQuoteBubble variant={quoteBubbleVariant}>
      {message}
    </MoodHistoryQuoteBubble>
  )

  return (
    <div className={toastMessageCellWrapClass(compactLayout)}>
      {useStyledBubble ? bubbleInner : plainContent}
    </div>
  )
}
