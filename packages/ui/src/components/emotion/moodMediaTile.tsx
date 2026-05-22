import type { ReactNode } from 'react'
import type { MoodMediaAttachment } from '../../state/moodJournalStorage'

/** 与 `MoodSummaryMediaPicker` 预览格、「+」上传格同宽。 */
export const MOOD_MEDIA_TILE_CLASS =
  'relative min-w-0 w-[9.5rem] shrink-0 sm:w-[10.5rem]'

export function MoodMediaTileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--sk-callout-border)] p-1 sm:p-1.5">
      <div className="relative flex aspect-square w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg bg-[color:var(--sk-content-surface)]">
        {children}
      </div>
    </div>
  )
}

type MoodMediaTileMediaProps = {
  att: MoodMediaAttachment
  /** 上传预览：静音循环；历史详情：可播放控件 */
  playback?: 'preview' | 'controls'
}

export function MoodMediaTileMedia({
  att,
  playback = 'preview',
}: MoodMediaTileMediaProps) {
  const a11yLabel = att.type === 'video' ? '视频' : '图片'
  const mediaClass = 'max-h-full max-w-full rounded-lg object-contain'

  if (att.type === 'video') {
    return (
      <video
        src={att.dataUrl}
        className={mediaClass}
        controls={playback === 'controls'}
        muted={playback === 'preview'}
        playsInline
        loop={playback === 'preview'}
        preload="metadata"
        aria-label={a11yLabel}
      />
    )
  }

  return (
    <img src={att.dataUrl} alt={a11yLabel} className={mediaClass} />
  )
}
