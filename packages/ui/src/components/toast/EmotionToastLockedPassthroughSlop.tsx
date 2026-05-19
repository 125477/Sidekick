import type { RefObject } from 'react'

export type EmotionToastLockedPassthroughSlopProps = {
  show: boolean
  slopRef: RefObject<HTMLDivElement | null>
  toastbarGroupRef: RefObject<HTMLDivElement | null>
  setToolbarHot: (v: boolean) => void
}

/** 独立气泡锁定态：底部透明热区，与未锁定共用 `unlockedToolbarHot` 展开工具栏。 */
export function EmotionToastLockedPassthroughSlop({
  show,
  slopRef,
  toastbarGroupRef,
  setToolbarHot,
}: EmotionToastLockedPassthroughSlopProps) {
  if (!show) return null
  const Tag = 'div' as const
  return (
    <Tag
      ref={slopRef}
      aria-hidden
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[5] h-11 rounded-b-2xl bg-transparent"
      onPointerEnter={() => {
        setToolbarHot(true)
      }}
      onPointerLeave={(e) => {
        const t = e.relatedTarget
        if (t instanceof Node && toastbarGroupRef.current?.contains(t)) {
          return
        }
        setToolbarHot(false)
      }}
    />
  )
}
