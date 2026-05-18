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
}

// EmotionToastHoverTip 暂时关闭；文案区不显示悬停提示。

export function EmotionToastMessageCell({
  message,
  messageClickable,
  regenerating,
  toastPassthroughLocked,
  onRegenerateClick,
  multiline = false,
  compactLayout = false,
}: EmotionToastMessageCellProps) {
  const textClass = toastMessageTextClass(compactLayout, multiline)
  const tipDisabled = regenerating || toastPassthroughLocked

  return (
    <div className={toastMessageCellWrapClass(compactLayout)}>
      {messageClickable ? (
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
      )}
    </div>
  )
}
