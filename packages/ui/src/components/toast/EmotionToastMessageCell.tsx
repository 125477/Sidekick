type EmotionToastMessageCellProps = {
  message: string
  messageClickable: boolean
  regenerating: boolean
  toastPassthroughLocked: boolean
  maxChars?: number
  onRegenerateClick: () => void | Promise<void>
  multiline?: boolean
}

export function EmotionToastMessageCell({
  message,
  messageClickable,
  regenerating,
  toastPassthroughLocked,
  maxChars,
  onRegenerateClick,
  multiline = false,
}: EmotionToastMessageCellProps) {
  const textClass = `block min-w-0 max-w-full whitespace-normal break-words px-0.5 py-0.5 text-left ${
    multiline ? 'whitespace-pre-wrap leading-relaxed' : ''
  }`
  return (
    <div className="min-w-0 w-full max-w-full shrink rounded-md px-0.5 py-0.5 transition-colors motion-reduce:transition-none hover:bg-slate-100/80 focus-within:bg-slate-100/80">
      {messageClickable ? (
        <button
          type="button"
          disabled={regenerating || toastPassthroughLocked}
          onClick={async (event) => {
            event.stopPropagation()
            await onRegenerateClick()
          }}
          title={
            maxChars != null
              ? `点击换一句（不超过 ${maxChars} 个字）`
              : '点击换一句'
          }
          className={`${textClass} cursor-pointer rounded-md transition-colors outline-none focus-visible:outline-none disabled:cursor-wait disabled:opacity-90 [-webkit-app-region:no-drag]`}
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
