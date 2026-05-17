import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AvatarPreset, EmotionKind, EmotionRecord } from '@sidekick/core'
import { DailyMoodPanel } from '../components/emotion/DailyMoodPanel'
import { SettingsPanel } from '../components/settings/SettingsPanel'
import { AvatarPresetGallery } from '../components/skinning/AvatarPresetGallery'
import { SkinningPanel } from '../components/skinning/SkinningPanel'
import { UploadTab } from '../components/skinning/UploadTab'
import { DailyFortunePanel } from '../components/fortune/DailyFortunePanel'
import { FavoriteTextsPanel } from '../components/favorites/FavoriteTextsPanel'
import {
  defaultSettings,
  onlyAvatarSlidersChanged,
  type SidekickSettings,
} from '../state/settingsState'
import { broadcastSettingsSync } from '../state/settingsSync'
import type { UiAction, UiState } from '../state/uiState'
import { saveSettings } from '../state/settingsStorage'
import { APP_SELF_INTRO_LONG_COPY } from '../constants/appSelfIntroCopy'

export type AppPanelContentProps = {
  uiState: UiState
  dispatch: Dispatch<UiAction>
  panelTitle: string
  panelShellClass: string
  builtinAvatars: AvatarPreset[]
  customAvatars: AvatarPreset[]
  selectedAvatarId: string
  setSelectedAvatarId: (id: string) => void
  removeCustomAvatar: (id: string) => void
  settings: SidekickSettings
  setSettings: (v: SetStateAction<SidekickSettings>) => void
  settingsRef: MutableRefObject<SidekickSettings>
  settingsPanelSliderSaveTimerRef: MutableRefObject<number | null>
  setToastAnchorReplayNonce: (v: SetStateAction<number>) => void
  emotionRecords: EmotionRecord[]
  setEmotionRecords: (v: EmotionRecord[]) => void
  requestCompanionText: (
    keyword?: string,
    emotion?: EmotionKind,
  ) => Promise<void>
  showToastMessage: (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string | null
      favorite?: boolean
      toastMode?: 'normal' | 'intro'
    },
  ) => void | Promise<void>
  restartOnboarding: () => void
  isPanelMode: boolean
  setAvatars: (v: SetStateAction<AvatarPreset[]>) => void
}

