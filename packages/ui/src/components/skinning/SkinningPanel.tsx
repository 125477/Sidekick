import type { KeyboardEventHandler, ReactNode } from 'react'

type SkinningPanelProps = {
  activeTab: 'jimeng' | 'upload'
  onTabChange: (tab: 'jimeng' | 'upload') => void
  children: ReactNode
  /** 为 false 时隐藏「AI 生成」与 Tab 切换，仅渲染子内容（上传等）。 */
  showAiTab?: boolean
}

export function SkinningPanel({
  activeTab,
  onTabChange,
  children,
  showAiTab = true,
}: SkinningPanelProps) {
  if (!showAiTab) {
    return <section>{children}</section>
  }

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      onTabChange(activeTab === 'jimeng' ? 'upload' : 'jimeng')
    }
  }

  return (
    <section>
      <div
        className="mb-4 inline-flex rounded-xl bg-slate-100 p-1"
        role="tablist"
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'jimeng'}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm ${activeTab === 'jimeng' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => onTabChange('jimeng')}
        >
          AI生成
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upload'}
          className={`cursor-pointer rounded-lg px-4 py-2 text-sm ${activeTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          onClick={() => onTabChange('upload')}
        >
          上传形象
        </button>
      </div>
      {children}
    </section>
  )
}
