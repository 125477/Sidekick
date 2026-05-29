import { useEffect, useRef, type RefObject } from 'react'
import { logCompanionRegenerate, stripCompanionLineCornerQuotes } from '@sidekick/core'
import { EmotionToast } from '../components/toast/EmotionToast'
import { SpriteMenu, type MenuAction } from '../components/menu/SpriteMenu'
import {
  replayCompanionSpeech,
  speakCompanionLine,
} from '../utils/companionTts'
import { buildShowToastWindowPayload } from '../utils/toastWindowPayload'
import { toggleToastFavorite } from './toastFavoriteToggle'
import { resolveCompanionQuoteBubbleVariant } from '../components/emotion/moodHistory/quoteBubbleSettings'
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
  /** 主进程 soft-sync 版本号，用于强制刷新气泡文案。 */
  toastContentRevision?: number
  toastIntroFromQuery: boolean
  /** 由精灵窗打开气泡时写入 URL（`autoTts=1`），优先于气泡窗内 settings。 */
  toastAutoTtsFromQuery: boolean
  settings: SidekickSettings
  settingsReady: boolean
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
  toastContentRevision = 0,
  toastIntroFromQuery,
  toastAutoTtsFromQuery,
  settings,
  settingsReady,
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
  const displayMessage = stripCompanionLineCornerQuotes(toastMessageFromQuery)
  const lastAutoTtsRef = useRef('')

  useEffect(() => {
    if (!settingsReady || introMode || !toastAutoTtsFromQuery) return
    const msg = displayMessage.trim()
    if (!msg || msg === lastAutoTtsRef.current) return
    lastAutoTtsRef.current = msg
    void speakCompanionLine(msg, {
      enabled: true,
      model: settings.companionTtsModel,
      voice: settings.companionTtsVoice,
      speechRate: settings.companionTtsSpeechRate,
    })
  }, [
    settingsReady,
    introMode,
    toastAutoTtsFromQuery,
    toastMessageFromQuery,
    displayMessage,
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
              key={`sk-emotion-toast-${toastContentRevision}-${toastMessageFromQuery.slice(0, 24)}`}
              anchor={toastDetachAnchor}
              bubblePlacement={toastDetachBubblePlacement}
              tailPointsDown={toastDetachBubblePlacement === 'above'}
              visible={Boolean(toastMessageFromQuery)}
              detached
              motionEnabled={settings.motionEnabled}
              zIndexClass={zLayers.toast}
              dwellSeconds={0}
              message={displayMessage}
              quoteBubbleVariant={
                introMode
                  ? 'companion-tail'
                  : resolveCompanionQuoteBubbleVariant(
                      settings.quoteBubbleVariant,
                    )
              }
              {...(introMode ? {} : { maxChars: settings.textMaxChars })}
              {...(introMode
                ? { messageRegeneratesOnClick: false }
                : {
                    onRegenerate: async () => {
                      const line = displayMessage
                      logCompanionRegenerate('toast click → IPC invoke', {
                        screenLine: line,
                        api: 'sidekick:toast-regenerate-request',
                      })
                      const ipcResult =
                        await window.sidekickDesktop?.requestRegenerateCopy?.(
                          line,
                        )
                      logCompanionRegenerate('toast IPC invoke settled', {
                        clickedLine: line,
                        displayedMessage:
                          typeof ipcResult?.message === 'string' &&
                          ipcResult.message.trim()
                            ? ipcResult.message.trim()
                            : '(见 content sync)',
                        ok: ipcResult?.ok,
                        reason: ipcResult?.reason,
                      })
                    },
                    onSimilar: () => {
                      void window.sidekickDesktop?.requestSimilarCopy?.()
                    },
                    messageRegeneratesOnClick: true,
                  })}
              linkedTextId={toastTextIdFromQuery}
              favorite={toastDetachFavorite}
              onToggleFavorite={() => {
                void (async () => {
                  const result = await toggleToastFavorite({
                    message: displayMessage,
                    textId: toastTextIdFromQuery,
                  })
                  if (!result) return
                  setToastDetachFavorite(result.favorite)
                  if (
                    result.id !== toastTextIdFromQuery &&
                    window.sidekickDesktop?.showToastWindow
                  ) {
                    await window.sidekickDesktop.showToastWindow(
                      buildShowToastWindowPayload(
                        settings,
                        {
                          message: displayMessage,
                          textId: result.id,
                          favorite: result.favorite,
                          anchor: toastDetachAnchor,
                          dwellSeconds: settings.toastAlwaysVisible
                            ? 0
                            : settings.dwellMinutes * 60,
                        },
                        { autoTts: false },
                      ),
                    )
                  }
                })()
              }}
              onCopy={() => navigator.clipboard.writeText(displayMessage)}
              onReplayTts={() =>
                void replayCompanionSpeech(displayMessage, {
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
