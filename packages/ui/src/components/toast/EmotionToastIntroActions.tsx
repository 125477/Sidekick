type EmotionToastIntroActionsProps = {
  disabled?: boolean
  onConfirm: () => void
}

export function EmotionToastIntroActions({
  disabled = false,
  onConfirm,
}: EmotionToastIntroActionsProps) {
  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 px-2 py-2 [-webkit-app-region:no-drag]">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
        }}
        className="cursor-pointer rounded-full border border-violet-600 bg-violet-600 px-4 py-1 text-xs font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        知道了
      </button>
    </div>
  )
}
