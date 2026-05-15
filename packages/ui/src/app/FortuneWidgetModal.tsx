import { DailyFortunePanel } from '../components/fortune/DailyFortunePanel'

type FortuneWidgetModalProps = {
  open: boolean
  onClose: () => void
}

export function FortuneWidgetModal({ open, onClose }: FortuneWidgetModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 [-webkit-app-region:no-drag]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fortune-widget-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/40"
        aria-label="关闭抽签"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-[min(90vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[color:var(--sk-modal-elevated-border)] bg-[color:var(--sk-modal-elevated-bg)] shadow-xl">
        <div className="shrink-0 border-b border-slate-100 p-4 pb-3">
          <h2
            id="fortune-widget-title"
            className="text-base font-semibold text-slate-800"
          >
            每日抽签
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            悬浮窗内嵌视图（独立 panel 不可用时的备用入口）。
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pt-3">
          <DailyFortunePanel fillAvailable />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          完成
        </button>
      </div>
    </div>
  )
}
