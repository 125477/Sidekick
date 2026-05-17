import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback, useEffect } from 'react'
import { loadData, saveData, type AvatarPreset, type EmotionRecord } from '@sidekick/core'
import { broadcastAvatarSync, subscribeAvatarSync } from '../state/avatarSync'
import { broadcastSettingsSync, subscribeSettingsSync } from '../state/settingsSync'
import { areSettingsEqual, type SidekickSettings } from '../state/settingsState'
import {
  loadOnboardingComplete,
  loadSettings,
  saveSettings,
} from '../state/settingsStorage'
import type { UiAction } from '../state/uiState'
import { mergeLoadedSettings } from './mergeLoadedSettings'

export type UseAppBootstrapArgs = {
  dispatch: Dispatch<UiAction>
  settings: SidekickSettings
  settingsRef: MutableRefObject<SidekickSettings>
  settingsPanelSliderSaveTimerRef: MutableRefObject<number | null>
  skipPersistSettingsRef: MutableRefObject<boolean>
  skipAvatarPersist: MutableRefObject<boolean>
  avatars: AvatarPreset[]
  selectedAvatarId: string
  avatarHydrated: boolean
  uiStateActivePanel: string
  setSettings: Dispatch<SetStateAction<SidekickSettings>>
  setOnboardingDone: Dispatch<SetStateAction<boolean | null>>
  setAvatars: Dispatch<SetStateAction<AvatarPreset[]>>
  setSelectedAvatarId: Dispatch<SetStateAction<string>>
  setEmotionRecords: Dispatch<SetStateAction<EmotionRecord[]>>
  setSettingsReady: Dispatch<SetStateAction<boolean>>
  setAvatarHydrated: Dispatch<SetStateAction<boolean>>
}

export function useAppBootstrap({
  dispatch,
  settings,
  settingsRef,
  settingsPanelSliderSaveTimerRef,
  skipPersistSettingsRef,
  skipAvatarPersist,
  avatars,
  selectedAvatarId,
  avatarHydrated,
  uiStateActivePanel,
  setSettings,
  setOnboardingDone,
  setAvatars,
  setSelectedAvatarId,
  setEmotionRecords,
  setSettingsReady,
  setAvatarHydrated,
}: UseAppBootstrapArgs) {
  const flushPendingPanelSliderSave = useCallback(() => {
    if (settingsPanelSliderSaveTimerRef.current == null) return
    window.clearTimeout(settingsPanelSliderSaveTimerRef.current)
    settingsPanelSliderSaveTimerRef.current = null
    void saveSettings(settingsRef.current).then(() => broadcastSettingsSync())
  }, [settingsPanelSliderSaveTimerRef, settingsRef])

  useEffect(() => {
    void Promise.all([
      loadSettings(),
      loadData(),
      loadOnboardingComplete(),
    ]).then(async ([saved, data, onboarded]) => {
      // 仅当用户在引导里点「完成」或「跳过」时写入 `saveOnboardingComplete`；
      // 勿用文案历史等侧写条件自动标记，否则中途退出应用会被误判为已引导。
      const done = onboarded === true
      setOnboardingDone(done)
      setSettings(mergeLoadedSettings(saved, data))
      setAvatars(data.avatar.presets)
      setSelectedAvatarId(data.avatar.selectedAvatarId)
      setEmotionRecords(data.emotion.records)
      dispatch({ type: 'SET_TOAST_ANCHOR', anchor: saved.toastAnchor })
      setSettingsReady(true)
      setAvatarHydrated(true)
    })
  }, [dispatch, setAvatarHydrated, setAvatars, setEmotionRecords, setOnboardingDone, setSelectedAvatarId, setSettings, setSettingsReady])

  useEffect(() => {
    if (uiStateActivePanel !== 'emotion') return
    void loadData().then((d) => setEmotionRecords(d.emotion.records))
  }, [uiStateActivePanel, setEmotionRecords])

  useEffect(() => {
    if (uiStateActivePanel === 'settings') return
    flushPendingPanelSliderSave()
  }, [uiStateActivePanel, flushPendingPanelSliderSave])

  useEffect(() => {
    const onPageHide = () => {
      flushPendingPanelSliderSave()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      flushPendingPanelSliderSave()
    }
  }, [flushPendingPanelSliderSave])

  useEffect(() => {
    return subscribeSettingsSync(() => {
      void Promise.all([loadSettings(), loadData()]).then(([saved, data]) => {
        skipPersistSettingsRef.current = true
        setSettings((prev) => {
          const next = mergeLoadedSettings(saved, data)
          return areSettingsEqual(prev, next) ? prev : next
        })
        dispatch({ type: 'SET_TOAST_ANCHOR', anchor: saved.toastAnchor })
      })
    })
  }, [dispatch, setSettings, skipPersistSettingsRef])

  useEffect(() => {
    return subscribeAvatarSync(() => {
      void loadData().then((data) => {
        skipAvatarPersist.current = true
        setAvatars(data.avatar.presets)
        setSelectedAvatarId(data.avatar.selectedAvatarId)
        setEmotionRecords(data.emotion.records)
      })
    })
  }, [setAvatars, setEmotionRecords, setSelectedAvatarId, skipAvatarPersist])

  useEffect(() => {
    if (!avatarHydrated) return
    if (skipAvatarPersist.current) {
      skipAvatarPersist.current = false
      return
    }
    void loadData().then(async (data) => {
      await saveData({
        ...data,
        avatar: {
          ...data.avatar,
          presets: avatars,
          selectedAvatarId,
          size: settings.avatarSize,
          opacity: settings.avatarOpacity,
        },
      })
      broadcastAvatarSync()
    })
  }, [
    avatarHydrated,
    avatars,
    selectedAvatarId,
    settings.avatarSize,
    settings.avatarOpacity,
    skipAvatarPersist,
  ])

  return { flushPendingPanelSliderSave }
}
