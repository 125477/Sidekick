import type { ReactNode } from 'react'
import type { MoodHistoryQuoteBubbleVariant } from '../emotion/moodHistory/moodHistoryQuoteBubbleVariants'

/** 卡片 `w-max` 随内容；独立窗 IPC 缩宽高，避免工具栏两侧留白。 */
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
  onSimilar?: () => void | Promise<void>
  keepRegenerateLoadingUntilUnmount?: boolean
  maxChars?: number
  onClose: () => void
  linkedTextId?: string | null
  favorite?: boolean
  onToggleFavorite?: () => void | Promise<void>
  onCopy?: () => void | Promise<void>
  onExportCard?: () => void | Promise<void>
  onInterestAnswer?: (answer: string) => void | Promise<void>
  messageRegeneratesOnClick?: boolean
  onReplayTts?: () => void | Promise<void>
  onOpenEmotion?: () => void | Promise<void>
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
  /** 文案下方轻反馈（喜欢 / 一般 / 少推），归纳后写入通义 system 提示。 */
  showLightFeedback?: boolean
  /** App 自我介绍：长文案 + 知道了，隐藏轻反馈。 */
  toastMode?: 'normal' | 'intro'
  onIntroDismiss?: () => void
  /** 设置 · 文案展示 · 气泡样式（非 companion-tail 时在气泡内套用对应样式） */
  quoteBubbleVariant?: MoodHistoryQuoteBubbleVariant
}
