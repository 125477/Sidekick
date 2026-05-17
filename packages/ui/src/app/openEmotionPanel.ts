import type { Dispatch } from 'react'
import type { EmotionMoodTab, UiAction } from '../state/uiState'

export function openEmotionPanel(
  dispatch: Dispatch<UiAction>,
  opts?: { tab?: EmotionMoodTab },
): void {
  if (opts?.tab) {
    dispatch({ type: 'SET_EMOTION_MOOD_TAB', tab: opts.tab })
  }
  if (
    typeof window !== 'undefined' &&
    window.sidekickDesktop?.openPanelWindow
  ) {
    void window.sidekickDesktop.openPanelWindow(
      'emotion',
      opts?.tab ? { emotionTab: opts.tab } : undefined,
    )
    return
  }
  dispatch({ type: 'SET_PANEL', panel: 'emotion' })
}
