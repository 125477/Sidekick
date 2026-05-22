import type { RefObject } from 'react'

export type EmotionToastLockedPassthroughSlopProps = {
  show: boolean
  slopRef: RefObject<HTMLDivElement | null>
}

/**
 * 独立气泡锁定且工具栏未展开时：仅用于主进程上报窄条可点击热区（点击穿透精灵）。
 * 悬停展开与收起由 `toastHitRoot` 的 pointer 事件统一处理（与未锁定一致）。
 */
export function EmotionToastLockedPassthroughSlop({
  show,
  slopRef,
}: EmotionToastLockedPassthroughSlopProps) {
  if (!show) return null
  return (
    <div
      ref={slopRef}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-11 rounded-b-2xl"
    />
  )
}
