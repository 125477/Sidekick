import type { Dispatch, SetStateAction, MutableRefObject, ReactNode } from 'react'
import type { AvatarPreset } from '@sidekick/core'
import { toggleTextFavorite } from '@sidekick/core'
import { SpriteMenu, type MenuAction } from '../components/menu/SpriteMenu'
import { SpriteShell } from '../components/sprite/SpriteShell'
import { EmotionToast } from '../components/toast/EmotionToast'
import { replayCompanionSpeech } from '../utils/companionTts'
import type { SidekickSettings } from '../state/settingsState'
import type { UiAction, UiState, SpriteState } from '../state/uiState'
import { zLayers } from '../state/uiState'
import { canPushNow } from './companionCopy'

export type HostAppMainProps = {
  panelContent: ReactNode
  spriteState: SpriteState
  setSpriteState: Dispatch<SetStateAction<SpriteState>>
  selectedAvatar: AvatarPreset | undefined
  settings: SidekickSettings
  spriteInteractionLocked: boolean
  menuOpen: boolean
  menuExpandedForToggle: boolean
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
  /** 浏览器弹窗菜单打开时隐藏内联 `SpriteMenu`，避免叠两套。 */
  spriteMenuUsesBrowserPopup: boolean
}

export function HostAppMain({
  panelContent,
  spriteState,
  setSpriteState,
  selectedAvatar,
  settings,
  spriteInteractionLocked,
  menuOpen,
  menuExpandedForToggle,
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
}: HostAppMainProps) {
  return (
    <>
      <main className="sk-panel-outer min-h-screen motion-reduce:transition-none">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-8">
          <section className="relative flex min-h-[420px] flex-1 items-end justify-between rounded-3xl border border-[color:var(--sk-hero-section-border)] bg-[color:var(--sk-hero-section-bg)] p-6 shadow-lg backdrop-blur">
            <div className="w-full max-w-xl">{panelContent}</div>

            <div className={`relative outline-none ${zLayers.sprite}`}>
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
                    avatarSize={settings.avatarSize}
                    avatarOpacity={settings.avatarOpacity}
                    interactionLocked={spriteInteractionLocked}
                    onToggleMenu={() => {
                      if (
                        menuOpen &&
                        settings.clickToFetchEnabled &&
                        canPushNow(settings)
                      ) {
                        void requestCompanionText('点击精灵互动')
                      }
                      if (!menuExpandedForToggle) {
                        setSpriteMenuSurface('sprite')
                      }
                      dispatch({
                        type: menuExpandedForToggle
                          ? 'MENU_CLOSE'
                          : 'MENU_OPEN',
                      })
                    }}
                    onStateChange={setSpriteState}
                  />
                </div>
                <SpriteMenu
                  open={
                    menuOpen &&
                    !spriteMenuUsesBrowserPopup &&
                    spriteMenuSurface === 'sprite'
                  }
                  /** 与点精灵一致：Electron 独立窗时锚在精灵列；纯浏览器弹菜单窗时也不走 toast-bubble 的 `right-full`。 */
                  widgetMode={false}
                  zIndexClass={zLayers.menu}
                  onClose={() => dispatch({ type: 'MENU_CLOSE' })}
                  onAction={handleMenuAction}
                />
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
                  toastToolbarInlineMenu={
                    menuOpen &&
                    !spriteMenuUsesBrowserPopup &&
                    spriteMenuSurface === 'toast-bubble' ? (
                      <SpriteMenu
                        open={menuOpen}
                        widgetMode={false}
                        menuPositionClass="right-full mr-2 top-full mt-1.5"
                        zIndexClass={zLayers.menu}
                        onClose={() => dispatch({ type: 'MENU_CLOSE' })}
                        onAction={handleMenuAction}
                      />
                    ) : null
                  }
                />
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
