import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import {
  type AvatarPreset,
  type EmotionKind,
  type EmotionRecord,
} from '@sidekick/core'
import { DEFAULT_AVATARS } from './assets/defaultAvatars'
import { OnboardingWizard } from './components/onboarding/OnboardingWizard'
import { WidgetSpriteMenuPage } from './components/menu/WidgetSpriteMenuPage'
import { defaultSettings, type SidekickSettings } from './state/settingsState'
import { initialUiState, uiReducer, type SpriteState } from './state/uiState'
import { openAuxPanelFromBridgeOrDispatch } from './app/openAuxPanelFromBridgeOrDispatch'
import { openEmotionPanel } from './app/openEmotionPanel'
import { useScheduledCompanionPush } from './app/useScheduledCompanionPush'
import { useDailyMoodReminder } from './app/useDailyMoodReminder'
import { useAppBootstrap } from './app/useAppBootstrap'
import { useAppModeShell } from './app/useAppModeShell'
import { useDetachedSpriteMenu } from './app/useDetachedSpriteMenu'
import { useAppMenuMachine } from './app/useAppMenuMachine'
import { useCompanionActions } from './app/useCompanionActions'
import { useAppSelfIntroBubble } from './app/useAppSelfIntroBubble'
import { useYesterdayEmotionGreeting } from './app/useYesterdayEmotionGreeting'
import { PanelBackgroundLayer } from './components/panel/PanelBackgroundLayer'
import { readAppSearchParams } from './app/readAppSearchParams'
import { AppPanelContent } from './app/AppPanelContent'
import { WidgetSpriteLayer } from './app/WidgetSpriteLayer'
import { DetachedToastShell } from './app/DetachedToastShell'
import { FortuneWidgetModal } from './app/FortuneWidgetModal'
import { HostAppMain } from './app/HostAppMain'
import { DragTrailOverlayPage } from './app/DragTrailOverlayPage'
import { CornerNotificationPage } from './app/CornerNotificationPage'
import type { MenuAction } from './components/menu/SpriteMenu'

