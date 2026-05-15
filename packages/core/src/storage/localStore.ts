import localforage from 'localforage'
import { defaultConfig } from '../schema/config'
import type {
  AvatarPreset,
  DailyLotteryDraw,
  EmotionRecord,
  SidekickData,
  TextRecord,
} from '../schema/data'
import { localCalendarDate, rollDailyDraw } from '../utils/dailyFortuneLottery'
import { SCHEMA_VERSION } from '../schema/data'

const KEY = 'sidekick.data.v1'

/** 同一 origin 下多窗口（如 Electron 独立 panel）可收到文案/收藏变更。 */
const TEXTS_SYNC_CHANNEL = 'sidekick:texts-sync'

function notifyTextsChanged(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(TEXTS_SYNC_CHANNEL)
    bc.postMessage(null)
    queueMicrotask(() => bc.close())
  } catch {
    /* ignore */
  }
}

/**
 * 订阅本地文案数据变更（例如收藏开关）。返回取消订阅函数。
 */
export function subscribeTextsChanged(onChange: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {}
  }
  try {
    const bc = new BroadcastChannel(TEXTS_SYNC_CHANNEL)
    bc.onmessage = () => {
      onChange()
    }
    return () => bc.close()
  } catch {
    return () => {}
  }
}

const db = localforage.createInstance({
  name: 'sidekick-core',
  storeName: 'sidekick_data',
})

/** 本地数字 1–99 → 中文数字串，用于内置形象顺序名「形象一」…。 */
function cnNumeralUnder100(n: number): string {
  const d = '零一二三四五六七八九'
  if (n <= 0 || n > 99) return String(n)
  if (n < 10) return d[n]!
  if (n === 10) return '十'
  if (n < 20) return '十' + d[n % 10]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return d[tens]! + '十'
  return d[tens]! + '十' + d[ones]!
}

function builtinAvatarSlotName(slotIndex0: number): string {
  return `形象${cnNumeralUnder100(slotIndex0 + 1)}`
}

/** 远程 https 形象；本地 Lottie/GIF/视频由 UI 包 `src/static/` 扫描后注入。 */
export const HTTPS_BUILTIN_AVATARS: AvatarPreset[] = [
  {
    id: 'companion-lottie',
    name: '形象一',
    src: 'https://lottie.host/e19656e9-0eea-4e89-a713-807a1e7b57bd/NsOfc6SfOo.lottie',
    source: 'builtin',
    motionProfile: 'enhanced',
  },
  {
    id: 'lottie-e5lk',
    name: '形象二',
    src: 'https://lottie.host/0e4686e3-d2e0-4797-98a5-27c2d260593a/E5lKTBZ6gk.lottie',
    source: 'builtin',
    motionProfile: 'enhanced',
  },
  {
    id: 'lottie-c5ib',
    name: '形象三',
    src: 'https://lottie.host/5593319e-880f-42a1-9826-e192769c4b8d/C5ib0knKd7.lottie',
    source: 'builtin',
    motionProfile: 'enhanced',
  },
]

let configuredDefaultAvatars: AvatarPreset[] | null = null

/** UI 在启动时注入完整内置形象列表（含 `src/assets` 扫描结果）。 */
export function configureDefaultAvatars(presets: AvatarPreset[]): void {
  configuredDefaultAvatars = presets
}

export function buildDefaultAvatarsFromParts(
  remoteBuiltins: readonly AvatarPreset[],
  folderBuiltins: readonly AvatarPreset[],
): AvatarPreset[] {
  const raw = [...remoteBuiltins, ...folderBuiltins].slice(0, 12)
  return raw.map((p, i) => ({
    ...p,
    name: builtinAvatarSlotName(i),
  }))
}

/**
 * 将指定 id 的形象挪到列表首位，并按顺序重新标注「形象一」「形象二」…
 */
export function moveDefaultAvatarToFront(
  presets: readonly AvatarPreset[],
  presetId: string,
): AvatarPreset[] {
  const list = [...presets]
  const idx = list.findIndex((p) => p.id === presetId)
  if (idx < 0) {
    return list.map((p, i) => ({
      ...p,
      name: builtinAvatarSlotName(i),
    }))
  }
  if (idx === 0) {
    return list.map((p, i) => ({
      ...p,
      name: builtinAvatarSlotName(i),
    }))
  }
  const picked = list[idx]!
  const rest = list.filter((_, i) => i !== idx)
  return [picked, ...rest].map((p, i) => ({
    ...p,
    name: builtinAvatarSlotName(i),
  }))
}

function resolveDefaultAvatars(): AvatarPreset[] {
  if (configuredDefaultAvatars) return configuredDefaultAvatars
  return buildDefaultAvatarsFromParts(HTTPS_BUILTIN_AVATARS, [])
}

export function getDefaultAvatars(): AvatarPreset[] {
  return resolveDefaultAvatars()
}

export function mergeAvatarPresetsWithDefaults(
  savedPresets: AvatarPreset[] | undefined,
): AvatarPreset[] {
  const defaults = resolveDefaultAvatars()
  const builtinIds = new Set(defaults.map((p) => p.id))
  const customs = (savedPresets ?? []).filter(
    (p) =>
      (p.source === 'upload' || p.source === 'generated') &&
      !builtinIds.has(p.id) &&
      !p.src.startsWith('blob:'),
  )
  return [...defaults, ...customs].slice(0, 12)
}

