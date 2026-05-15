import type { ReactNode } from 'react'
import type { EmotionToastProps } from './emotionToastTypes'
import type { EmotionToastChrome } from './useEmotionToastChrome'
import { EmotionToastTail } from './EmotionToastTail'
import { EmotionToastMessageCell } from './EmotionToastMessageCell'
import {
  EmotionToastLockedChrome,
  EmotionToastLockedPassthroughSlop,
} from './EmotionToastLockedChrome'
import { EmotionToastUnlockedToolbar } from './EmotionToastUnlockedToolbar'

const TOAST_POP_KEYFRAMES = `
  @keyframes toast-pop-up {
    0% { opacity: 0; transform: translateY(10px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes toast-pop-down {
    0% { opacity: 0; transform: translateY(-10px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
`

export type EmotionToastCardProps = EmotionToastProps & {
  chrome: EmotionToastChrome
}

export function EmotionToastCard({
  message,
  detached = false,
  zIndexClass = 'z-30',
  maxChars,
  onClose,
  favorite = false,
  onToggleFavorite,
  onCopy,
  onReplayTts,
  onOpenFavorites,
  onOpenSettings,
  onOpenSkin,
  onOpenMenu,
  onSpriteInteractionLockedChange,
  onPointerEnteredToastChrome,
  toastToolbarInlineMenu,
  motionEnabled = true,
  chrome,
}: EmotionToastCardProps) {
  const messageCell = (
    <EmotionToastMessageCell
      message={message}
      messageClickable={chrome.messageClickable}
      regenerating={chrome.regenerating}
      toastPassthroughLocked={chrome.toastPassthroughLocked}
      {...(maxChars !== undefined ? { maxChars } : {})}
      onRegenerateClick={chrome.runRegenerate}
    />
  )

  const plainMessageChrome: ReactNode = (
    <div className="w-fit max-w-full self-start rounded-lg bg-slate-50/55 transition-colors duration-200 ease-out motion-reduce:transition-none">
      <div className="flex w-full min-w-0 max-w-full flex-row items-center gap-0">
        {messageCell}
      </div>
    </div>
  )

  return (
    <div
      className={`pointer-events-none ${detached ? '' : 'absolute left-1/2 -translate-x-1/2'} ${chrome.positionClass} ${zIndexClass}`}
      style={chrome.toastOffsetStyle}
    >
      <style>{TOAST_POP_KEYFRAMES}</style>
      <div
        ref={chrome.toastHitRootRef}
        data-emotion-toast-menu-fallback
        aria-busy={chrome.regenerating}
        className={`relative flex min-w-[228px] max-w-[min(355px,calc(100vw-32px))] items-start gap-2.5 rounded-2xl border px-2.5 py-1 text-[13px] leading-relaxed text-slate-600 [-webkit-app-region:no-drag] ${
          detached ? 'w-full' : 'w-max'
        } ${
          chrome.toastPassthroughLocked
            ? 'pointer-events-none'
            : 'pointer-events-auto'
        } ${
          detached
            ? 'border-slate-200 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]'
            : 'border-slate-200/90 bg-white/95 shadow-[0_12px_42px_-14px_rgba(15,23,42,0.22)] backdrop-blur-md'
        } ${chrome.motionClass}`}
      >
        <EmotionToastTail pointsDown={chrome.tailPointsDown} />

        <div className="emotion-toast-slot relative flex min-w-0 w-full max-w-full flex-col">
          {chrome.showToolbar ? (
            <div
              className="flex w-full min-w-0 flex-col"
              onPointerEnter={() => onPointerEnteredToastChrome?.()}
            >
              {chrome.showLockedOnlyToolbar ? (
                <EmotionToastLockedChrome
                  detached={detached}
                  motionEnabled={motionEnabled}
                  regenerating={chrome.regenerating}
                  lockedBarOpen={chrome.lockedBarOpen}
                  messageCell={messageCell}
                  lockedMessageChromeRef={chrome.lockedMessageChromeRef}
                  lockedToolbarRef={chrome.lockedToolbarRef}
                  toastUnlockHitRef={chrome.toastUnlockHitRef}
                  setLockedMsgHot={chrome.setLockedMsgHot}
                  setLockedToolbarHot={chrome.setLockedToolbarHot}
                  setUnlockedToolbarHot={chrome.setUnlockedToolbarHot}
                  {...(onSpriteInteractionLockedChange
                    ? { onSpriteInteractionLockedChange }
                    : {})}
                />
              ) : (
                <EmotionToastUnlockedToolbar
                  detached={detached}
                  motionEnabled={motionEnabled}
                  regenerating={chrome.regenerating}
                  copyDone={chrome.copyDone}
                  favorite={favorite}
                  {...(maxChars !== undefined ? { maxChars } : {})}
                  toastBarPinnedOpen={chrome.toastBarPinnedOpen}
                  unlockedToolbarHot={chrome.unlockedToolbarHot}
                  toolbarMenuHoldOpen={chrome.toolbarMenuHoldOpen}
                  unlockedToastbarGroupRef={chrome.unlockedToastbarGroupRef}
                  copyResetTimerRef={chrome.copyResetTimerRef}
                  setUnlockedToolbarHot={chrome.setUnlockedToolbarHot}
                  setLockedToolbarHot={chrome.setLockedToolbarHot}
                  setLockedMsgHot={chrome.setLockedMsgHot}
                  setCopyDone={chrome.setCopyDone}
                  regenInToolbar={chrome.regenInToolbar}
                  showCopy={chrome.showCopy}
                  showReplay={chrome.showReplay}
                  showFavorite={chrome.showFavorite}
                  showFavoritesRecord={chrome.showFavoritesRecord}
                  showLockControl={chrome.showLockControl}
                  showSkin={chrome.showSkin}
                  showSettings={chrome.showSettings}
                  showSpriteMenu={chrome.showSpriteMenu}
                  messageCell={messageCell}
                  {...(onCopy ? { onCopy } : {})}
                  {...(onReplayTts ? { onReplayTts } : {})}
                  {...(onToggleFavorite ? { onToggleFavorite } : {})}
                  {...(onOpenFavorites ? { onOpenFavorites } : {})}
                  {...(onOpenSkin ? { onOpenSkin } : {})}
                  {...(onOpenSettings ? { onOpenSettings } : {})}
                  {...(onOpenMenu ? { onOpenMenu } : {})}
                  {...(onSpriteInteractionLockedChange
                    ? { onSpriteInteractionLockedChange }
                    : {})}
                  onClose={onClose}
                  runRegenerate={chrome.runRegenerate}
                />
              )}
            </div>
          ) : (
            plainMessageChrome
          )}
          {toastToolbarInlineMenu}
        </div>

        <EmotionToastLockedPassthroughSlop
          show={
            chrome.toastPassthroughLocked &&
            chrome.showLockedOnlyToolbar &&
            !chrome.lockedBarOpen
          }
          lockedPassthroughSlopRef={chrome.lockedPassthroughSlopRef}
          lockedToolbarRef={chrome.lockedToolbarRef}
          lockedMessageChromeRef={chrome.lockedMessageChromeRef}
          setLockedToolbarHot={chrome.setLockedToolbarHot}
          setLockedMsgHot={chrome.setLockedMsgHot}
        />

        {chrome.regenerating ? (
          <div
            className="pointer-events-auto absolute inset-0 z-30 isolate flex items-center justify-center rounded-2xl bg-white/75"
            aria-live="polite"
          >
            <div className="flex flex-row items-center gap-2">
              <div
                className="h-6 w-6 shrink-0 rounded-full border-2 border-violet-400 border-t-transparent will-change-transform motion-safe:animate-spin motion-reduce:animate-pulse motion-reduce:border-t-violet-400"
                aria-hidden
              />
              <span className="text-[11px] font-medium text-slate-500">
                切换中…
              </span>
            </div>
            <span className="sr-only">正在换一句</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
