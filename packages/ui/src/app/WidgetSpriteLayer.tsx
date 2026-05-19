import type {
  RefObject,
  Dispatch,
  SetStateAction,
  MutableRefObject,
} from 'react'
import type {
  AvatarPreset,
  CompanionCopyStyle,
} from '@sidekick/core'
import { toggleTextFavorite } from '@sidekick/core'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'
import { SpriteMenu, type MenuAction } from '../components/menu/SpriteMenu'
import { SpriteShell } from '../components/sprite/SpriteShell'
import { EmotionToast } from '../components/toast/EmotionToast'
import {
  beginDesktopDragTrail,
  endDesktopDragTrail,
  pushDesktopDragTrailPoint,
} from '../utils/desktopDragTrail'
import { replayCompanionSpeech } from '../utils/companionTts'
import type { SidekickSettings } from '../state/settingsState'
import type { UiAction, UiState, SpriteState } from '../state/uiState'
import { zLayers } from '../state/uiState'

export type WidgetSpriteLayerProps = {
  widgetMeasureRef: RefObject<HTMLDivElement | null> | undefined
  isWidgetMode: boolean
  onboardingDone: boolean | null
  avatars: AvatarPreset[]
  selectedAvatarId: string
  onSelectedAvatarIdChange: (id: string) => void
  textStyle: CompanionCopyStyle
  companionInterests: string[]
  completeOnboarding: (payload: {
    selectedAvatarId: string
    textStyle: CompanionCopyStyle
    companionInterests: string[]
  }) => Promise<void>
  spriteState: SpriteState
  setSpriteState: Dispatch<SetStateAction<SpriteState>>
  selectedAvatar: AvatarPreset | undefined
  spriteAvatarSize: number
  settings: SidekickSettings
  spriteInteractionLocked: boolean
  menuOpen: boolean
  menuExpandedForToggle: boolean
  detachedWidgetSpriteMenu: boolean
  spriteMenuSurface: 'sprite' | 'toast-bubble'
  setSpriteMenuSurface: Dispatch<SetStateAction<'sprite' | 'toast-bubble'>>
  setSpriteShellHovered: (v: boolean) => void
  requestCompanionText: (keyword?: string) => Promise<void>
  dispatch: Dispatch<UiAction>
  handleMenuAction: (action: MenuAction) => void
  toastAnchorReplayNonce: number
  toastVisible: boolean
  uiState: UiState
  toastMeta: { id: string; favorite: boolean } | null
  setToastMeta: Dispatch<
    SetStateAction<{ id: string; favorite: boolean } | null>
  >
  hideEmotionToast: () => void
  openEmotionFromToast: () => void
  openSettingsFromToast: () => void
  openSkinFromToast: () => void
  openSpriteMenuFromToastToolbar: () => void
  handleSpriteInteractionLockedChange: (locked: boolean) => void
  spriteShellHovered: boolean
  settingsRef: MutableRefObject<SidekickSettings>
  spriteMenuUsesBrowserPopup: boolean
}

