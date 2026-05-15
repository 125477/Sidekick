export type ActivePanel =
  | 'none'
  | 'skin'
  | 'settings'
  | 'emotion'
  | 'fortune'
  | 'favorites'
export type SkinTab = 'jimeng' | 'upload'
export type ToastAnchor = 'top' | 'bottom'
export type MenuState = 'closed' | 'opening' | 'open' | 'closing'
export type ToastState = 'hidden' | 'entering' | 'visible' | 'leaving'
export type SpriteState =
  | 'idle'
  | 'hover'
  | 'tap'
  | 'drag'
  | 'notify'
  | 'jump'
  | 'wave'
  | 'laugh'
  | 'stretch'

export type UiState = {
  activePanel: ActivePanel
  skinTab: SkinTab
  menuState: MenuState
  toastState: ToastState
  toastAnchor: ToastAnchor
  toastMessage: string
}

export type UiAction =
  | { type: 'MENU_OPEN' }
  | { type: 'MENU_CLOSE' }
  | { type: 'MENU_OPENED' }
  | { type: 'MENU_CLOSED' }
  | { type: 'SET_PANEL'; panel: ActivePanel }
  | { type: 'SET_SKIN_TAB'; tab: SkinTab }
  | { type: 'SET_TOAST_ANCHOR'; anchor: ToastAnchor }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'HIDE_TOAST' }
  | { type: 'TOAST_VISIBLE' }
  | { type: 'TOAST_HIDDEN' }

export const zLayers = {
  sprite: 'z-20',
  toast: 'z-30',
  menu: 'z-50',
} as const

export const initialUiState: UiState = {
  activePanel: 'none',
  skinTab: 'jimeng',
  menuState: 'closed',
  toastState: 'hidden',
  toastAnchor: 'bottom',
  toastMessage: '今天也在稳稳前进，先奖励自己一口深呼吸。',
}

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'MENU_OPEN':
      return { ...state, menuState: 'opening' }
    case 'MENU_OPENED':
      return { ...state, menuState: 'open' }
    case 'MENU_CLOSE':
      return { ...state, menuState: 'closing' }
    case 'MENU_CLOSED':
      return { ...state, menuState: 'closed' }
    case 'SET_PANEL':
      return { ...state, activePanel: action.panel }
    case 'SET_SKIN_TAB':
      return { ...state, skinTab: action.tab }
    case 'SET_TOAST_ANCHOR':
      return { ...state, toastAnchor: action.anchor }
    case 'SHOW_TOAST':
      return {
        ...state,
        toastMessage: action.message,
        toastState: 'entering',
      }
    case 'TOAST_VISIBLE':
      return { ...state, toastState: 'visible' }
    case 'HIDE_TOAST':
      return { ...state, toastState: 'leaving' }
    case 'TOAST_HIDDEN':
      return { ...state, toastState: 'hidden' }
    default:
      return state
  }
}
