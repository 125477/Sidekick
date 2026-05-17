import type { ReactNode, RefObject } from 'react'
import { EmotionToastToolbarIconButton } from './EmotionToastToolbarButton'
import { IconToolbarLockClosed } from './EmotionToastToolbarIcons'
import { ToastLightFeedbackRow } from './ToastLightFeedbackRow'

function toastHoverRevealClass(motionEnabled: boolean, revealed: boolean): string {
  return `grid min-h-0 overflow-hidden transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
    motionEnabled ? 'duration-200' : 'duration-0'
  } ${
    revealed
      ? 'grid-rows-[1fr] pointer-events-auto opacity-100'
      : 'grid-rows-[0fr] pointer-events-none opacity-0'
  }`
}

const toastToolbarChromeClassName = (detached: boolean) =>
  `flex w-full min-w-0 flex-col rounded-b-2xl border-t border-slate-200/70 ${
    detached ? 'bg-white' : 'bg-white/95'
  }`

const toastToolbarIconsRowClassName =
  'flex min-h-7 min-w-0 shrink-0 cursor-pointer flex-nowrap items-center justify-center gap-0 px-0.5 py-1'

export type EmotionToastLockedChromeProps = {
  detached: boolean
  motionEnabled: boolean
  regenerating: boolean
  lockedBarOpen: boolean
  messageCell: ReactNode
  showLightFeedback?: boolean
  lightFeedbackMessage?: string
  lockedMessageChromeRef: RefObject<HTMLDivElement | null>
  lockedToolbarRef: RefObject<HTMLDivElement | null>
  toastUnlockHitRef: RefObject<HTMLDivElement | null>
  setLockedMsgHot: (v: boolean) => void
  setLockedToolbarHot: (v: boolean) => void
  setUnlockedToolbarHot: (v: boolean) => void
  onSpriteInteractionLockedChange?: (locked: boolean) => void
}

export function EmotionToastLockedChrome({
  detached,
  motionEnabled,
  regenerating,
  lockedBarOpen,
  messageCell,
  showLightFeedback = false,
  lightFeedbackMessage = '',
  lockedMessageChromeRef,
  lockedToolbarRef,
  toastUnlockHitRef,
  setLockedMsgHot,
  setLockedToolbarHot,
  setUnlockedToolbarHot,
  onSpriteInteractionLockedChange,
}: EmotionToastLockedChromeProps) {
  return (
    <>
      <div
        ref={lockedMessageChromeRef}
        className="flex w-full min-w-0 flex-col"
        onPointerEnter={() => {
          setLockedMsgHot(true)
          setLockedToolbarHot(false)
        }}
        onPointerLeave={(e) => {
          const t = e.relatedTarget
          if (t instanceof Node && lockedToolbarRef.current?.contains(t)) {
            return
          }
          setLockedMsgHot(false)
        }}
      >
        <div
          className={`rounded-lg bg-slate-50/55 transition-colors duration-200 ease-out motion-reduce:transition-none ${
            regenerating ? 'w-full' : 'w-fit max-w-full self-start'
          }`}
        >
          <div className="flex w-full min-w-0 max-w-full flex-col">
            {messageCell}
          </div>
        </div>
        {showLightFeedback ? (
          <div
            className={`emotion-toast-light-feedback relative z-[1] -mt-0.5 ${toastHoverRevealClass(motionEnabled, lockedBarOpen)}`}
          >
            <div className="min-h-0 overflow-hidden">
              <ToastLightFeedbackRow
                message={lightFeedbackMessage}
                disabled={regenerating}
              />
            </div>
          </div>
        ) : null}
        <div aria-hidden className="h-1.5 w-full shrink-0" />
      </div>
      <div
        ref={lockedToolbarRef}
        className={`emotion-toast-toolbar relative z-[1] -mt-1.5 grid min-h-0 overflow-hidden rounded-b-2xl transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          motionEnabled ? 'duration-200' : 'duration-0'
        } ${
          lockedBarOpen
            ? 'grid-rows-[1fr] pointer-events-auto opacity-100'
            : 'grid-rows-[0fr] pointer-events-none opacity-0'
        }`}
        onPointerEnter={() => {
          setLockedToolbarHot(true)
          setLockedMsgHot(false)
        }}
        onPointerLeave={(e) => {
          const t = e.relatedTarget
          if (
            t instanceof Node &&
            lockedMessageChromeRef.current?.contains(t)
          ) {
            return
          }
          setLockedToolbarHot(false)
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className={toastToolbarChromeClassName(detached)}>
          <div className={toastToolbarIconsRowClassName}>
            <div ref={toastUnlockHitRef} className="pointer-events-auto">
              <EmotionToastToolbarIconButton
                title="解锁"
                ariaLabel="解锁形象"
                disabled={regenerating}
                onClick={(event) => {
                  event.stopPropagation()
                  setUnlockedToolbarHot(true)
                  onSpriteInteractionLockedChange?.(false)
                }}
              >
                <IconToolbarLockClosed className="h-[15px] w-[15px] shrink-0" />
              </EmotionToastToolbarIconButton>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}

export type EmotionToastLockedPassthroughSlopProps = {
  show: boolean
  lockedPassthroughSlopRef: RefObject<HTMLDivElement | null>
  lockedToolbarRef: RefObject<HTMLDivElement | null>
  lockedMessageChromeRef: RefObject<HTMLDivElement | null>
  setLockedToolbarHot: (v: boolean) => void
  setLockedMsgHot: (v: boolean) => void
}

export function EmotionToastLockedPassthroughSlop({
  show,
  lockedPassthroughSlopRef,
  lockedToolbarRef,
  lockedMessageChromeRef,
  setLockedToolbarHot,
  setLockedMsgHot,
}: EmotionToastLockedPassthroughSlopProps) {
  if (!show) return null
  return (
    <div
      ref={lockedPassthroughSlopRef}
      aria-hidden
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[5] h-11 rounded-b-2xl bg-transparent"
      onPointerEnter={() => {
        setLockedToolbarHot(true)
        setLockedMsgHot(false)
      }}
      onPointerLeave={(e) => {
        const t = e.relatedTarget
        if (t instanceof Node && lockedToolbarRef.current?.contains(t)) {
          return
        }
        if (t instanceof Node && lockedMessageChromeRef.current?.contains(t)) {
          return
        }
        setLockedToolbarHot(false)
      }}
    />
  )
}
