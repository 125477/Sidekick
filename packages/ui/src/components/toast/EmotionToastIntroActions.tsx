type EmotionToastIntroActionsProps = {
  disabled?: boolean
  onConfirm: () => void
}

export function EmotionToastIntroActions({
  disabled = false,
  onConfirm,
}: EmotionToastIntroActionsProps) {
  return (
    <div className="sk-toast-intro-divider flex w-full min-w-0 flex-wrap items-center justify-end gap-2 px-2 py-2 [-webkit-app-region:no-drag]">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
        }}
        className="sk-btn-primary cursor-pointer rounded-full px-4 py-1 text-xs font-medium shadow-sm"
      >
        知道了
      </button>
    </div>
  )
}
