import { useEffect, useState, type ReactNode } from 'react'
import {
  loadPanelBackground,
  type PanelBackgroundMedia,
} from '../../state/panelBackgroundStorage'
import { subscribePanelBackgroundSync } from '../../state/panelBackgroundSync'

type PanelBackgroundLayerProps = {
  enabled: boolean
  overlayOpacity: number
  imageOpacity: number
  blurPx: number
  children: ReactNode
}

export function PanelBackgroundLayer({
  enabled,
  overlayOpacity,
  imageOpacity,
  blurPx,
  children,
}: PanelBackgroundLayerProps) {
  const [media, setMedia] = useState<PanelBackgroundMedia | null>(null)

  useEffect(() => {
    let cancelled = false
    const hydrate = () => {
      void loadPanelBackground().then((m) => {
        if (!cancelled) setMedia(m)
      })
    }
    hydrate()
    return subscribePanelBackgroundSync(hydrate)
  }, [])

  const show = enabled && media != null
  /** 仅当用户在设置里把「背景模糊」滑条 >0 时才模糊底图本身 */
  const mediaOpacity = Math.min(1, Math.max(0.2, imageOpacity))
  const blurStyle =
    blurPx > 0 ? { filter: `blur(${Math.min(12, blurPx)}px)` } : undefined
  const mediaStyle = {
    opacity: mediaOpacity,
    ...blurStyle,
  }
  /** 轻微压暗；勿叠太高以免发灰。可读性靠半透明卡片。 */
  const overlay = Math.min(0.35, Math.max(0, overlayOpacity * 0.35))

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {show ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          data-sk-panel-bg="on"
          aria-hidden
        >
          {media.type === 'video' ? (
            <video
              src={media.dataUrl}
              className="sk-panel-bg-media h-full w-full object-cover"
              style={mediaStyle}
              muted
              loop
              playsInline
              autoPlay
            />
          ) : (
            <img
              src={media.dataUrl}
              alt=""
              className="sk-panel-bg-media h-full w-full object-cover"
              style={mediaStyle}
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-white" style={{ opacity: overlay }} />
        </div>
      ) : null}
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
