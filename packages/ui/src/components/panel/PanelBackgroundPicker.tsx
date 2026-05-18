import { useEffect, useRef, useState } from 'react'
import {
  MOOD_MEDIA_ACCEPT,
  fileToMoodAttachment,
} from '../../state/moodJournalMedia'
import {
  loadPanelBackground,
  savePanelBackground,
  type PanelBackgroundMedia,
} from '../../state/panelBackgroundStorage'
import { broadcastPanelBackgroundSync } from '../../state/panelBackgroundSync'

type PanelBackgroundPickerProps = {
  enabled: boolean
  onEnabledChange: (v: boolean) => void
  overlayOpacity: number
  onOverlayOpacityChange: (v: number) => void
  imageOpacity: number
  onImageOpacityChange: (v: number) => void
  blurPx: number
  onBlurPxChange: (v: number) => void
}

function moodToPanelMedia(att: {
  id: string
  type: 'image' | 'video'
  mimeType: string
  dataUrl: string
  name: string
}): PanelBackgroundMedia {
  return {
    id: att.id,
    type: att.type,
    mimeType: att.mimeType,
    dataUrl: att.dataUrl,
    name: att.name,
    updatedAt: new Date().toISOString(),
  }
}

export function PanelBackgroundPicker({
  enabled,
  onEnabledChange,
  overlayOpacity,
  onOverlayOpacityChange,
  imageOpacity,
  onImageOpacityChange,
  blurPx,
  onBlurPxChange,
}: PanelBackgroundPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [media, setMedia] = useState<PanelBackgroundMedia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadPanelBackground().then(setMedia)
  }, [])

  const pickFile = async (file: File) => {
    setError(null)
    setBusy(true)
    try {
      const att = await fileToMoodAttachment(file)
      const next = moodToPanelMedia(att)
      await savePanelBackground(next)
      setMedia(next)
      broadcastPanelBackgroundSync()
      onEnabledChange(true)
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'FILE_TOO_LARGE') {
        setError('文件不能超过 12MB')
      } else if (code === 'UNSUPPORTED_TYPE') {
        setError('仅支持 png / jpeg / webp / gif / mp4 / webm')
      } else {
        setError('上传失败，请重试')
      }
    } finally {
      setBusy(false)
    }
  }

  const removeMedia = async () => {
    setBusy(true)
    try {
      await savePanelBackground(null)
      setMedia(null)
      broadcastPanelBackgroundSync()
      onEnabledChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sk-settings-card sk-settings-card--titled">
      <h3 className="sk-settings-card-title">面板背景</h3>
      <div className="sk-settings-card-body grid gap-3">
      <p className="sk-muted text-xs leading-relaxed">
        设置、更换形象、情绪、抽签、收藏等辅窗共用同一张图或短视频背景（精灵与气泡窗不受影响）。
      </p>
      <div className={`sk-settings-row ${!media || busy ? 'opacity-50' : ''}`}>
        <span id="settings-panel-bg-enabled-lbl" className="sk-settings-row-label">
          启用自定义面板背景
        </span>
        <label htmlFor="settings-panel-bg-enabled" className="sk-switch">
          <input
            id="settings-panel-bg-enabled"
            type="checkbox"
            role="switch"
            className="sr-only"
            checked={enabled}
            disabled={!media || busy}
            onChange={(e) => onEnabledChange(e.target.checked)}
            aria-labelledby="settings-panel-bg-enabled-lbl"
          />
          <span aria-hidden className="sk-switch-track" />
          <span aria-hidden className="sk-switch-thumb" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={MOOD_MEDIA_ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void pickFile(f)
          }}
        />
        <button
          type="button"
          disabled={busy}
          className="sk-btn-primary"
          onClick={() => inputRef.current?.click()}
        >
          {media ? '更换背景' : '上传图片或视频'}
        </button>
        {media ? (
          <button
            type="button"
            disabled={busy}
            className="sk-btn-ghost"
            onClick={() => void removeMedia()}
          >
            删除背景
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
      {media ? (
        <div className="sk-panel-bg-preview-opaque mx-auto w-full max-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-900/90 p-2">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg">
            {media.type === 'video' ? (
              <video
                src={media.dataUrl}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: Math.min(1, Math.max(0.2, imageOpacity)),
                  ...(blurPx > 0
                    ? { filter: `blur(${Math.min(12, blurPx)}px)` }
                    : {}),
                }}
                muted
                playsInline
                loop
                autoPlay
              />
            ) : (
              <img
                src={media.dataUrl}
                alt={media.name}
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: Math.min(1, Math.max(0.2, imageOpacity)),
                  ...(blurPx > 0
                    ? { filter: `blur(${Math.min(12, blurPx)}px)` }
                    : {}),
                }}
              />
            )}
            <div
              className="pointer-events-none absolute inset-0 bg-white"
              style={{
                opacity: Math.min(0.35, Math.max(0, overlayOpacity * 0.35)),
              }}
              aria-hidden
            />
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{media.name}</p>
        </div>
      ) : null}
      <label className="grid gap-1">
        <span className="sk-label">背景透明度（数值越高底图越清晰）</span>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(imageOpacity * 100)}
          disabled={!enabled || !media}
          onChange={(e) =>
            onImageOpacityChange(Number(e.target.value) / 100)
          }
          className="w-full"
        />
      </label>
      <label className="grid gap-1">
        <span className="sk-label">底图压暗（数值越大图片越暗）</span>
        <input
          type="range"
          min={30}
          max={70}
          value={Math.round(overlayOpacity * 100)}
          disabled={!enabled || !media}
          onChange={(e) =>
            onOverlayOpacityChange(Number(e.target.value) / 100)
          }
          className="w-full"
        />
      </label>
      <label className="grid gap-1">
        <span className="sk-label">背景模糊（像素，0 为原图清晰）</span>
        <input
          type="range"
          min={0}
          max={12}
          value={blurPx}
          disabled={!enabled || !media}
          onChange={(e) => onBlurPxChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
      </div>
    </section>
  )
}
