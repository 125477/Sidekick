import type { RefObject } from 'react'
import { EmotionToast } from '../components/toast/EmotionToast'
import { SpriteMenu, type MenuAction } from '../components/menu/SpriteMenu'
import { speakCompanionLine } from '../utils/companionTts'
import { toggleTextFavorite } from '@sidekick/core'
import type { SidekickSettings } from '../state/settingsState'
import { zLayers } from '../state/uiState'

type DetachedToastShellProps = {
  toastShellRef: RefObject<HTMLDivElement | null>
  toastDetachTailPointsDown: boolean
  toastDetachAnchor: 'top' | 'bottom'
  toastDetachBubblePlacement: 'above' | 'below'
  toastMessageFromQuery: string
  settings: SidekickSettings
  toastTextIdFromQuery: string | null
  toastDetachFavorite: boolean
  setToastDetachFavorite: (v: boolean) => void
  openFavoritesRecords: () => void
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
  settings,
  toastTextIdFromQuery,
  toastDetachFavorite,
  setToastDetachFavorite,
  openFavoritesRecords,
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
  return (
    <>
      <main className="relative block h-full min-h-0 w-full overflow-visible bg-transparent text-slate-800 select-none">
        <div
          ref={toastShellRef}
          className={`box-border flex w-full justify-center px-1 ${
            toastDetachTailPointsDown ? 'pb-2 pt-1.5' : 'pb-1.5 pt-2'
          }`}
        >
          <div className="relative w-full max-w-[min(355px,calc(100vw-32px))] shrink-0">
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
              maxChars={settings.textMaxChars}
              onRegenerate={() => {
                void window.sidekickDesktop?.requestRegenerateCopy?.()
              }}
              keepRegenerateLoadingUntilUnmount
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
                void speakCompanionLine(toastMessageFromQuery, {
                  enabled: settings.companionTtsEnabled,
                  model: settings.companionTtsModel,
                  voice: settings.companionTtsVoice,
                  speechRate: settings.companionTtsSpeechRate,
                })
              }
              onOpenFavorites={openFavoritesRecords}
              onOpenSettings={openSettingsFromToast}
              onOpenSkin={openSkinFromToast}
              onOpenMenu={openSpriteMenuFromToastToolbar}
              spriteInteractionLocked={spriteInteractionLocked}
              onSpriteInteractionLockedChange={onSpriteInteractionLockedChange}
              onClose={() => {
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
