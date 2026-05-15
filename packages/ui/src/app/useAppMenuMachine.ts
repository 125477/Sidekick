import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect } from 'react'
import type { UiAction, UiState } from '../state/uiState'

export type UseAppMenuMachineArgs = {
  isWidgetMode: boolean
  isToastMode: boolean
  isPanelMode: boolean
  menuOpen: boolean
  detachedWidgetSpriteMenu: boolean
  openDetachedSpriteMenuSupported: boolean
  panelFromQuery: string | null
  uiState: UiState
  dispatch: Dispatch<UiAction>
  setToastMeta: Dispatch<SetStateAction<{ id: string; favorite: boolean } | null>>
  moreRestoreToastTimerRef: MutableRefObject<number | null>
}

export function useAppMenuMachine({
  isWidgetMode,
  isToastMode,
  isPanelMode,
  menuOpen,
  detachedWidgetSpriteMenu,
  openDetachedSpriteMenuSupported,
  panelFromQuery,
  uiState,
  dispatch,
  setToastMeta,
  moreRestoreToastTimerRef,
}: UseAppMenuMachineArgs) {
  useEffect(() => {
    if (uiState.menuState === 'opening') {
      const id = window.setTimeout(() => dispatch({ type: 'MENU_OPENED' }), 120)
      return () => window.clearTimeout(id)
    }
    if (uiState.menuState === 'closing') {
      const id = window.setTimeout(() => dispatch({ type: 'MENU_CLOSED' }), 120)
      return () => window.clearTimeout(id)
    }
  }, [uiState.menuState, dispatch])

  useEffect(() => {
    if (!isWidgetMode || !menuOpen) return
    if (detachedWidgetSpriteMenu) {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') dispatch({ type: 'MENU_CLOSE' })
      }
      document.addEventListener('visibilitychange', onVisibility)
      return () =>
        document.removeEventListener('visibilitychange', onVisibility)
    }
    const close = () => {
      dispatch({ type: 'MENU_CLOSE' })
    }
    const onBlur = () => {
      close()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') close()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isWidgetMode, menuOpen, detachedWidgetSpriteMenu, dispatch])

  useEffect(() => {
    if (!isToastMode || !menuOpen) return
    if (openDetachedSpriteMenuSupported) {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') {
          dispatch({ type: 'MENU_CLOSE' })
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      return () =>
        document.removeEventListener('visibilitychange', onVisibility)
    }
    const close = () => {
      dispatch({ type: 'MENU_CLOSE' })
    }
    window.addEventListener('blur', close)
    return () => window.removeEventListener('blur', close)
  }, [isToastMode, menuOpen, dispatch, openDetachedSpriteMenuSupported])

  useEffect(() => {
    if (uiState.toastState === 'entering') {
      const id = window.setTimeout(() => dispatch({ type: 'TOAST_VISIBLE' }), 90)
      return () => window.clearTimeout(id)
    }
    if (uiState.toastState === 'leaving') {
      const id = window.setTimeout(() => dispatch({ type: 'TOAST_HIDDEN' }), 90)
      return () => window.clearTimeout(id)
    }
  }, [uiState.toastState, dispatch])

  useEffect(() => {
    if (uiState.toastState === 'hidden') setToastMeta(null)
  }, [uiState.toastState, setToastMeta])

  useEffect(() => {
    return () => {
      if (moreRestoreToastTimerRef.current != null) {
        window.clearTimeout(moreRestoreToastTimerRef.current)
        moreRestoreToastTimerRef.current = null
      }
    }
  }, [moreRestoreToastTimerRef])

  useEffect(() => {
    if (!isPanelMode) return
    if (
      panelFromQuery === 'skin' ||
      panelFromQuery === 'settings' ||
      panelFromQuery === 'emotion' ||
      panelFromQuery === 'fortune' ||
      panelFromQuery === 'favorites'
    ) {
      dispatch({ type: 'SET_PANEL', panel: panelFromQuery })
    } else {
      dispatch({ type: 'SET_PANEL', panel: 'settings' })
    }
  }, [dispatch, isPanelMode, panelFromQuery])
}
