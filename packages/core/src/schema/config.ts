export type ToastAnchor = 'top' | 'bottom'

export type QuietHours = {
  enabled: boolean
  start: string
  end: string
}

export type SidekickConfig = {
  toastAnchor: ToastAnchor
  dwellSeconds: number
  quietHours: QuietHours
  imageGenRemaining: number
  reducedMotion: boolean
  locale: 'zh-CN' | 'en-US'
  motionEnabled: boolean
}

export const defaultConfig: SidekickConfig = {
  toastAnchor: 'bottom',
  dwellSeconds: 180,
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '08:00',
  },
  imageGenRemaining: 3,
  reducedMotion: false,
  locale: 'zh-CN',
  motionEnabled: true,
}
