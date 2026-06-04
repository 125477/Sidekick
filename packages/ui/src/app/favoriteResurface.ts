import {
  isFavoriteResurfaceCooldownActive,
  loadData,
  markFavoriteTextResurfaced,
} from '@sidekick/core'
import type { CompanionCopyTrigger } from '@sidekick/core'

const RESURFACE_TRIGGERS = new Set<CompanionCopyTrigger>([
  'scheduled',
  'unlock',
  'focus-end',
  'streak-nudge',
  'interest-deepen',
  'yesterday-greeting',
])

export type FavoriteResurfacePick = {
  text: string
  favoriteId: string
}

/** 约 20% 概率从收藏句中 resurfacing（自动推送类 trigger；不含启动首句）。 */
export async function pickFavoriteResurfaceLine(
  enabled: boolean,
  trigger: CompanionCopyTrigger,
  avoidRecent: string[],
  opts?: { skipForStartup?: boolean },
): Promise<FavoriteResurfacePick | null> {
  if (!enabled || !RESURFACE_TRIGGERS.has(trigger)) return null
  if (opts?.skipForStartup) return null
  if (Math.random() > 0.2) return null
  const data = await loadData()
  const favorites = data.texts.history.filter(
    (t) =>
      t.favorite &&
      t.content.replace(/\s+/g, ' ').trim().length > 0 &&
      !isFavoriteResurfaceCooldownActive(t.lastResurfacedAt),
  )
  if (favorites.length === 0) return null
  const avoid = new Set(avoidRecent.map((l) => l.replace(/\s+/g, ' ').trim()))
  const pool = favorites.filter(
    (f) => !avoid.has(f.content.replace(/\s+/g, ' ').trim()),
  )
  if (pool.length === 0) return null
  const pick = pool[Math.floor(Math.random() * pool.length)]
  const text = pick?.content.replace(/\s+/g, ' ').trim()
  if (!pick || !text) return null
  return { text, favoriteId: pick.id }
}

/** 气泡已展示收藏再现句后写入冷却（再现后 3 天内不再抽同句）。 */
export async function recordFavoriteResurfaceShown(
  favoriteId: string | undefined,
): Promise<void> {
  if (!favoriteId) return
  try {
    await markFavoriteTextResurfaced(favoriteId)
  } catch {
    /* ignore storage errors */
  }
}
