import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** 自定义形象上传：单文件体积上限（与读入 Data URL 的内存占用相关）。 */
const MAX_UPLOAD_FILE_BYTES = 30 * 1024 * 1024

type UploadTabProps = {
  onApply: (avatarSrc?: string) => void | Promise<void>
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as string)
    fr.onerror = () => reject(fr.error ?? new Error('read failed'))
    fr.readAsDataURL(file)
  })
}

function inferPreviewKind(file: File): 'video' | 'image' {
  const t = file.type.toLowerCase()
  if (t.startsWith('video/')) return 'video'
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video'
  return 'image'
}

function isAcceptedUploadFile(file: File): boolean {
  const t = file.type.toLowerCase()
  if (
    t === 'image/png' ||
    t === 'image/jpeg' ||
    t === 'image/webp' ||
    t === 'image/gif' ||
    t === 'video/mp4'
  ) {
    return true
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4'].includes(ext)
}

function isWithinUploadSizeLimit(file: File): boolean {
  return file.size <= MAX_UPLOAD_FILE_BYTES
}

function formatFileSizeMb(file: File): string {
  return (file.size / (1024 * 1024)).toFixed(1)
}

export function UploadTab({ onApply }: UploadTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingFileRef = useRef<File | null>(null)
  const [fileName, setFileName] = useState('未选择文件')
  const [fileSrc, setFileSrc] = useState<string>()
  /** `blob:` 预览无扩展名，需与 MIME 同步判断用 `<video>` 还是 `<img>`（GIF 走 `<img>` 以播放动画）。 */
  const [previewKind, setPreviewKind] = useState<'none' | 'video' | 'image'>('none')
  const [sizeRejectMessage, setSizeRejectMessage] = useState<string | null>(null)
  const warning = useMemo(
    () => '建议主体占画面 60% 以上，避免杂乱背景或大块纯色无主体。',
    [],
  )

  const fileSrcRef = useRef<string | undefined>(undefined)
  fileSrcRef.current = fileSrc

  const applySelectedFile = useCallback((file: File | null) => {
    pendingFileRef.current = file
    setSizeRejectMessage(null)
    setFileName(file?.name ?? '未选择文件')
    setPreviewKind(file ? inferPreviewKind(file) : 'none')
    setFileSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : undefined
    })
  }, [])

  useEffect(() => {
    return () => {
      if (fileSrcRef.current) URL.revokeObjectURL(fileSrcRef.current)
    }
  }, [])

  const showVideoPreview = Boolean(fileSrc) && previewKind === 'video'

  return (
    <div className="grid gap-3 pb-4">
      <label
        className="cursor-pointer rounded-xl border border-dashed border-[color:var(--sk-chip-off-border)] p-4 text-sm text-[color:var(--sk-text-secondary)] hover:border-[color:var(--sk-accent-border)] hover:bg-[color:var(--sk-accent-subtle-bg)]"
        onDragOver={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          const file = event.dataTransfer.files?.[0] ?? null
          if (!file || !isAcceptedUploadFile(file)) return
          if (!isWithinUploadSizeLimit(file)) {
            setSizeRejectMessage(
              `文件超过 30 MB 上限（当前约 ${formatFileSizeMb(file)} MB），请压缩后重试。`,
            )
            if (inputRef.current) inputRef.current.value = ''
            return
          }
          applySelectedFile(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,.gif,.mp4"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            if (!file) {
              applySelectedFile(null)
              return
            }
            if (!isAcceptedUploadFile(file)) {
              if (inputRef.current) inputRef.current.value = ''
              return
            }
            if (!isWithinUploadSizeLimit(file)) {
              setSizeRejectMessage(
                `文件超过 30 MB 上限（当前约 ${formatFileSizeMb(file)} MB），请压缩后重试。`,
              )
              if (inputRef.current) inputRef.current.value = ''
              return
            }
            applySelectedFile(file)
          }}
        />
        点击选择或拖拽 JPG / PNG / WebP / GIF / mp4，单文件不超过 30 MB
      </label>
      {sizeRejectMessage ? (
        <p className="text-xs font-medium text-rose-600" role="alert">
          {sizeRejectMessage}
        </p>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl bg-[color:var(--sk-card-bg)] p-3">
        {fileSrc ? (
          showVideoPreview ? (
            <video
              key={fileSrc}
              src={fileSrc}
              className="h-12 w-12 rounded-full object-cover"
              muted
              playsInline
              loop
              autoPlay
              aria-label="上传预览"
            />
          ) : (
            <img
              src={fileSrc}
              alt="上传预览"
              className="h-12 w-12 rounded-full object-cover"
            />
          )
        ) : (
          <div className="h-12 w-12 rounded-full bg-gradient-to-b from-sky-200 to-violet-200" />
        )}
        <div>
          <p className="text-sm font-medium text-[color:var(--sk-text-body)]">{fileName}</p>
          <p className="sk-muted text-xs">圆形预览区域（示意）</p>
        </div>
      </div>
      <p className="text-xs text-amber-700">{warning}</p>
      <button
        type="button"
        onClick={async () => {
          const file = pendingFileRef.current
          if (!file) return
          if (!isWithinUploadSizeLimit(file)) {
            setSizeRejectMessage(
              `文件超过 30 MB 上限（当前约 ${formatFileSizeMb(file)} MB），请压缩后重试。`,
            )
            return
          }
          let dataUrl: string
          try {
            dataUrl = await readFileAsDataUrl(file)
          } catch {
            return
          }
          try {
            await Promise.resolve(onApply(dataUrl))
          } catch {
            return
          }
          pendingFileRef.current = null
          setPreviewKind('none')
          const preview = fileSrcRef.current
          if (preview) URL.revokeObjectURL(preview)
          setFileSrc(undefined)
          setFileName('未选择文件')
          if (inputRef.current) inputRef.current.value = ''
        }}
        className="sk-btn-primary rounded-xl px-4 py-2 text-sm font-medium"
      >
        上传
      </button>
    </div>
  )
}
