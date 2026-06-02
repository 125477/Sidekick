import {
  useLayoutEffect,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { ToastLightFeedbackRow } from './ToastLightFeedbackRow'
import { ToastInterestCaptureRow } from './ToastInterestCaptureRow'
import { EmotionToastToolbarIconButton } from './EmotionToastToolbarButton'
import {
  IconToolbarClose,
  IconToolbarEmotion,
  IconToolbarLockClosed,
  IconToolbarLockOpen,
  IconToolbarMenu,
  IconToolbarSettings,
  IconToolbarSkin,
  IconToolbarSpeaker,
  IconToolbarStar,
  IconToolbarStarFilled,
} from './EmotionToastToolbarIcons'
import { toastChromeRevealClass } from './toastChromeReveal'
import {
  toastBarGroupClass,
  toastMessageChromeClass,
  toastMessageInnerClass,
} from './toastMessageLayout'

const toastToolbarChromeClassName = () =>
  'sk-toast-toolbar flex w-full min-w-0 flex-col rounded-b-2xl'

const toastToolbarIconsRowClassName =
  'flex min-h-7 min-w-0 shrink-0 flex-nowrap items-center justify-center gap-0 px-0.5 py-1'

import { requestToastLayoutSync } from './toastLayoutSync'

export type EmotionToastUnlockedToolbarProps = {
  detached: boolean
  motionEnabled: boolean
  regenerating: boolean
  copyDone: boolean
  favorite: boolean
  maxChars?: number
  toastBarPinnedOpen: boolean
  unlockedToolbarHot: boolean
  toolbarMenuHoldOpen: boolean
  /** 已锁定：工具栏仅展示解锁按钮；轻反馈与悬停展开逻辑与未锁定一致。 */
  spriteInteractionLockedOnly?: boolean
  toastUnlockHitRef?: RefObject<HTMLDivElement | null>
  unlockedToastbarGroupRef: RefObject<HTMLDivElement | null>
  copyResetTimerRef: RefObject<number | null>
  setUnlockedToolbarHot: (v: boolean) => void
  setCopyDone: (v: boolean) => void
  regenInToolbar: boolean
  showCopy: boolean
  showExport: boolean
  showReplay: boolean
  showFavorite: boolean
  showEmotionFeedback: boolean
  showLockControl: boolean
  showSkin: boolean
  showSettings: boolean
  showSpriteMenu: boolean
  messageCell: ReactNode
  introActions?: ReactNode
  introMode?: boolean
  showLightFeedback?: boolean
  lightFeedbackMessage?: string
  compactMessageLayout?: boolean
  onCopy?: () => void | Promise<void>
  onExportCard?: () => void | Promise<void>
  onInterestAnswer?: (answer: string) => void | Promise<void>
  onReplayTts?: () => void | Promise<void>
  onToggleFavorite?: () => void | Promise<void>
  onOpenEmotion?: () => void | Promise<void>
  onOpenSkin?: () => void | Promise<void>
  onOpenSettings?: () => void | Promise<void>
  onOpenMenu?: () => void | Promise<void>
  onSpriteInteractionLockedChange?: (locked: boolean) => void
  onClose: () => void
  runRegenerate: () => Promise<void>
  runSimilar?: () => Promise<void>
  showSimilar?: boolean
}

export function EmotionToastUnlockedToolbar({
  detached,
  motionEnabled,
  regenerating,
  copyDone: _copyDone,
  favorite,
  maxChars: _maxChars,
  toastBarPinnedOpen,
  unlockedToolbarHot,
  toolbarMenuHoldOpen,
  spriteInteractionLockedOnly = false,
  toastUnlockHitRef,
  unlockedToastbarGroupRef,
  copyResetTimerRef: _copyResetTimerRef,
  setUnlockedToolbarHot,
  setCopyDone: _setCopyDone,
  regenInToolbar: _regenInToolbar,
  showCopy: _showCopy,
  showExport,
  showReplay,
  showFavorite,
  showEmotionFeedback,
  showLockControl,
  showSkin,
  showSettings,
  showSpriteMenu,
  messageCell,
  introActions,
  introMode = false,
  showLightFeedback = false,
  lightFeedbackMessage = '',
  compactMessageLayout = false,
  onExportCard,
  onInterestAnswer,
  onReplayTts,
  onToggleFavorite,
  onOpenEmotion,
  onOpenSkin,
  onOpenSettings,
  onOpenMenu,
  onSpriteInteractionLockedChange,
  onClose,
  runRegenerate: _runRegenerate,
  runSimilar: _runSimilar,
  showSimilar: _showSimilar = false,
}: EmotionToastUnlockedToolbarProps) {
  const chromeRevealed =
    introMode ||
    toolbarMenuHoldOpen ||
    unlockedToolbarHot ||
    (!detached && toastBarPinnedOpen)

  const lockedWidget = spriteInteractionLockedOnly && !detached
  const chromeRevealClass = (revealed: boolean) =>
    toastChromeRevealClass(detached, motionEnabled, revealed, 'toastbar', {
      lockedWidget,
    })

  useLayoutEffect(() => {
    if (!detached) return
    requestToastLayoutSync(
      chromeRevealed ? { measureExpanded: true } : undefined,
    )
  }, [detached, chromeRevealed])

  const revealToolbarHot = () => {
    if (detached) {
      requestToastLayoutSync({ measureExpanded: true })
    }
    setUnlockedToolbarHot(true)
  }

  const hideToolbarHot = (e: ReactPointerEvent) => {
    const t = e.relatedTarget
    if (t instanceof Node && unlockedToastbarGroupRef.current?.contains(t)) {
      return
    }
    setUnlockedToolbarHot(false)
  }

  return (
    <div
      ref={unlockedToastbarGroupRef}
      className={toastBarGroupClass(compactMessageLayout, 'group/toastbar')}
      onPointerEnter={revealToolbarHot}
      onPointerLeave={hideToolbarHot}
    >
      <div
        className={`sk-toast-message-panel transition-colors duration-200 ease-out motion-reduce:transition-none ${toastMessageChromeClass(
          compactMessageLayout,
          regenerating,
        )}`}
      >
        <div className={toastMessageInnerClass(compactMessageLayout)}>
          {messageCell}
        </div>
      </div>
      {introActions ? (
        <div className="relative z-[1] w-full">{introActions}</div>
      ) : null}
      {showLightFeedback && !regenerating && introMode ? (
        <div
          className={`emotion-toast-light-feedback relative z-[1] -mt-0.5 ${chromeRevealClass(
            chromeRevealed,
          )}`}
        >
          <div className="min-h-0 overflow-hidden">
            <ToastLightFeedbackRow
              message={lightFeedbackMessage}
              disabled={regenerating}
              centered={compactMessageLayout}
            />
          </div>
        </div>
      ) : null}
      {!introMode && !regenerating ? (
        <div
          className={`emotion-toast-chrome-below relative z-[1] w-full min-w-0 self-stretch ${chromeRevealClass(
            chromeRevealed,
          )}`}
        >
          <div className="min-h-0 overflow-hidden">
            {showLightFeedback ? (
              <div className="emotion-toast-light-feedback -mt-0.5">
                <ToastLightFeedbackRow
                  message={lightFeedbackMessage}
                  disabled={regenerating}
                  centered={compactMessageLayout}
                />
              </div>
            ) : null}
            {!introMode && onInterestAnswer ? (
              <div className="px-1 pb-1">
                <ToastInterestCaptureRow
                  disabled={regenerating}
                  onSubmit={(answer) => onInterestAnswer(answer)}
                />
              </div>
            ) : null}
            <div aria-hidden className="h-1.5 w-full shrink-0" />
            <div className="emotion-toast-toolbar -mt-1.5 overflow-hidden rounded-b-2xl">
              <div className={toastToolbarChromeClassName()}>
                <div className={toastToolbarIconsRowClassName}>
            {spriteInteractionLockedOnly ? (
              <div
                ref={toastUnlockHitRef}
                className="pointer-events-auto flex w-full justify-center"
              >
                <EmotionToastToolbarIconButton
                  title="解锁"
                  ariaLabel="解锁形象"
                  disabled={regenerating}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSpriteInteractionLockedChange?.(false)
                  }}
                >
                  <IconToolbarLockClosed className="h-[15px] w-[15px] shrink-0" />
                </EmotionToastToolbarIconButton>
              </div>
            ) : null}
            {/* 换一句：工具栏暂不展示（仍可点击正文换句）
            {!spriteInteractionLockedOnly && regenInToolbar ? (
              <EmotionToastToolbarIconButton
                title={
                  maxChars != null
                    ? `换一句（不超过 ${maxChars} 个字）`
                    : '换一句'
                }
                ariaLabel="换一句"
                disabled={regenerating}
                onClick={async (event) => {
                  event.stopPropagation()
                  await runRegenerate()
                }}
              >
                <IconToolbarRefresh className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            */}
            {/* 类似这句：工具栏暂不展示
            {!spriteInteractionLockedOnly && showSimilar && runSimilar ? (
              <EmotionToastToolbarIconButton
                title={
                  maxChars != null
                    ? `类似这句（不超过 ${maxChars} 个字）`
                    : '类似这句'
                }
                ariaLabel="类似这句"
                disabled={regenerating}
                onClick={async (event) => {
                  event.stopPropagation()
                  await runSimilar()
                }}
              >
                <span className="text-[11px] font-semibold leading-none">似</span>
              </EmotionToastToolbarIconButton>
            ) : null}
            */}
            {/* 复制已改为「导出卡片」
            {!spriteInteractionLockedOnly && showCopy ? (
              ...
            ) : null}
            */}
            {!spriteInteractionLockedOnly && showExport ? (
              <EmotionToastToolbarIconButton
                title="导出卡片"
                ariaLabel="导出陪伴卡片"
                disabled={regenerating}
                onClick={async (event) => {
                  event.stopPropagation()
                  if (regenerating) return
                  await Promise.resolve(onExportCard?.())
                }}
              >
                <span className="text-[10px] font-semibold leading-none">导出</span>
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showReplay ? (
              <EmotionToastToolbarIconButton
                title="再听一遍"
                ariaLabel="再听一遍"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onReplayTts?.())
                }}
              >
                <IconToolbarSpeaker className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showFavorite ? (
              <EmotionToastToolbarIconButton
                title={favorite ? '点击取消收藏' : '收藏'}
                ariaLabel={favorite ? '取消收藏' : '收藏'}
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onToggleFavorite?.())
                }}
              >
                {favorite ? (
                  <IconToolbarStarFilled className="h-[15px] w-[15px] shrink-0" />
                ) : (
                  <IconToolbarStar className="h-[15px] w-[15px] shrink-0" />
                )}
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showEmotionFeedback ? (
              <EmotionToastToolbarIconButton
                title="情绪反馈"
                ariaLabel="打开情绪反馈"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onOpenEmotion?.())
                }}
              >
                <IconToolbarEmotion className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showLockControl ? (
              <EmotionToastToolbarIconButton
                title="锁定"
                ariaLabel="锁定形象"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  onSpriteInteractionLockedChange?.(true)
                }}
              >
                <IconToolbarLockOpen className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showSkin ? (
              <EmotionToastToolbarIconButton
                title="更换形象"
                ariaLabel="打开更换形象"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onOpenSkin?.())
                }}
              >
                <IconToolbarSkin className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showSettings ? (
              <EmotionToastToolbarIconButton
                title="设置"
                ariaLabel="打开设置"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onOpenSettings?.())
                }}
              >
                <IconToolbarSettings className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly && showSpriteMenu ? (
              <EmotionToastToolbarIconButton
                title="菜单"
                ariaLabel="打开菜单"
                dataSpriteMenuTrigger
                spriteMenuDetachedAnchor
                domId="sk-toast-sprite-menu-anchor"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenMenu?.()
                }}
              >
                <IconToolbarMenu className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {!spriteInteractionLockedOnly ? (
              <EmotionToastToolbarIconButton
                title="关闭"
                ariaLabel="关闭气泡"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  onClose()
                }}
              >
                <IconToolbarClose className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
