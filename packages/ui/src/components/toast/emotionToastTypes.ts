import type { ReactNode } from 'react'

/** 「关闭」列固定 `w-[42px]`…独立窗内卡片 `w-full` 占满；内嵌挂件仍 `w-max`。 */
export type EmotionToastProps = {
  anchor: 'top' | 'bottom'
  bubblePlacement?: 'above' | 'below'
  tailPointsDown?: boolean
  message: string
  visible: boolean
  detached?: boolean
  motionEnabled?: boolean
  zIndexClass?: string
  dwellSeconds?: number
  onRegenerate?: () => void | Promise<void>
  keepRegenerateLoadingUntilUnmount?: boolean
  maxChars?: number
  onClose: () => void
  linkedTextId?: string | null
  favorite?: boolean
  onToggleFavorite?: () => void | Promise<void>
  onCopy?: () => void | Promise<void>
  messageRegeneratesOnClick?: boolean
  onReplayTts?: () => void | Promise<void>
  onOpenFavorites?: () => void | Promise<void>
  onOpenSettings?: () => void | Promise<void>
  onOpenSkin?: () => void | Promise<void>
  onOpenMenu?: () => void | Promise<void>
  avatarSizePercent?: number
  spriteInteractionLocked?: boolean
  onSpriteInteractionLockedChange?: (locked: boolean) => void
  spriteHoverReveal?: boolean
  onPointerEnteredToastChrome?: () => void
  toastToolbarInlineMenu?: ReactNode
  holdToastToolbarForMenu?: boolean
}
