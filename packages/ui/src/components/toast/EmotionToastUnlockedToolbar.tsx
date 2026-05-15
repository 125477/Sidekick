import type { ReactNode, RefObject } from 'react'
import { EmotionToastToolbarIconButton } from './EmotionToastToolbarButton'
import {
  IconToolbarClose,
  IconToolbarCopy,
  IconToolbarFavoritesHistory,
  IconToolbarLockOpen,
  IconToolbarMenu,
  IconToolbarRefresh,
  IconToolbarSettings,
  IconToolbarSkin,
  IconToolbarSpeaker,
  IconToolbarStar,
  IconToolbarStarFilled,
} from './EmotionToastToolbarIcons'

const toastToolbarChromeClassName = (detached: boolean) =>
  `flex w-full min-w-0 flex-col rounded-b-2xl border-t border-slate-200/70 ${
    detached ? 'bg-white' : 'bg-white/95'
  }`

const toastToolbarIconsRowClassName =
  'flex min-h-7 min-w-0 shrink-0 flex-nowrap items-center justify-center gap-0 px-0.5 py-1'

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
  unlockedToastbarGroupRef: RefObject<HTMLDivElement | null>
  copyResetTimerRef: RefObject<number | null>
  setUnlockedToolbarHot: (v: boolean) => void
  setLockedToolbarHot: (v: boolean) => void
  setLockedMsgHot: (v: boolean) => void
  setCopyDone: (v: boolean) => void
  regenInToolbar: boolean
  showCopy: boolean
  showReplay: boolean
  showFavorite: boolean
  showFavoritesRecord: boolean
  showLockControl: boolean
  showSkin: boolean
  showSettings: boolean
  showSpriteMenu: boolean
  messageCell: ReactNode
  onCopy?: () => void | Promise<void>
  onReplayTts?: () => void | Promise<void>
  onToggleFavorite?: () => void | Promise<void>
  onOpenFavorites?: () => void | Promise<void>
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
  unlockedToastbarGroupRef,
  copyResetTimerRef,
  setUnlockedToolbarHot,
  setLockedToolbarHot,
  setLockedMsgHot,
  setCopyDone,
  regenInToolbar,
  showCopy,
  showReplay,
  showFavorite,
  showFavoritesRecord,
  showLockControl,
  showSkin,
  showSettings,
  showSpriteMenu,
  messageCell,
  onCopy,
  onReplayTts,
  onToggleFavorite,
  onOpenFavorites,
  onOpenSkin,
  onOpenSettings,
  onOpenMenu,
  onSpriteInteractionLockedChange,
  onClose,
  runRegenerate,
}: EmotionToastUnlockedToolbarProps) {
  return (
    <div
      ref={unlockedToastbarGroupRef}
      className="group/toastbar flex w-full min-w-0 flex-col"
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
      <div className="w-fit max-w-full self-start rounded-lg bg-slate-50/55 transition-colors duration-200 ease-out motion-reduce:transition-none">
        <div className="flex w-full min-w-0 max-w-full flex-row items-center gap-0">
          {messageCell}
        </div>
      </div>
      <div aria-hidden className="h-1.5 w-full shrink-0" />
      <div
        className={`emotion-toast-toolbar relative z-[1] -mt-1.5 min-h-0 rounded-b-2xl transition-[max-height,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          motionEnabled ? 'duration-300' : 'duration-0'
        } ${
          toastBarPinnedOpen || unlockedToolbarHot || toolbarMenuHoldOpen
            ? 'pointer-events-auto max-h-[min(160px,50vh)] overflow-visible opacity-100'
            : 'pointer-events-none max-h-0 overflow-hidden opacity-0 group-hover/toastbar:pointer-events-auto group-hover/toastbar:max-h-[min(160px,50vh)] group-hover/toastbar:overflow-visible group-hover/toastbar:opacity-100 group-focus-within/toastbar:pointer-events-auto group-focus-within/toastbar:max-h-[min(160px,50vh)] group-focus-within/toastbar:overflow-visible group-focus-within/toastbar:opacity-100'
        }`}
      >
        <div className={toastToolbarChromeClassName(detached)}>
          <div className={toastToolbarIconsRowClassName}>
            {regenInToolbar ? (
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
            {showCopy ? (
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
            {showReplay ? (
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
            {showFavorite ? (
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
            {showFavoritesRecord ? (
              <EmotionToastToolbarIconButton
                title="收藏历史"
                ariaLabel="收藏历史"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onOpenFavorites?.())
                }}
              >
                <IconToolbarFavoritesHistory className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {showLockControl ? (
              <EmotionToastToolbarIconButton
                title="锁定"
                ariaLabel="锁定形象"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  setLockedToolbarHot(true)
                  setLockedMsgHot(false)
                  onSpriteInteractionLockedChange?.(true)
                }}
              >
                <IconToolbarLockOpen className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {showSkin ? (
              <EmotionToastToolbarIconButton
                title="换肤"
                ariaLabel="打开换肤"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  void Promise.resolve(onOpenSkin?.())
                }}
              >
                <IconToolbarSkin className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            ) : null}
            {showSettings ? (
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
            {showSpriteMenu ? (
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
          </div>
        </div>
      </div>
    </div>
  )
}
