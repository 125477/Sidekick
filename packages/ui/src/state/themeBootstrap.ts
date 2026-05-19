/** 首屏同步用：localStorage 缓存有效主题，避免辅窗/菜单在 React 挂载前闪白。 */
export const EFFECTIVE_THEME_STORAGE_KEY = 'sidekick.effectiveTheme'

export type CachedEffectiveTheme = 'dark' | 'light'

export function readCachedEffectiveTheme(): CachedEffectiveTheme | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const v = localStorage.getItem(EFFECTIVE_THEME_STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

export function writeCachedEffectiveTheme(theme: CachedEffectiveTheme): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(EFFECTIVE_THEME_STORAGE_KEY, theme)
  } catch {
    /* quota / private mode */
  }
}

/** 无缓存时与默认「跟随系统」一致。 */
export function resolveBootstrapEffectiveTheme(): CachedEffectiveTheme {
  const cached = readCachedEffectiveTheme()
  if (cached) return cached
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export function applyEffectiveThemeToDocument(
  theme: CachedEffectiveTheme,
): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function readThemeFromLocationSearch(): CachedEffectiveTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const t = new URLSearchParams(window.location.search).get('theme')
    return t === 'dark' || t === 'light' ? t : null
  } catch {
    return null
  }
}

export function bootstrapThemeOnDocument(): CachedEffectiveTheme {
  const fromUrl = readThemeFromLocationSearch()
  if (fromUrl) {
    applyEffectiveThemeToDocument(fromUrl)
    return fromUrl
  }
  const theme = resolveBootstrapEffectiveTheme()
  applyEffectiveThemeToDocument(theme)
  return theme
}

/** 打开独立菜单窗时由挂件/气泡传入，与当前有效主题一致。 */
export function readThemeForExternalWindow(
  resolved?: CachedEffectiveTheme,
): CachedEffectiveTheme {
  if (resolved === 'dark' || resolved === 'light') return resolved
  const cached = readCachedEffectiveTheme()
  if (cached) return cached
  if (typeof document !== 'undefined') {
    const dt = document.documentElement.dataset.theme
    if (dt === 'dark' || dt === 'light') return dt
  }
  return resolveBootstrapEffectiveTheme()
}
