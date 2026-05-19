import type { ReactNode } from 'react'
import type { EmotionToastProps } from './emotionToastTypes'
import type { EmotionToastChrome } from './useEmotionToastChrome'
import { EmotionToastTail } from './EmotionToastTail'
import { EmotionToastMessageCell } from './EmotionToastMessageCell'
import { EmotionToastLockedPassthroughSlop } from './EmotionToastLockedPassthroughSlop'
import { EmotionToastUnlockedToolbar } from './EmotionToastUnlockedToolbar'
import { EmotionToastIntroActions } from './EmotionToastIntroActions'
import { ToastLightFeedbackRow } from './ToastLightFeedbackRow'
import {
  TOAST_CARD_MAX_CLASS,
  TOAST_CARD_MAX_CLASS_DETACHED,
  TOAST_CARD_MIN_CLASS,
} from './toastCardMetrics'
import {
  toastBarGroupClass,
  toastMessageChromeClass,
  toastMessageInnerClass,
} from './toastMessageLayout'

function EmotionToastSwitchingRow() {
  return (
    <div className="flex h-7 min-h-7 w-full items-center justify-center gap-2 px-0.5 py-0.5">
      <div
        className="h-4 w-4 shrink-0 rounded-full border-2 border-violet-400 border-t-transparent will-change-transform motion-safe:animate-spin motion-reduce:animate-pulse motion-reduce:border-t-violet-400"
        aria-hidden
      />
      <span className="whitespace-nowrap text-[13px] font-medium leading-none text-slate-500">
        切换中…
      </span>
      <span className="sr-only">正在换一句</span>
    </div>
  )
}

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
  onOpenEmotion,
  onOpenSettings,
  onOpenSkin,
  onOpenMenu,
  onSpriteInteractionLockedChange,
  onPointerEnteredToastChrome,
  toastToolbarInlineMenu,
  motionEnabled = true,
  showLightFeedback = false,
  toastMode = 'normal',
  onIntroDismiss,
  chrome,
}: EmotionToastCardProps) {
  const introMode = toastMode === 'intro'
  const messageCell = chrome.regenerating ? (
    <EmotionToastSwitchingRow />
  ) : (
    <EmotionToastMessageCell
      message={message}
      messageClickable={chrome.messageClickable}
      regenerating={false}
      toastPassthroughLocked={chrome.toastPassthroughLocked}
      multiline={introMode}
      compactLayout={chrome.compactMessageLayout}
      {...(maxChars !== undefined ? { maxChars } : {})}
      onRegenerateClick={chrome.runRegenerate}
    />
  )
  const introActions =
    introMode && onIntroDismiss ? (
      <EmotionToastIntroActions
        disabled={chrome.regenerating}
        onConfirm={() => onIntroDismiss()}
      />
    ) : null

  const plainMessageChrome: ReactNode = (
    <div
      className={`${toastBarGroupClass(chrome.compactMessageLayout, 'group/toastbar-plain')} rounded-lg bg-slate-50/55 transition-colors duration-200 ease-out motion-reduce:transition-none ${toastMessageChromeClass(
        chrome.compactMessageLayout,
        chrome.regenerating,
      )}`}
    >
      <div className={toastMessageInnerClass(chrome.compactMessageLayout)}>
        {messageCell}
      </div>
      {showLightFeedback && !chrome.regenerating ? (
        <div
          className={`grid min-h-0 overflow-hidden transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            motionEnabled ? 'duration-200' : 'duration-0'
          } grid-rows-[0fr] opacity-0 pointer-events-none group-hover/toastbar-plain:pointer-events-auto group-hover/toastbar-plain:grid-rows-[1fr] group-hover/toastbar-plain:opacity-100 group-focus-within/toastbar-plain:pointer-events-auto group-focus-within/toastbar-plain:grid-rows-[1fr] group-focus-within/toastbar-plain:opacity-100`}
        >
          <div className="min-h-0 overflow-hidden">
            <ToastLightFeedbackRow
              message={message}
              disabled={chrome.regenerating}
              centered={chrome.compactMessageLayout}
            />
          </div>
        </div>
      ) : null}
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
        className={`relative flex ${TOAST_CARD_MIN_CLASS} ${
          detached ? TOAST_CARD_MAX_CLASS_DETACHED : TOAST_CARD_MAX_CLASS
        } w-max items-start gap-2.5 rounded-2xl border px-2.5 py-1 text-[13px] leading-relaxed text-slate-600 [-webkit-app-region:no-drag] ${
          chrome.toastPassthroughLocked
            ? 'pointer-events-none'
            : 'pointer-events-auto'
        } ${
          detached
            ? 'border-slate-200 bg-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.10)]'
            : 'border-slate-200 bg-white shadow-[0_2px_10px_-3px_rgba(15,23,42,0.08)]'
        } ${chrome.motionClass}`}
      >
        <EmotionToastTail pointsDown={chrome.tailPointsDown} />

        <div className="emotion-toast-slot relative flex min-w-0 w-full max-w-full flex-col">
          {chrome.showToolbar ? (
            <div
              className="flex w-full min-w-0 flex-col"
              onPointerEnter={() => onPointerEnteredToastChrome?.()}
            >
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
                spriteInteractionLockedOnly={chrome.showLockedOnlyToolbar}
                toastUnlockHitRef={chrome.toastUnlockHitRef}
                unlockedToastbarGroupRef={chrome.unlockedToastbarGroupRef}
                copyResetTimerRef={chrome.copyResetTimerRef}
                setUnlockedToolbarHot={chrome.setUnlockedToolbarHot}
                setCopyDone={chrome.setCopyDone}
                regenInToolbar={chrome.regenInToolbar}
                showCopy={chrome.showCopy}
                showReplay={chrome.showReplay}
                showFavorite={chrome.showFavorite}
                showEmotionFeedback={chrome.showEmotionFeedback}
                showLockControl={chrome.showLockControl}
                showSkin={chrome.showSkin}
                showSettings={chrome.showSettings}
                showSpriteMenu={chrome.showSpriteMenu}
                messageCell={messageCell}
                introActions={introActions}
                introMode={introMode}
                showLightFeedback={
                  showLightFeedback && !introMode && !chrome.showLockedOnlyToolbar
                }
                lightFeedbackMessage={message}
                compactMessageLayout={chrome.compactMessageLayout}
                {...(onCopy ? { onCopy } : {})}
                {...(onReplayTts ? { onReplayTts } : {})}
                {...(onToggleFavorite ? { onToggleFavorite } : {})}
                {...(onOpenEmotion ? { onOpenEmotion } : {})}
                {...(onOpenSkin ? { onOpenSkin } : {})}
                {...(onOpenSettings ? { onOpenSettings } : {})}
                {...(onOpenMenu ? { onOpenMenu } : {})}
                {...(onSpriteInteractionLockedChange
                  ? { onSpriteInteractionLockedChange }
                  : {})}
                onClose={onClose}
                runRegenerate={chrome.runRegenerate}
              />
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
            !chrome.toolbarChromeRevealed
          }
          slopRef={chrome.lockedPassthroughSlopRef}
          toastbarGroupRef={chrome.unlockedToastbarGroupRef}
          setToolbarHot={chrome.setUnlockedToolbarHot}
        />

      </div>
    </div>
  )
}
