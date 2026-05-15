import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { DEFAULT_PUSH_INTERVAL_MINUTES } from '../../state/settingsState'
import { parseBubblePlacementFromQuery } from '../../utils/toastPlacementFromQuery'
import type { EmotionToastProps } from './emotionToastTypes'

export type EmotionToastChrome = {
  regenerating: boolean
  setRegenerating: (v: boolean) => void
  copyDone: boolean
  setCopyDone: (v: boolean) => void
  regenerateBusyRef: RefObject<boolean>
  copyResetTimerRef: RefObject<number | null>
  toastUnlockHitRef: RefObject<HTMLDivElement | null>
  toastHitRootRef: RefObject<HTMLDivElement | null>
  lockedMessageChromeRef: RefObject<HTMLDivElement | null>
  lockedToolbarRef: RefObject<HTMLDivElement | null>
  lockedPassthroughSlopRef: RefObject<HTMLDivElement | null>
  unlockedToastbarGroupRef: RefObject<HTMLDivElement | null>
  setLockedMsgHot: (v: boolean) => void
  setLockedToolbarHot: (v: boolean) => void
  setUnlockedToolbarHot: (v: boolean) => void
  regenInToolbar: boolean
  messageClickable: boolean
  showCopy: boolean
  showFavorite: boolean
  showReplay: boolean
  showFavoritesRecord: boolean
  showSettings: boolean
  showSkin: boolean
  showSpriteMenu: boolean
  showLockControl: boolean
  showLockedOnlyToolbar: boolean
  showUnlockedToolbar: boolean
  showToolbar: boolean
  unlockedToolbarHot: boolean
  toolbarMenuHoldOpen: boolean
  toastPassthroughLocked: boolean
  toastBarPinnedOpen: boolean
  lockedBarOpen: boolean
  tailPointsDown: boolean
  positionClass: string
  toastOffsetStyle: CSSProperties | undefined
  motionClass: string
  runRegenerate: () => Promise<void>
}

