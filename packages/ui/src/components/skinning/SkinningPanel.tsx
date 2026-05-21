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
        className="sk-segmented mb-4"
        role="tablist"
        onKeyDown={onKeyDown}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'jimeng'}
          className={`sk-segmented-btn cursor-pointer px-4 py-2 text-sm ${activeTab === 'jimeng' ? 'sk-segmented-btn-active' : ''}`}
          onClick={() => onTabChange('jimeng')}
        >
          AI生成
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upload'}
          className={`sk-segmented-btn cursor-pointer px-4 py-2 text-sm ${activeTab === 'upload' ? 'sk-segmented-btn-active' : ''}`}
          onClick={() => onTabChange('upload')}
        >
          上传形象
        </button>
      </div>
      {children}
    </section>
  )
}