function mergeAvatarFromStorage(
  savedAvatar: Partial<SidekickData['avatar']> | undefined,
): SidekickData['avatar'] {
  const presets = mergeAvatarPresetsWithDefaults(savedAvatar?.presets)
  let selectedAvatarId =
    savedAvatar?.selectedAvatarId ??
    resolveDefaultAvatars()[0]?.id ??
    'companion-lottie'
  if (!presets.some((p) => p.id === selectedAvatarId)) {
    selectedAvatarId = resolveDefaultAvatars()[0]?.id ?? 'companion-lottie'
  }
  return {
    ...defaultData.avatar,
    ...savedAvatar,
    presets,
    selectedAvatarId,
  }
}

export const defaultData: SidekickData = {
  schemaVersion: SCHEMA_VERSION,
  avatar: {
    selectedAvatarId: resolveDefaultAvatars()[0]?.id ?? 'companion-lottie',
    presets: resolveDefaultAvatars(),
    size: 80,
    opacity: 90,
  },
  push: {
    intervalMinutes: 3,
    start: '08:00',
    end: '22:00',
    isOpen: true,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
    },
  },
  texts: { history: [] },
  lottery: { lastDraw: null },
  emotion: { records: [] },
  ui: defaultConfig,
  quotas: {
    imageGenRemaining: 5,
    imageGenTotal: 5,
    imageGenExtraCredits: 0,
  },
  exportedAt: null,
}

export async function loadData(): Promise<SidekickData> {
  const saved = await db.getItem<SidekickData>(KEY)
  if (!saved) {
    return {
      ...defaultData,
      avatar: mergeAvatarFromStorage(undefined),
    }
  }
  return {
    ...defaultData,
    ...saved,
    avatar: mergeAvatarFromStorage(saved.avatar),
    push: {
      ...defaultData.push,
      ...saved.push,
      quietHours: { ...defaultData.push.quietHours, ...saved.push?.quietHours },
    },
    texts: { ...defaultData.texts, ...saved.texts },
    lottery: {
      ...defaultData.lottery,
      ...saved.lottery,
      lastDraw: saved.lottery?.lastDraw ?? defaultData.lottery.lastDraw,
    },
    emotion: { ...defaultData.emotion, ...saved.emotion },
    ui: { ...defaultData.ui, ...saved.ui },
    quotas: { ...defaultData.quotas, ...saved.quotas },
  }
}

export async function saveData(data: SidekickData): Promise<void> {
  await db.setItem(KEY, data)
}

export async function appendText(record: TextRecord): Promise<SidekickData> {
  const data = await loadData()
  const next: SidekickData = {
    ...data,
    texts: { history: [record, ...data.texts.history].slice(0, 200) },
  }
  await saveData(next)
  return next
}

export async function toggleTextFavorite(id: string): Promise<SidekickData> {
  const data = await loadData()
  const next: SidekickData = {
    ...data,
    texts: {
      history: data.texts.history.map((t) =>
        t.id === id ? { ...t, favorite: !t.favorite } : t,
      ),
    },
  }
  await saveData(next)
  notifyTextsChanged()
  return next
}

export async function removeTextFromHistory(id: string): Promise<SidekickData> {
  const data = await loadData()
  const next: SidekickData = {
    ...data,
    texts: {
      history: data.texts.history.filter((t) => t.id !== id),
    },
  }
  await saveData(next)
  notifyTextsChanged()
  return next
}

/** 若本地日历已是今日签则返回之，否则摇新签并落库。 */
export async function commitTodayLotteryDraw(): Promise<DailyLotteryDraw> {
  const data = await loadData()
  const today = localCalendarDate()
  const existing = data.lottery.lastDraw
  if (existing?.date === today) return existing
  const draw = rollDailyDraw()
  await saveData({
    ...data,
    lottery: { lastDraw: draw },
  })
  return draw
}

/** 重新摇签并覆盖当日记录（以最后一次为准）。 */
export async function redrawTodayLotteryDraw(): Promise<DailyLotteryDraw> {
  const data = await loadData()
  const draw = rollDailyDraw()
  await saveData({
    ...data,
    lottery: { lastDraw: draw },
  })
  return draw
}

export async function appendEmotion(record: EmotionRecord): Promise<SidekickData> {
  const data = await loadData()
  const next: SidekickData = {
    ...data,
    emotion: { records: [record, ...data.emotion.records].slice(0, 500) },
  }
  await saveData(next)
  return next
}

export async function exportData(): Promise<string> {
  const data = await loadData()
  return JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)
}

export async function importData(payload: string): Promise<SidekickData> {
  const parsed = JSON.parse(payload) as Partial<SidekickData>
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error('schemaVersion mismatch')
  }
  const merged = {
    ...defaultData,
    ...parsed,
    exportedAt: null,
    avatar: mergeAvatarFromStorage(parsed.avatar),
    lottery: {
      ...defaultData.lottery,
      ...parsed.lottery,
      lastDraw: parsed.lottery?.lastDraw ?? defaultData.lottery.lastDraw,
    },
  } as SidekickData
  await saveData(merged)
  return merged
}