export function useEmotionToastChrome({
  anchor,
  bubblePlacement,
  message,
  visible,
  detached = false,
  motionEnabled = true,
  dwellSeconds = DEFAULT_PUSH_INTERVAL_MINUTES * 60,
  onRegenerate,
  keepRegenerateLoadingUntilUnmount = false,
  onClose,
  linkedTextId,
  onCopy,
  messageRegeneratesOnClick = true,
  onReplayTts,
  onOpenFavorites,
  onOpenSettings,
  onOpenSkin,
  onOpenMenu,
  avatarSizePercent = 80,
  spriteInteractionLocked = false,
  onSpriteInteractionLockedChange,
  spriteHoverReveal = false,
  onToggleFavorite,
  toastToolbarInlineMenu,
  holdToastToolbarForMenu = false,
}: EmotionToastProps): EmotionToastChrome {
  const [regenerating, setRegenerating] = useState(false)
  const [copyDone, setCopyDone] = useState(false)
  const regenerateBusyRef = useRef(false)
  const copyResetTimerRef = useRef<number | null>(null)
  const toastUnlockHitRef = useRef<HTMLDivElement>(null)
  const toastHitRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCopyDone(false)
    if (copyResetTimerRef.current != null) {
      window.clearTimeout(copyResetTimerRef.current)
      copyResetTimerRef.current = null
    }
  }, [message, visible])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current)
        copyResetTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!keepRegenerateLoadingUntilUnmount || !regenerating) return
    const id = window.setTimeout(() => setRegenerating(false), 90_000)
    return () => window.clearTimeout(id)
  }, [keepRegenerateLoadingUntilUnmount, regenerating])

  useEffect(() => {
    if (!visible || dwellSeconds <= 0) return
    const id = window.setTimeout(onClose, dwellSeconds * 1000)
    return () => window.clearTimeout(id)
  }, [dwellSeconds, visible, onClose])

  const regenInToolbar = Boolean(
    onRegenerate && messageRegeneratesOnClick === false,
  )
  const messageClickable = Boolean(
    onRegenerate && messageRegeneratesOnClick !== false,
  )
  const showCopy = Boolean(onCopy && message.trim())
  const showFavorite = Boolean(linkedTextId && onToggleFavorite)
  const showReplay = Boolean(onReplayTts)
  const showFavoritesRecord = Boolean(onOpenFavorites)
  const showSettings = Boolean(onOpenSettings)
  const showSkin = Boolean(onOpenSkin)
  const showSpriteMenu = Boolean(onOpenMenu)
  const showLockControl = Boolean(onSpriteInteractionLockedChange)
  const hasToolbarActions =
    regenInToolbar ||
    showCopy ||
    showFavorite ||
    showReplay ||
    showFavoritesRecord ||
    showSkin ||
    showSettings ||
    showSpriteMenu ||
    showLockControl
  const showLockedOnlyToolbar = spriteInteractionLocked && showLockControl
  const showUnlockedToolbar = !spriteInteractionLocked && hasToolbarActions
  const showToolbar = showLockedOnlyToolbar || showUnlockedToolbar
  const toolbarMenuHoldOpen =
    Boolean(toastToolbarInlineMenu) || holdToastToolbarForMenu
  const toastPassthroughLocked =
    detached && spriteInteractionLocked && showLockControl
  const toastBarPinnedOpen = toastPassthroughLocked || spriteHoverReveal

  const [lockedMsgHot, setLockedMsgHot] = useState(false)
  const [lockedToolbarHot, setLockedToolbarHot] = useState(false)
  const [unlockedToolbarHot, setUnlockedToolbarHot] = useState(false)
  const [detachedEntranceConsumed, setDetachedEntranceConsumed] =
    useState(false)
  const lockedMessageChromeRef = useRef<HTMLDivElement>(null)
  const lockedToolbarRef = useRef<HTMLDivElement>(null)
  const lockedPassthroughSlopRef = useRef<HTMLDivElement>(null)
  const unlockedToastbarGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!(spriteInteractionLocked && showLockControl)) {
      setLockedMsgHot(false)
      setLockedToolbarHot(false)
    }
  }, [spriteInteractionLocked, showLockControl])

  useEffect(() => {
    if (!visible || spriteInteractionLocked) {
      setUnlockedToolbarHot(false)
    }
  }, [visible, spriteInteractionLocked])

  const lockedBarOpen =
    spriteHoverReveal || lockedMsgHot || lockedToolbarHot

  const placementSide: 'above' | 'below' =
    detached && bubblePlacement != null
      ? bubblePlacement
      : detached && typeof window !== 'undefined'
        ? parseBubblePlacementFromQuery(window.location.search)
        : anchor === 'top'
          ? 'above'
          : 'below'

  const tailPointsDown = detached ? placementSide === 'above' : anchor === 'top'
  const detachedSide: 'above' | 'below' | undefined = detached
    ? placementSide
    : undefined

  const layoutPrevRef = useRef<{
    anchor: typeof anchor
    tailDown: boolean
    message: string
    detachedSide: string
  } | null>(null)
  const suppressNextToastEntranceRef = useRef(false)

  const prevLayout = layoutPrevRef.current
  const layoutFlipOnly =
    visible &&
    prevLayout != null &&
    message === prevLayout.message &&
    (anchor !== prevLayout.anchor ||
      tailPointsDown !== prevLayout.tailDown ||
      (detachedSide ?? '') !== prevLayout.detachedSide)

  useLayoutEffect(() => {
    if (!visible) {
      layoutPrevRef.current = null
      suppressNextToastEntranceRef.current = false
      return
    }
    const prev = layoutPrevRef.current
    if (prev == null || message !== prev.message) {
      suppressNextToastEntranceRef.current = false
    }
    const flipped =
      prev != null &&
      message === prev.message &&
      (anchor !== prev.anchor ||
        tailPointsDown !== prev.tailDown ||
        (detachedSide ?? '') !== prev.detachedSide)
    if (flipped) {
      suppressNextToastEntranceRef.current = true
    }
    layoutPrevRef.current = {
      anchor,
      tailDown: tailPointsDown,
      message,
      detachedSide: detachedSide ?? '',
    }
  }, [visible, anchor, tailPointsDown, message, detachedSide])

  const detachedEntranceVisibleWasRef = useRef(false)
  const detachedEntranceMsgRef = useRef(message)

  useLayoutEffect(() => {
    if (!detached) return
    if (!visible) {
      setDetachedEntranceConsumed(false)
      detachedEntranceVisibleWasRef.current = false
      return
    }
    if (!detachedEntranceVisibleWasRef.current) {
      setDetachedEntranceConsumed(false)
    }
    detachedEntranceVisibleWasRef.current = true
    if (detachedEntranceMsgRef.current !== message) {
      detachedEntranceMsgRef.current = message
      setDetachedEntranceConsumed(false)
    }
  }, [detached, visible, message])

  useLayoutEffect(() => {
    if (!detached || !visible) return
    if (layoutFlipOnly || suppressNextToastEntranceRef.current) {
      setDetachedEntranceConsumed(true)
    }
  }, [detached, visible, layoutFlipOnly, message, anchor, tailPointsDown, detachedSide])

  useEffect(() => {
    if (!detached || !visible || detachedEntranceConsumed) return
    if (!motionEnabled || layoutFlipOnly) return
    if (suppressNextToastEntranceRef.current) {
      setDetachedEntranceConsumed(true)
      return
    }
    const id = window.setTimeout(() => {
      setDetachedEntranceConsumed(true)
    }, 300)
    return () => window.clearTimeout(id)
  }, [
    detached,
    visible,
    motionEnabled,
    layoutFlipOnly,
    message,
    detachedEntranceConsumed,
    detachedSide,
  ])

  useLayoutEffect(() => {
    const reportRect = window.sidekickDesktop?.reportToastPassthroughInteractRect
    if (!reportRect) return
    if (!visible || !toastPassthroughLocked) {
      reportRect(null)
      return
    }
    const report = () => {
      if (regenerating) {
        const root = toastHitRootRef.current
        if (!root) return
        const r = root.getBoundingClientRect()
        reportRect({
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        })
        return
      }
      if (!lockedBarOpen) {
        const slop = lockedPassthroughSlopRef.current
        if (slop) {
          const sr = slop.getBoundingClientRect()
          if (sr.width > 0 && sr.height > 0) {
            reportRect({
              left: sr.left,
              top: sr.top,
              width: sr.width,
              height: sr.height,
            })
            return
          }
        }
      }
      const el = toastUnlockHitRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      reportRect({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      })
    }
    report()
    const root = toastHitRootRef.current
    const ro = new ResizeObserver(() => {
      report()
    })
    if (root) ro.observe(root)
    const hit = toastUnlockHitRef.current
    if (hit) ro.observe(hit)
    const slop = lockedPassthroughSlopRef.current
    if (slop) ro.observe(slop)
    window.addEventListener('resize', report)
    const id = window.setInterval(report, 400)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', report)
      window.clearInterval(id)
      reportRect(null)
    }
  }, [
    visible,
    toastPassthroughLocked,
    message,
    regenerating,
    showToolbar,
    lockedBarOpen,
  ])

  const pct =
    typeof avatarSizePercent === 'number' &&
    Number.isFinite(avatarSizePercent) &&
    avatarSizePercent > 0
      ? avatarSizePercent
      : 80
  const spriteToastGapPx = 12 * (pct / 80)

  const positionClass = detached
    ? 'relative origin-center'
    : anchor === 'top'
      ? 'bottom-full origin-bottom'
      : 'top-full origin-top'

  const toastOffsetStyle: CSSProperties | undefined = detached
    ? undefined
    : anchor === 'top'
      ? { marginBottom: spriteToastGapPx }
      : { marginTop: spriteToastGapPx }

  const motionClass =
    motionEnabled &&
    !layoutFlipOnly &&
    !suppressNextToastEntranceRef.current &&
    (detached ? !detachedEntranceConsumed : true)
      ? detached
        ? detachedSide === 'above'
          ? 'animate-[toast-pop-up_280ms_cubic-bezier(0.22,1,0.36,1)]'
          : 'animate-[toast-pop-down_280ms_cubic-bezier(0.22,1,0.36,1)]'
        : anchor === 'top'
          ? 'animate-[toast-pop-up_280ms_cubic-bezier(0.22,1,0.36,1)]'
          : 'animate-[toast-pop-down_280ms_cubic-bezier(0.22,1,0.36,1)]'
      : ''

  const runRegenerate = async () => {
    if (regenerateBusyRef.current) return
    regenerateBusyRef.current = true
    setRegenerating(true)
    try {
      await Promise.resolve(onRegenerate?.())
    } finally {
      regenerateBusyRef.current = false
      if (!keepRegenerateLoadingUntilUnmount) {
        setRegenerating(false)
      }
    }
  }

  return {
    regenerating,
    setRegenerating,
    copyDone,
    setCopyDone,
    regenerateBusyRef,
    copyResetTimerRef,
    toastUnlockHitRef,
    toastHitRootRef,
    lockedMessageChromeRef,
    lockedToolbarRef,
    lockedPassthroughSlopRef,
    unlockedToastbarGroupRef,
    setLockedMsgHot,
    setLockedToolbarHot,
    setUnlockedToolbarHot,
    regenInToolbar,
    messageClickable,
    showCopy,
    showFavorite,
    showReplay,
    showFavoritesRecord,
    showSettings,
    showSkin,
    showSpriteMenu,
    showLockControl,
    showLockedOnlyToolbar,
    showUnlockedToolbar,
    showToolbar,
    toolbarMenuHoldOpen,
    unlockedToolbarHot,
    toastPassthroughLocked,
    toastBarPinnedOpen,
    lockedBarOpen,
    tailPointsDown,
    positionClass,
    toastOffsetStyle,
    motionClass,
    runRegenerate,
  }
}