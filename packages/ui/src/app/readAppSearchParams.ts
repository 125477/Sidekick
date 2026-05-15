import { parseBubblePlacementFromQuery } from '../utils/toastPlacementFromQuery'

export type AppUrlState = {
  mode: string
  panelFromQuery: string | null
  toastMessageFromQuery: string
  toastSearch: string
  toastAnchorFromQuery: 'top' | 'bottom'
  toastBubblePlacement: ReturnType<typeof parseBubblePlacementFromQuery>
  toastTextIdFromQuery: string | null
  toastFavoriteFromUrl: boolean
}

export function readAppSearchParams(): AppUrlState {
  if (typeof window === 'undefined') {
    return {
      mode: 'app',
      panelFromQuery: null,
      toastMessageFromQuery: '',
      toastSearch: '',
      toastAnchorFromQuery: 'top',
      toastBubblePlacement: parseBubblePlacementFromQuery(''),
      toastTextIdFromQuery: null,
      toastFavoriteFromUrl: false,
    }
  }
  const search = window.location.search
  const sp = new URLSearchParams(search)
  const mode = sp.get('mode') ?? 'app'
  const isToastMode = mode === 'toast'
  return {
    mode,
    panelFromQuery: sp.get('panel'),
    toastMessageFromQuery: sp.get('message') ?? '',
    toastSearch: search,
    toastAnchorFromQuery:
      sp.get('anchor')?.toLowerCase() === 'bottom' ? 'bottom' : 'top',
    toastBubblePlacement: parseBubblePlacementFromQuery(search),
    toastTextIdFromQuery: isToastMode
      ? sp.get('textId')?.trim() || null
      : null,
    toastFavoriteFromUrl: isToastMode ? sp.get('favorite') === '1' : false,
  }
}
