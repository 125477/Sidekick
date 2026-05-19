import { useLayoutEffect, type ReactNode, type RefObject } from 'react'
import { ToastLightFeedbackRow } from './ToastLightFeedbackRow'
import { EmotionToastToolbarIconButton } from './EmotionToastToolbarButton'
import {
  IconToolbarClose,
  IconToolbarCopy,
  IconToolbarEmotion,
  IconToolbarLockClosed,
  IconToolbarLockOpen,
  IconToolbarMenu,
  IconToolbarRefresh,
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

const toastToolbarChromeClassName = (detached: boolean) =>
  `flex w-full min-w-0 flex-col rounded-b-2xl border-t border-slate-200/70 ${
    detached ? 'bg-white' : 'bg-white/95'
  }`

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
  /** 已锁定：仅展示解锁按钮，悬停显隐与未锁定共用一套逻辑。 */
  spriteInteractionLockedOnly?: boolean
  toastUnlockHitRef?: RefObject<HTMLDivElement | null>
  unlockedToastbarGroupRef: RefObject<HTMLDivElement | null>
  copyResetTimerRef: RefObject<number | null>
  setUnlockedToolbarHot: (v: boolean) => void
  setCopyDone: (v: boolean) => void
  regenInToolbar: boolean
  showCopy: boolean
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
  onReplayTts?: () => void | Promise<void>
  onToggleFavorite?: () => void | Promise<void>
  onOpenEmotion?: () => void | Promise<void>
  onOpenSkin?: () => void | Promise<void>
  onOpenSettings?: () => void | Promise<void>
  onOpenMenu?: () => void | Promise<void>
  onSpriteInteractionLockedChange?: (locked: boolean) => void
  onClose: () => void
  runRegenerate: () => Promise<void>
}

export function EmotionToastUnlockedToolbar({
  detached,
  motionEnabled,
  regenerating,
  copyDone,
  favorite,
  maxChars,
  toastBarPinnedOpen,
  unlockedToolbarHot,
  toolbarMenuHoldOpen,
  spriteInteractionLockedOnly = false,
  toastUnlockHitRef,
  unlockedToastbarGroupRef,
  copyResetTimerRef,
  setUnlockedToolbarHot,
  setCopyDone,
  regenInToolbar,
  showCopy,
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
  onCopy,
  onReplayTts,
  onToggleFavorite,
  onOpenEmotion,
  onOpenSkin,
  onOpenSettings,
  onOpenMenu,
  onSpriteInteractionLockedChange,
  onClose,
  runRegenerate,
}: EmotionToastUnlockedToolbarProps) {
  const chromeRevealed =
    introMode ||
    toolbarMenuHoldOpen ||
    unlockedToolbarHot ||
    (!spriteInteractionLockedOnly && toastBarPinnedOpen)

  useLayoutEffect(() => {
    if (!detached) return
    requestToastLayoutSync(
      chromeRevealed ? { measureExpanded: true } : undefined,
    )
  }, [detached, chromeRevealed])

  return (
    <div
      ref={unlockedToastbarGroupRef}
      className={toastBarGroupClass(compactMessageLayout, 'group/toastbar')}
      onPointerEnter={() => {
        if (detached) {
          requestToastLayoutSync({ measureExpanded: true })
        }
        setUnlockedToolbarHot(true)
      }}
      onPointerLeave={(e) => {
        const t = e.relatedTarget
        if (
          t instanceof Node &&
          unlockedToastbarGroupRef.current?.contains(t)
        ) {
          return
        }
        setUnlockedToolbarHot(false)
      }}
    >
      <div
        className={`rounded-lg bg-slate-50/55 transition-colors duration-200 ease-out motion-reduce:transition-none ${toastMessageChromeClass(
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
          className={`emotion-toast-light-feedback relative z-[1] -mt-0.5 ${toastChromeRevealClass(
            detached,
            motionEnabled,
            chromeRevealed,
            'toastbar',
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
          className={`emotion-toast-chrome-below relative z-[1] ${toastChromeRevealClass(
            detached,
            motionEnabled,
            chromeRevealed,
            'toastbar',
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
            <div aria-hidden className="h-1.5 w-full shrink-0" />
            <div className="emotion-toast-toolbar -mt-1.5 overflow-hidden rounded-b-2xl">
              <div className={toastToolbarChromeClassName(detached)}>
                <div className={toastToolbarIconsRowClassName}>
            {spriteInteractionLockedOnly ? (
              <div ref={toastUnlockHitRef} className="pointer-events-auto">
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
            {!spriteInteractionLockedOnly && showCopy ? (
              <EmotionToastToolbarIconButton
                title={copyDone ? '已复制' : '复制'}
                ariaLabel={copyDone ? '已复制' : '复制'}
                disabled={regenerating}
                onClick={async (event) => {
                  event.stopPropagation()
                  if (regenerating) return
                  try {
                    await Promise.resolve(onCopy?.())
                    setCopyDone(true)
                    if (copyResetTimerRef.current != null) {
                      window.clearTimeout(copyResetTimerRef.current)
                    }
                    copyResetTimerRef.current = window.setTimeout(() => {
                      setCopyDone(false)
                      copyResetTimerRef.current = null
                    }, 2000)
                  } catch {
                    /* clipboard denied */
                  }
                }}
              >
                <IconToolbarCopy className="h-[15px] w-[15px] shrink-0" />
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
