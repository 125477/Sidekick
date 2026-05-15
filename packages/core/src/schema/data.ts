import type { SidekickConfig } from './config'

export type EmotionKind = 'happy' | 'calm' | 'anxious' | 'low' | 'tired'

export type AvatarPreset = {
  id: string
  name: string
  src: string
  source: 'builtin' | 'upload' | 'generated'
  motionProfile?: 'enhanced' | 'template'
}

export type TextRecord = {
  id: string
  content: string
  createdAt: string
  source: 'model' | 'fallback'
  favorite: boolean
}

/** 观音灵签式六档，仅娱乐寓意。 */
export type FortuneTier =
  | '上上签'
  | '上签'
  | '中上签'
  | '中签'
  | '中下签'
  | '下签'

export type DailyLotteryDraw = {
  /** 本地日历日 YYYY-MM-DD */
  date: string
  tier: FortuneTier
  verse: string
  hint: string
}

export type EmotionRecord = {
  id: string
  emotion: EmotionKind
  createdAt: string
}

export type SidekickData = {
  schemaVersion: number
  avatar: {
    selectedAvatarId: string
    presets: AvatarPreset[]
    size: number
    opacity: number
  }
  push: {
    intervalMinutes: number
    start: string
    end: string
    isOpen: boolean
    quietHours: {
      enabled: boolean
      start: string
      end: string
    }
  }
  texts: {
    history: TextRecord[]
  }
  /** 每日抽签：同一天只保留最后一次结果（求签一次即锁定）。 */
  lottery: {
    lastDraw: DailyLotteryDraw | null
  }
  emotion: {
    records: EmotionRecord[]
  }
  ui: SidekickConfig
  quotas: {
    imageGenRemaining: number
    imageGenTotal: number
    imageGenExtraCredits: number
  }
  exportedAt: string | null
}

export const SCHEMA_VERSION = 1