export function WidgetSpriteLayer({
  widgetMeasureRef,
  isWidgetMode,
  onboardingDone,
  avatars,
  selectedAvatarId,
  onSelectedAvatarIdChange,
  textStyle,
  companionInterests,
  completeOnboarding,
  spriteState,
  setSpriteState,
  selectedAvatar,
  spriteAvatarSize,
  settings,
  spriteInteractionLocked,
  menuOpen,
  menuExpandedForToggle,
  detachedWidgetSpriteMenu,
  spriteMenuSurface,
  setSpriteMenuSurface,
  setSpriteShellHovered,
  requestCompanionText,
  dispatch,
  handleMenuAction,
  toastAnchorReplayNonce,
  toastVisible,
  uiState,
  toastMeta,
  setToastMeta,
  hideEmotionToast,
  openEmotionFromToast,
  openSettingsFromToast,
  openSkinFromToast,
  openSpriteMenuFromToastToolbar,
  handleSpriteInteractionLockedChange,
  spriteShellHovered,
  settingsRef,
  spriteMenuUsesBrowserPopup,
}: WidgetSpriteLayerProps) {
  const dragStarTrailEnabled = isWidgetMode && settings.motionEnabled

  return (
    <div
      ref={widgetMeasureRef}
      className={`relative overflow-visible outline-none pointer-events-auto ${zLayers.sprite}`}
    >
      {isWidgetMode && onboardingDone === null ? (
        <div className="flex min-h-[144px] min-w-[160px] items-center justify-center text-xs text-slate-400 [-webkit-app-region:no-drag]">
          加载中…
        </div>
      ) : isWidgetMode &&
        onboardingDone === false &&
        !window.sidekickDesktop?.openOnboardingWindow ? (
        <div className="max-w-[min(96vw,580px)] [-webkit-app-region:no-drag]">
          <OnboardingWizard
            presets={avatars}
            selectedAvatarId={selectedAvatarId}
            onSelectedAvatarIdChange={onSelectedAvatarIdChange}
            initialTextStyle={textStyle}
            initialInterests={companionInterests}
            onComplete={completeOnboarding}
          />
        </div>
      ) : (
        <>
          <div className="relative inline-flex flex-col items-end overflow-visible">
            <div
              className="group/sprite-hover relative inline-block shrink-0 overflow-visible"
              onMouseEnter={() => setSpriteShellHovered(true)}
              onMouseLeave={() => setSpriteShellHovered(false)}
            >
              <SpriteShell
                spriteState={spriteState}
                avatarSrc={selectedAvatar?.src}
                motionProfile={selectedAvatar?.motionProfile}
                avatarSize={spriteAvatarSize}
                avatarOpacity={settings.avatarOpacity}
                interactionLocked={spriteInteractionLocked}
                {...(dragStarTrailEnabled
                  ? {
                      onDragTrailStart: (screenX: number, screenY: number) =>
                        beginDesktopDragTrail(screenX, screenY),
                      onDragTrailPoint: pushDesktopDragTrailPoint,
                      onDragTrailEnd: endDesktopDragTrail,
                    }
                  : {})}
                onToggleMenu={() => {
                  if (!menuExpandedForToggle) {
                    setSpriteMenuSurface('sprite')
                  }
                  dispatch({
                    type: menuExpandedForToggle ? 'MENU_CLOSE' : 'MENU_OPEN',
                  })
                }}
                onStateChange={setSpriteState}
              />
              {isWidgetMode && spriteInteractionLocked ? (
                <div
                  aria-hidden
                  className="pointer-events-auto absolute inset-0 z-[5] [-webkit-app-region:no-drag]"
                />
              ) : null}
            </div>
            {menuOpen &&
            (!isWidgetMode || !detachedWidgetSpriteMenu) &&
            !spriteMenuUsesBrowserPopup ? (
              <SpriteMenu
                open={menuOpen}
                widgetMode={
                  isWidgetMode || spriteMenuSurface === 'toast-bubble'
                }
                zIndexClass={zLayers.menu}
                onClose={() => dispatch({ type: 'MENU_CLOSE' })}
                onAction={handleMenuAction}
              />
            ) : null}
            {!isWidgetMode && (
              <EmotionToast
                key={`sk-emotion-toast-${toastAnchorReplayNonce}`}
                anchor={uiState.toastAnchor}
                visible={toastVisible}
                motionEnabled={settings.motionEnabled}
                zIndexClass={zLayers.toast}
                dwellSeconds={
                  settings.toastAlwaysVisible ? 0 : settings.dwellMinutes * 60
                }
                avatarSizePercent={settings.avatarSize}
                message={uiState.toastMessage}
                maxChars={settings.textMaxChars}
                onRegenerate={() => requestCompanionText('换一句')}
                showLightFeedback
                onClose={hideEmotionToast}
                linkedTextId={toastMeta?.id ?? null}
                favorite={toastMeta?.favorite ?? false}
                {...(toastMeta
                  ? {
                      onToggleFavorite: () => {
                        void (async () => {
                          const data = await toggleTextFavorite(toastMeta.id)
                          const row = data.texts.history.find(
                            (t) => t.id === toastMeta.id,
                          )
                          setToastMeta((prev) =>
                            prev && row
                              ? { id: row.id, favorite: row.favorite }
                              : prev,
                          )
                        })()
                      },
                    }
                  : {})}
                onCopy={() =>
                  navigator.clipboard.writeText(uiState.toastMessage)
                }
                onReplayTts={() =>
                  void replayCompanionSpeech(uiState.toastMessage, {
                    enabled: settingsRef.current.companionTtsEnabled,
                    model: settingsRef.current.companionTtsModel,
                    voice: settingsRef.current.companionTtsVoice,
                    speechRate: settingsRef.current.companionTtsSpeechRate,
                  })
                }
                onOpenEmotion={openEmotionFromToast}
                onOpenSettings={openSettingsFromToast}
                onOpenSkin={openSkinFromToast}
                onOpenMenu={openSpriteMenuFromToastToolbar}
                spriteInteractionLocked={spriteInteractionLocked}
                onSpriteInteractionLockedChange={
                  handleSpriteInteractionLockedChange
                }
                spriteHoverReveal={spriteShellHovered}
                onPointerEnteredToastChrome={() =>
                  setSpriteShellHovered(false)
                }
                holdToastToolbarForMenu={
                  menuOpen && spriteMenuSurface === 'toast-bubble'
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
