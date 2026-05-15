import { useState } from 'react'

type JimengTabProps = {
  imageGenRemaining: number
  onGenerateSuccess: (generatedAvatarSrc: string) => void
  onShowToast: () => void
}

type GenerateState = 'idle' | 'loading' | 'success' | 'error' | 'quotaExhausted'

export function JimengTab({
  imageGenRemaining,
  onGenerateSuccess,
  onShowToast,
}: JimengTabProps) {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<GenerateState>('idle')

  const handleGenerate = () => {
    if (imageGenRemaining <= 0) {
      setState('quotaExhausted')
      return
    }
    setState('loading')
    window.setTimeout(() => {
      if (prompt.trim().length < 4) {
        setState('error')
        return
      }
      setState('success')
      onGenerateSuccess('./avatars/avatar-girl-2d.png')
      onShowToast()
    }, 600)
  }

  return (
    <div className="grid gap-3">
      <label className="text-sm font-medium text-slate-700" htmlFor="prompt">
        形象提示词
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="例如：Q版治愈系精灵，淡紫发，浅色背景"
        className="min-h-24 rounded-xl border border-slate-200 p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
      />
      <p className="text-xs text-slate-500">剩余文生图次数：{imageGenRemaining}</p>
      <button
        type="button"
        onClick={handleGenerate}
        className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:bg-slate-300"
      >
        生成
      </button>
      <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
        {state === 'idle' && '待生成'}
        {state === 'loading' && '生成中...'}
        {state === 'success' && '生成成功，可应用当前预览'}
        {state === 'error' && '生成失败：请补充更清晰的主体描述后重试'}
        {state === 'quotaExhausted' && '配额用尽：可切换到上传形象继续使用'}
      </p>
    </div>
  )
}
