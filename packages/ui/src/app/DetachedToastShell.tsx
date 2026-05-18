import { useEffect, useRef, type RefObject } from 'react'
import { EmotionToast } from '../components/toast/EmotionToast'
import { SpriteMenu, type MenuAction } from '../components/menu/SpriteMenu'
import {
  replayCompanionSpeech,
  speakCompanionLine,
} from '../utils/companionTts'
import { toggleTextFavorite } from '@sidekick/core'
import type { SidekickSettings } from '../state/settingsState'
import { saveAppSelfIntroShown } from '../state/appSelfIntroStorage'
import { broadcastAppSelfIntroDismissed } from '../state/appSelfIntroSync'
import { TOAST_CARD_MAX_CLASS_DETACHED } from '../components/toast/toastCardMetrics'
import { zLayers } from '../state/uiState'

type DetachedToastShellProps = {
  toastShellRef: RefObject<HTMLDivElement | null>
  toastDetachTailPointsDown: boolean
  toastDetachAnchor: 'top' | 'bottom'
  toastDetachBubblePlacement: 'above' | 'below'
  toastMessageFromQuery: string
  toastIntroFromQuery: boolean
  settings: SidekickSettings
  toastTextIdFromQuery: string | null
  toastDetachFavorite: boolean
  setToastDetachFavorite: (v: boolean) => void
  openEmotionFromToast: () => void
  openSettingsFromToast: () => void
  openSkinFromToast: () => void
  openSpriteMenuFromToastToolbar: () => void
  spriteInteractionLocked: boolean
  onSpriteInteractionLockedChange: (locked: boolean) => void
  menuOpen: boolean
  spriteMenuUsesBrowserPopup: boolean
  onMenuClose: () => void
  onMenuAction: (action: MenuAction) => void
  /** 从气泡工具栏发起的菜单会话中为 true，用于底栏保持展开（见 EmotionToast）。 */
  holdToastToolbarForMenu: boolean
}

export function DetachedToastShell({
  toastShellRef,
  toastDetachTailPointsDown,
  toastDetachAnchor,
  toastDetachBubblePlacement,
  toastMessageFromQuery,
  toastIntroFromQuery,
  settings,
  toastTextIdFromQuery,
  toastDetachFavorite,
  setToastDetachFavorite,
  openEmotionFromToast,
  openSettingsFromToast,
  openSkinFromToast,
  openSpriteMenuFromToastToolbar,
  spriteInteractionLocked,
  onSpriteInteractionLockedChange,
  menuOpen,
  spriteMenuUsesBrowserPopup,
  onMenuClose,
  onMenuAction,
  holdToastToolbarForMenu,
}: DetachedToastShellProps) {
  const introMode = toastIntroFromQuery
  const lastAutoTtsRef = useRef('')

  useEffect(() => {
    if (introMode || !settings.companionTtsEnabled) return
    const msg = toastMessageFromQuery.trim()
    if (!msg || msg === lastAutoTtsRef.current) return
    lastAutoTtsRef.current = msg
    void speakCompanionLine(msg, {
      enabled: true,
      model: settings.companionTtsModel,
      voice: settings.companionTtsVoice,
      speechRate: settings.companionTtsSpeechRate,
    })
  }, [
    introMode,
    toastMessageFromQuery,
    settings.companionTtsEnabled,
    settings.companionTtsModel,
    settings.companionTtsVoice,
    settings.companionTtsSpeechRate,
  ])

  const dismissIntro = () => {
    void saveAppSelfIntroShown()
    broadcastAppSelfIntroDismissed()
    void window.sidekickDesktop?.hideToastWindow?.()
  }

  return (
    <>
      <main className="relative block h-full min-h-0 w-full overflow-visible bg-transparent text-slate-800 select-none">
        <div
          ref={toastShellRef}
          className={`box-border flex w-full justify-center px-1 ${
            toastDetachTailPointsDown ? 'pb-2 pt-1.5' : 'pb-1.5 pt-2'
          }`}
        >
          <div className={`relative w-max max-w-full shrink-0 ${TOAST_CARD_MAX_CLASS_DETACHED}`}>
            <EmotionToast
              anchor={toastDetachAnchor}
              bubblePlacement={toastDetachBubblePlacement}
              tailPointsDown={toastDetachBubblePlacement === 'above'}
              visible={Boolean(toastMessageFromQuery)}
              detached
              motionEnabled={settings.motionEnabled}
              zIndexClass={zLayers.toast}
              dwellSeconds={0}
              message={toastMessageFromQuery}
              {...(introMode ? {} : { maxChars: settings.textMaxChars })}
              {...(introMode
                ? { messageRegeneratesOnClick: false }
                : {
                    onRegenerate: () => {
                      void window.sidekickDesktop?.requestRegenerateCopy?.()
                    },
                    keepRegenerateLoadingUntilUnmount: true,
                    messageRegeneratesOnClick: true,
                  })}
              linkedTextId={toastTextIdFromQuery}
              favorite={toastDetachFavorite}
              {...(toastTextIdFromQuery
                ? {
                    onToggleFavorite: () => {
                      void (async () => {
                        const data = await toggleTextFavorite(
                          toastTextIdFromQuery,
                        )
                        const row = data.texts.history.find(
                          (t) => t.id === toastTextIdFromQuery,
                        )
                        if (row) setToastDetachFavorite(row.favorite)
                      })()
                    },
                  }
                : {})}
              onCopy={() =>
                navigator.clipboard.writeText(toastMessageFromQuery)
              }
              onReplayTts={() =>
                void replayCompanionSpeech(toastMessageFromQuery, {
                  enabled: settings.companionTtsEnabled,
                  model: settings.companionTtsModel,
                  voice: settings.companionTtsVoice,
                  speechRate: settings.companionTtsSpeechRate,
                })
              }
              onOpenEmotion={openEmotionFromToast}
              onOpenSettings={openSettingsFromToast}
              onOpenSkin={openSkinFromToast}
              onOpenMenu={openSpriteMenuFromToastToolbar}
              spriteInteractionLocked={spriteInteractionLocked}
              onSpriteInteractionLockedChange={onSpriteInteractionLockedChange}
              showLightFeedback={!introMode}
              toastMode={introMode ? 'intro' : 'normal'}
              {...(introMode ? { onIntroDismiss: dismissIntro } : {})}
              onClose={() => {
                if (introMode) {
                  dismissIntro()
                  return
                }
                void window.sidekickDesktop?.hideToastWindow()
              }}
              holdToastToolbarForMenu={holdToastToolbarForMenu}
              toastToolbarInlineMenu={
                menuOpen &&
                !spriteMenuUsesBrowserPopup &&
                typeof window.sidekickDesktop?.openWidgetSpriteMenu !==
                  'function' ? (
                  <SpriteMenu
                    open={menuOpen}
                    widgetMode={false}
                    menuPositionClass="right-0 top-full mt-1.5"
                    zIndexClass={zLayers.menu}
                    onClose={onMenuClose}
                    onAction={onMenuAction}
                  />
                ) : null
              }
            />
          </div>
        </div>
      </main>
    </>
  )
}
