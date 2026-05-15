import type { Dispatch } from 'react'
import type { ActivePanel, UiAction } from '../state/uiState'

/** 气泡工具栏「收藏历史 / 设置 / 换肤」打开的辅窗类型。 */
export type ToastToolbarAuxPanel = Extract<
  ActivePanel,
  'favorites' | 'settings' | 'skin'
>

/** Electron 有 `openPanelWindow` 时走独立窗，否则回退到 Web 内嵌面板。 */
export function openAuxPanelFromBridgeOrDispatch(
  panel: ToastToolbarAuxPanel,
  dispatch: Dispatch<UiAction>,
): void {
  if (
    typeof window !== 'undefined' &&
    window.sidekickDesktop?.openPanelWindow
  ) {
    void window.sidekickDesktop.openPanelWindow(panel)
    return
  }
  dispatch({ type: 'SET_PANEL', panel })
}