export function AppPanelContent({
  uiState,
  dispatch,
  panelTitle,
  panelShellClass,
  builtinAvatars,
  customAvatars,
  selectedAvatarId,
  setSelectedAvatarId,
  removeCustomAvatar,
  settings,
  setSettings,
  settingsRef,
  settingsPanelSliderSaveTimerRef,
  setToastAnchorReplayNonce,
  emotionRecords,
  setEmotionRecords,
  requestCompanionText,
  showToastMessage,
  restartOnboarding,
  isPanelMode,
  setAvatars,
}: AppPanelContentProps) {
  return uiState.activePanel === 'skin' ? (
    <div className={panelShellClass}>
      <h2 className="sk-panel-chrome-title shrink-0">{panelTitle}</h2>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <AvatarPresetGallery
          sectionTitle="默认形象"
          presets={builtinAvatars}
          selectedAvatarId={selectedAvatarId}
          onSelect={setSelectedAvatarId}
        />
        <AvatarPresetGallery
          sectionTitle="自定义形象"
          presets={customAvatars}
          selectedAvatarId={selectedAvatarId}
          onSelect={setSelectedAvatarId}
          emptyHint="暂无自定义形象，可在下方选择文件上传；上传成功后会加入此处。"
          onRemovePreset={removeCustomAvatar}
          orderedSlotDisplayNames
        />
        <div className="min-h-0 flex-1">
          <SkinningPanel
            activeTab={uiState.skinTab}
            onTabChange={(tab) => dispatch({ type: 'SET_SKIN_TAB', tab })}
            showAiTab={false}
          >
            <UploadTab
              onApply={(avatarSrc) => {
                if (avatarSrc) {
                  const uploaded: AvatarPreset = {
                    id: `upload-${Date.now()}`,
                    name: '上传形象',
                    src: avatarSrc,
                    source: 'upload',
                  }
                  setAvatars((prev) => [uploaded, ...prev].slice(0, 12))
                  setSelectedAvatarId(uploaded.id)
                }
                void showToastMessage('上传形象已应用。')
              }}
            />
          </SkinningPanel>
        </div>
      </div>
    </div>
  ) : uiState.activePanel === 'settings' ? (
    <div className={panelShellClass}>
      <h2 className="sk-panel-chrome-title shrink-0">{panelTitle}</h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <SettingsPanel
          settings={{ ...settings, toastAnchor: uiState.toastAnchor }}
          onToastAnchorInteraction={(nextAnchor) => {
            setToastAnchorReplayNonce((n) => n + 1)
            void window.sidekickDesktop?.setToastAnchorPreference?.({
              anchor: nextAnchor,
              forceReplay: true,
            })
          }}
          onSettingsChange={(next) => {
            const prev = settingsRef.current
            setSettings(next)
            dispatch({ type: 'SET_TOAST_ANCHOR', anchor: next.toastAnchor })
            if (onlyAvatarSlidersChanged(prev, next)) {
              if (settingsPanelSliderSaveTimerRef.current != null) {
                window.clearTimeout(settingsPanelSliderSaveTimerRef.current)
              }
              settingsPanelSliderSaveTimerRef.current = window.setTimeout(() => {
                settingsPanelSliderSaveTimerRef.current = null
                void saveSettings(settingsRef.current).then(() =>
                  broadcastSettingsSync(),
                )
              }, 220)
              return
            }
            if (settingsPanelSliderSaveTimerRef.current != null) {
              window.clearTimeout(settingsPanelSliderSaveTimerRef.current)
              settingsPanelSliderSaveTimerRef.current = null
            }
            void saveSettings(next).then(() => broadcastSettingsSync())
          }}
          onRestoreDefaults={() => {
            if (settingsPanelSliderSaveTimerRef.current != null) {
              window.clearTimeout(settingsPanelSliderSaveTimerRef.current)
              settingsPanelSliderSaveTimerRef.current = null
            }
            setSettings(defaultSettings)
            dispatch({
              type: 'SET_TOAST_ANCHOR',
              anchor: defaultSettings.toastAnchor,
            })
            void saveSettings(defaultSettings).then(() => broadcastSettingsSync())
          }}
          onOpenFirstRunGuide={restartOnboarding}
          onReplayAppIntro={() => {
            void showToastMessage(APP_SELF_INTRO_LONG_COPY, {
              dwellSeconds: 0,
              toastMode: 'intro',
            })
          }}
        />
      </div>
    </div>
  ) : uiState.activePanel === 'emotion' ? (
    <div className={`${panelShellClass} [&_.sk-panel-chrome-title]:mb-2`}>
      <h2 className="sk-panel-chrome-title shrink-0">{panelTitle}</h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <DailyMoodPanel
          emotionMoodTab={uiState.emotionMoodTab}
          onEmotionMoodTabChange={(tab) =>
            dispatch({ type: 'SET_EMOTION_MOOD_TAB', tab })
          }
          settings={settings}
          emotionRecords={emotionRecords}
          setEmotionRecords={setEmotionRecords}
          requestCompanionText={requestCompanionText}
        />
      </div>
    </div>
  ) : uiState.activePanel === 'fortune' ? (
    <div className={panelShellClass}>
      <h2 className="sk-panel-chrome-title shrink-0">{panelTitle}</h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <DailyFortunePanel fillAvailable={isPanelMode} />
      </div>
    </div>
  ) : uiState.activePanel === 'favorites' ? (
    <div className={panelShellClass}>
      <h2 className="sk-panel-chrome-title shrink-0">{panelTitle}</h2>
      <div className="flex min-h-0 flex-1 flex-col">
        <FavoriteTextsPanel fillAvailable={isPanelMode} />
      </div>
    </div>
  ) : null
}