function App() {
  const [uiState, dispatch] = useReducer(uiReducer, initialUiState)
  const [toastAnchorReplayNonce, setToastAnchorReplayNonce] = useState(0)
  const [settings, setSettings] = useState<SidekickSettings>(defaultSettings)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const skipPersistSettingsRef = useRef(false)
  const settingsPanelSliderSaveTimerRef = useRef<number | null>(null)
  const recentCompanionLinesRef = useRef<string[]>([])
  const companionBootstrapDoneRef = useRef(false)
  const pushCopyToastSuccessCountRef = useRef(0)
  const requestCompanionTextRef = useRef<
    ((keyword?: string, emotion?: EmotionKind) => Promise<void>) | undefined
  >(undefined)
  const toastShellRef = useRef<HTMLDivElement>(null)
  const widgetMeasureRef = useRef<HTMLDivElement>(null)
  const onboardingOpenSentRef = useRef(false)
  const moreRestoreToastTimerRef = useRef<number | null>(null)
  const blockScheduledPushRef = useRef(false)
  const lastShownToastMessageRef = useRef('')
  const handleMenuActionRef = useRef<(action: MenuAction) => void>(() => {})
  const [settingsReady, setSettingsReady] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)
  const [avatarHydrated, setAvatarHydrated] = useState(false)
  const [spriteInteractionLocked, setSpriteInteractionLocked] = useState(false)
  const [spriteShellHovered, setSpriteShellHovered] = useState(false)
  const skipAvatarPersist = useRef(false)
  const [avatars, setAvatars] = useState<AvatarPreset[]>(DEFAULT_AVATARS)
  const [selectedAvatarId, setSelectedAvatarId] = useState(
    DEFAULT_AVATARS[0]?.id ?? 'companion-lottie',
  )
  const selectedAvatarIdRef = useRef(selectedAvatarId)
  selectedAvatarIdRef.current = selectedAvatarId
  const avatarsRef = useRef(avatars)
  avatarsRef.current = avatars
  const [spriteState, setSpriteState] = useState<SpriteState>('idle')
  const [emotionRecords, setEmotionRecords] = useState<EmotionRecord[]>([])
  const [fortuneWidgetSheetOpen, setFortuneWidgetSheetOpen] = useState(false)
  const [toastMeta, setToastMeta] = useState<{
    id: string
    favorite: boolean
  } | null>(null)
  const [spriteMenuSurface, setSpriteMenuSurface] = useState<
    'sprite' | 'toast-bubble'
  >('sprite')
  const [spriteMenuUsesBrowserPopup, setSpriteMenuUsesBrowserPopup] =
    useState(false)
  const browserSpriteMenuWindowRef = useRef<Window | null>(null)

  const handleSpriteInteractionLockedChange = useCallback(
    (locked: boolean) => {
      setSpriteInteractionLocked(locked)
      if (locked) dispatch({ type: 'MENU_CLOSE' })
      void window.sidekickDesktop?.setSpriteInteractionLocked?.(locked)
    },
    [dispatch],
  )

  useEffect(() => {
    if (!spriteInteractionLocked) setSpriteShellHovered(false)
  }, [spriteInteractionLocked])

  const removeCustomAvatar = useCallback((id: string) => {
    const victim = avatarsRef.current.find((p) => p.id === id)
    if (victim?.src?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(victim.src)
      } catch {
        /* ignore */
      }
    }
    const next = avatarsRef.current.filter((p) => p.id !== id)
    setAvatars(next)
    if (selectedAvatarIdRef.current === id) {
      setSelectedAvatarId(
        next.find((p) => p.source === 'builtin')?.id ??
          next[0]?.id ??
          DEFAULT_AVATARS[0]?.id ??
          'companion-lottie',
      )
    }
  }, [])

  const advanceAvatarAfterPushCopy = useCallback(() => {
    if (!settingsRef.current.pushAutoSwitchAvatar) return
    const all = avatarsRef.current
    const ordered = [
      ...all.filter((p) => p.source === 'builtin'),
      ...all.filter((p) => p.source === 'upload' || p.source === 'generated'),
    ]
    if (ordered.length <= 1) return
    const cur = selectedAvatarIdRef.current
    const idx = ordered.findIndex((p) => p.id === cur)
    const base = idx >= 0 ? idx : 0
    const nextPreset = ordered[(base + 1) % ordered.length]
    if (!nextPreset) return
    setSelectedAvatarId(nextPreset.id)
  }, [])

  const panelTitle = useMemo(() => {
    if (uiState.activePanel === 'skin') return '更换形象'
    if (uiState.activePanel === 'settings') return '设置'
    if (uiState.activePanel === 'emotion') return '情绪反馈'
    if (uiState.activePanel === 'fortune') return '每日抽签'
    if (uiState.activePanel === 'favorites') return '收藏历史'
    return ''
  }, [uiState.activePanel])

  const openEmotionFromToast = useCallback(() => {
    openEmotionPanel(dispatch)
  }, [dispatch])

  const openSettingsFromToast = useCallback(() => {
    openAuxPanelFromBridgeOrDispatch('settings', dispatch)
  }, [dispatch])

  const openSkinFromToast = useCallback(() => {
    openAuxPanelFromBridgeOrDispatch('skin', dispatch)
  }, [dispatch])

  const {
    mode,
    panelFromQuery,
    toastMessageFromQuery,
    toastSearch,
    toastAnchorFromQuery,
    toastBubblePlacement,
    toastTextIdFromQuery,
    toastFavoriteFromUrl,
    toastIntroFromQuery,
    emotionTabFromQuery,
    cornerNotificationTitle,
    cornerNotificationMessage,
  } = readAppSearchParams()

  const [detachPlacementFromMain, setDetachPlacementFromMain] = useState<{
    anchor: 'top' | 'bottom'
    placement: 'above' | 'below'
  } | null>(null)
  const toastDetachAnchor = detachPlacementFromMain?.anchor ?? toastAnchorFromQuery
  const toastDetachBubblePlacement =
    detachPlacementFromMain?.placement ?? toastBubblePlacement
  const toastDetachTailPointsDown = toastDetachBubblePlacement === 'above'
  const isWidgetMode = mode === 'widget'
  const isPanelMode = mode === 'panel'
  const isToastMode = mode === 'toast'
  const isOnboardingMode = mode === 'onboarding'
  const isSpriteMenuMode = mode === 'sprite-menu'
  const isDragTrailMode = mode === 'drag-trail'
  const isCornerNotificationMode = mode === 'corner-notification'
  const themeSyncApplies =
    isPanelMode ||
    isOnboardingMode ||
    (!isWidgetMode &&
      !isToastMode &&
      !isSpriteMenuMode &&
      !isDragTrailMode)
  const runsScheduledPush = isWidgetMode || mode === 'app'
  const [toastDetachFavorite, setToastDetachFavorite] =
    useState(toastFavoriteFromUrl)
  const spriteAvatarSize = settings.avatarSize
  const menuOpen = uiState.menuState === 'opening' || uiState.menuState === 'open'
  const menuExpandedForToggle = uiState.menuState !== 'closed'
  const detachedWidgetSpriteMenu =
    isWidgetMode &&
    typeof window.sidekickDesktop?.openWidgetSpriteMenu === 'function'
  const toastVisible =
    uiState.toastState === 'entering' || uiState.toastState === 'visible'

  useAppBootstrap({
    recentCompanionLinesRef,
    dispatch,
    settings,
    settingsRef,
    settingsPanelSliderSaveTimerRef,
    skipPersistSettingsRef,
    skipAvatarPersist,
    avatars,
    selectedAvatarId,
    avatarHydrated,
    uiStateActivePanel: uiState.activePanel,
    setSettings,
    setOnboardingDone,
    setAvatars,
    setSelectedAvatarId,
    setEmotionRecords,
    setSettingsReady,
    setAvatarHydrated,
  })

  useAppModeShell({
    isWidgetMode,
    isToastMode,
    isPanelMode,
    isOnboardingMode,
    isDragTrailMode,
    themeSyncApplies,
    settings,
    settingsRef,
    settingsReady,
    uiState,
    panelTitle,
    onboardingDone,
    spriteAvatarSize,
    selectedAvatarId,
    selectedAvatar: avatars.find((item) => item.id === selectedAvatarId),
    spriteInteractionLocked,
    menuOpen,
    fortuneWidgetSheetOpen,
    toastMessageFromQuery,
    toastSearch,
    toastDetachTailPointsDown,
    spriteMenuSurface,
    toastShellRef,
    widgetMeasureRef,
    lastShownToastMessageRef,
    onboardingOpenSentRef,
    dispatch,
    setDetachPlacementFromMain,
    setToastDetachFavorite,
    setOnboardingDone,
    setSpriteInteractionLocked,
    setSpriteState,
  })

  const { openDetachedSpriteMenuSupported, openSpriteMenuFromToastToolbar } =
    useDetachedSpriteMenu({
      isToastMode,
      menuOpen,
      spriteMenuSurface,
      detachedWidgetSpriteMenu,
      uiState,
      handleMenuActionRef,
      dispatch,
      setSpriteMenuSurface,
      setSpriteMenuUsesBrowserPopup,
      browserSpriteMenuWindowRef,
    })

  useAppMenuMachine({
    isWidgetMode,
    isToastMode,
    isPanelMode,
    menuOpen,
    detachedWidgetSpriteMenu,
    openDetachedSpriteMenuSupported,
    panelFromQuery,
    emotionTabFromQuery,
    uiState,
    dispatch,
    setToastMeta,
    moreRestoreToastTimerRef,
  })

  useDailyMoodReminder(
    settings,
    settingsReady,
    isWidgetMode || isPanelMode,
    onboardingDone,
  )

  const {
    showToastMessage,
    hideEmotionToast,
    restartOnboarding,
    handleMenuAction,
    completeOnboarding,
    requestCompanionText,
  } = useCompanionActions({
    isWidgetMode,
    isPanelMode,
    isToastMode,
    isOnboardingMode,
    toastVisible,
    toastDetachAnchor,
    toastMessageFromQuery,
    uiState,
    dispatch,
    settingsRef,
    widgetMeasureRef,
    lastShownToastMessageRef,
    moreRestoreToastTimerRef,
    recentCompanionLinesRef,
    requestCompanionTextRef,
    onboardingOpenSentRef,
    avatars,
    setToastMeta,
    setSpriteState,
    setFortuneWidgetSheetOpen,
    setOnboardingDone,
    setSelectedAvatarId,
    setSettings,
    handleMenuActionRef,
  })

  useAppSelfIntroBubble({
    isWidgetMode,
    settingsReady,
    blockScheduledPushRef,
    widgetMeasureRef,
    showToastMessage,
  })

  useYesterdayEmotionGreeting({
    isWidgetMode,
    settingsReady,
    settingsRef,
    emotionRecords,
    blockScheduledPushRef,
    showToastMessage,
  })

  useScheduledCompanionPush({
    settings,
    settingsReady,
    settingsRef,
    onboardingDone,
    runsScheduledPush,
    isWidgetMode,
    dispatch,
    setToastMeta,
    setSpriteState,
    widgetMeasureRef,
    pushCopyToastSuccessCountRef,
    companionBootstrapDoneRef,
    recentCompanionLinesRef,
    advanceAvatarAfterPushCopy,
    blockScheduledPushRef,
  })

  const builtinAvatars = useMemo(
    () => avatars.filter((p) => p.source === 'builtin'),
    [avatars],
  )
  const customAvatars = useMemo(
    () => avatars.filter((p) => p.source === 'upload' || p.source === 'generated'),
    [avatars],
  )
  const selectedAvatar = useMemo(
    () => avatars.find((item) => item.id === selectedAvatarId),
    [avatars, selectedAvatarId],
  )

  const panelShellClass = isPanelMode
    ? 'flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6'
    : 'rounded-2xl border border-slate-200 bg-white p-4'

  const panelContent = (
    <AppPanelContent
      uiState={uiState}
      dispatch={dispatch}
      panelTitle={panelTitle}
      panelShellClass={panelShellClass}
      builtinAvatars={builtinAvatars}
      customAvatars={customAvatars}
      selectedAvatarId={selectedAvatarId}
      setSelectedAvatarId={setSelectedAvatarId}
      removeCustomAvatar={removeCustomAvatar}
      settings={settings}
      setSettings={setSettings}
      settingsRef={settingsRef}
      settingsPanelSliderSaveTimerRef={settingsPanelSliderSaveTimerRef}
      setToastAnchorReplayNonce={setToastAnchorReplayNonce}
      emotionRecords={emotionRecords}
      setEmotionRecords={setEmotionRecords}
      requestCompanionText={requestCompanionText}
      showToastMessage={showToastMessage}
      restartOnboarding={restartOnboarding}
      isPanelMode={isPanelMode}
      setAvatars={setAvatars}
    />
  )

  const spriteLayer = (
    <WidgetSpriteLayer
      widgetMeasureRef={isWidgetMode ? widgetMeasureRef : undefined}
      isWidgetMode={isWidgetMode}
      onboardingDone={onboardingDone}
      avatars={avatars}
      selectedAvatarId={selectedAvatarId}
      onSelectedAvatarIdChange={setSelectedAvatarId}
      textStyle={settings.textStyle}
      companionInterests={settings.companionInterests}
      completeOnboarding={completeOnboarding}
      spriteState={spriteState}
      setSpriteState={setSpriteState}
      selectedAvatar={selectedAvatar}
      spriteAvatarSize={spriteAvatarSize}
      settings={settings}
      spriteInteractionLocked={spriteInteractionLocked}
      menuOpen={menuOpen}
      menuExpandedForToggle={menuExpandedForToggle}
      detachedWidgetSpriteMenu={detachedWidgetSpriteMenu}
      spriteMenuSurface={spriteMenuSurface}
      setSpriteMenuSurface={setSpriteMenuSurface}
      setSpriteShellHovered={setSpriteShellHovered}
      requestCompanionText={requestCompanionText}
      dispatch={dispatch}
      handleMenuAction={handleMenuAction}
      toastAnchorReplayNonce={toastAnchorReplayNonce}
      toastVisible={toastVisible}
      uiState={uiState}
      toastMeta={toastMeta}
      setToastMeta={setToastMeta}
      hideEmotionToast={hideEmotionToast}
      openEmotionFromToast={openEmotionFromToast}
      openSettingsFromToast={openSettingsFromToast}
      openSkinFromToast={openSkinFromToast}
      openSpriteMenuFromToastToolbar={openSpriteMenuFromToastToolbar}
      handleSpriteInteractionLockedChange={handleSpriteInteractionLockedChange}
      spriteShellHovered={spriteShellHovered}
      settingsRef={settingsRef}
      spriteMenuUsesBrowserPopup={spriteMenuUsesBrowserPopup}
    />
  )

  if (isCornerNotificationMode) {
    return (
      <CornerNotificationPage
        title={cornerNotificationTitle}
        message={cornerNotificationMessage}
      />
    )
  }

  if (isToastMode) {
    return (
      <DetachedToastShell
        toastShellRef={toastShellRef}
        toastDetachTailPointsDown={toastDetachTailPointsDown}
        toastDetachAnchor={toastDetachAnchor}
        toastDetachBubblePlacement={toastDetachBubblePlacement}
        toastMessageFromQuery={toastMessageFromQuery}
        toastIntroFromQuery={toastIntroFromQuery}
        settings={settings}
        toastTextIdFromQuery={toastTextIdFromQuery}
        toastDetachFavorite={toastDetachFavorite}
        setToastDetachFavorite={setToastDetachFavorite}
        openEmotionFromToast={openEmotionFromToast}
        openSettingsFromToast={openSettingsFromToast}
        openSkinFromToast={openSkinFromToast}
        openSpriteMenuFromToastToolbar={openSpriteMenuFromToastToolbar}
        spriteInteractionLocked={spriteInteractionLocked}
        onSpriteInteractionLockedChange={handleSpriteInteractionLockedChange}
        menuOpen={menuOpen}
        spriteMenuUsesBrowserPopup={spriteMenuUsesBrowserPopup}
        onMenuClose={() => dispatch({ type: 'MENU_CLOSE' })}
        onMenuAction={handleMenuAction}
        holdToastToolbarForMenu={
          menuOpen && spriteMenuSurface === 'toast-bubble'
        }
      />
    )
  }

  if (isSpriteMenuMode) {
    return <WidgetSpriteMenuPage />
  }

  if (isDragTrailMode) {
    return <DragTrailOverlayPage />
  }

  if (isOnboardingMode) {
    if (!settingsReady || onboardingDone === null) {
      return (
        <main className="sk-panel-outer flex h-full min-h-0 w-full flex-1 items-center justify-center text-[var(--sk-text-muted)]">
          <p className="text-sm">加载中…</p>
        </main>
      )
    }
    return (
      <main className="sk-panel-outer box-border flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <PanelBackgroundLayer
          enabled={settings.panelBackgroundEnabled}
          overlayOpacity={settings.panelBackgroundOverlayOpacity}
          imageOpacity={settings.panelBackgroundImageOpacity}
          blurPx={settings.panelBackgroundBlurPx}
        >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <OnboardingWizard
            presets={avatars}
            selectedAvatarId={selectedAvatarId}
            onSelectedAvatarIdChange={setSelectedAvatarId}
            initialTextStyle={settings.textStyle}
            initialInterests={settings.companionInterests}
            onComplete={completeOnboarding}
          />
        </div>
        </PanelBackgroundLayer>
      </main>
    )
  }

  if (isWidgetMode) {
    return (
      <>
        <main className="relative h-full min-h-0 w-full overflow-visible bg-transparent text-slate-800 select-none outline-none pointer-events-none [-webkit-app-region:no-drag]">
          <div className="absolute inset-0 flex min-h-0 items-end justify-end overflow-visible pr-3 pb-2 pt-2 outline-none pointer-events-none [-webkit-app-region:no-drag]">
            {spriteLayer}
          </div>
        </main>
        <FortuneWidgetModal
          open={fortuneWidgetSheetOpen}
          onClose={() => setFortuneWidgetSheetOpen(false)}
        />
      </>
    )
  }

  const isHostAppShell =
    !isWidgetMode && !isToastMode && !isPanelMode && !isOnboardingMode

  if (isHostAppShell && onboardingDone === null) {
    return (
      <main className="sk-panel-outer flex min-h-screen items-center justify-center text-[var(--sk-text-muted)]">
        <p className="text-sm">加载中…</p>
      </main>
    )
  }

  if (isHostAppShell && onboardingDone === false) {
    return (
      <main className="sk-panel-outer min-h-screen motion-reduce:transition-none">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-10">
          <OnboardingWizard
            presets={avatars}
            selectedAvatarId={selectedAvatarId}
            onSelectedAvatarIdChange={setSelectedAvatarId}
            initialTextStyle={settings.textStyle}
            initialInterests={settings.companionInterests}
            onComplete={completeOnboarding}
          />
        </div>
      </main>
    )
  }

  if (isPanelMode) {
    return (
      <main className="sk-panel-outer relative box-border flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <PanelBackgroundLayer
          enabled={settings.panelBackgroundEnabled}
          overlayOpacity={settings.panelBackgroundOverlayOpacity}
          imageOpacity={settings.panelBackgroundImageOpacity}
          blurPx={settings.panelBackgroundBlurPx}
        >
          <div className="sk-panel-inner sk-panel-inner--electron box-border flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
            {panelContent}
          </div>
        </PanelBackgroundLayer>
      </main>
    )
  }

  return (
    <HostAppMain
      panelContent={panelContent}
      spriteState={spriteState}
      setSpriteState={setSpriteState}
      selectedAvatar={selectedAvatar}
      settings={settings}
      spriteInteractionLocked={spriteInteractionLocked}
      menuOpen={menuOpen}
      menuExpandedForToggle={menuExpandedForToggle}
      spriteMenuSurface={spriteMenuSurface}
      setSpriteMenuSurface={setSpriteMenuSurface}
      setSpriteShellHovered={setSpriteShellHovered}
      requestCompanionText={requestCompanionText}
      dispatch={dispatch}
      handleMenuAction={handleMenuAction}
      toastAnchorReplayNonce={toastAnchorReplayNonce}
      toastVisible={toastVisible}
      uiState={uiState}
      toastMeta={toastMeta}
      setToastMeta={setToastMeta}
      hideEmotionToast={hideEmotionToast}
      openEmotionFromToast={openEmotionFromToast}
      openSettingsFromToast={openSettingsFromToast}
      openSkinFromToast={openSkinFromToast}
      openSpriteMenuFromToastToolbar={openSpriteMenuFromToastToolbar}
      handleSpriteInteractionLockedChange={handleSpriteInteractionLockedChange}
      spriteShellHovered={spriteShellHovered}
      settingsRef={settingsRef}
      spriteMenuUsesBrowserPopup={spriteMenuUsesBrowserPopup}
    />
  )
}

export default App
