import { loadData } from '@sidekick/core'
import type { CompanionCopyTrigger } from '@sidekick/core'

const RESURFACE_TRIGGERS = new Set<CompanionCopyTrigger>([
  'scheduled',
  'unlock',
  'focus-end',
  'streak-nudge',
  'interest-deepen',
  'yesterday-greeting',
])

/** 约 20% 概率从收藏句中 resurfacing（自动推送类 trigger）。 */
export async function pickFavoriteResurfaceLine(
  enabled: boolean,
  trigger: CompanionCopyTrigger,
  avoidRecent: string[],
): Promise<string | null> {
  if (!enabled || !RESURFACE_TRIGGERS.has(trigger)) return null
  if (Math.random() > 0.2) return null
  const data = await loadData()
  const favorites = data.texts.history.filter(
    (t) => t.favorite && t.content.replace(/\s+/g, ' ').trim().length > 0,
  )
  if (favorites.length === 0) return null
  const avoid = new Set(avoidRecent.map((l) => l.replace(/\s+/g, ' ').trim()))
  const pool = favorites.filter(
    (f) => !avoid.has(f.content.replace(/\s+/g, ' ').trim()),
  )
  const pickFrom = pool.length > 0 ? pool : favorites
  const pick = pickFrom[Math.floor(Math.random() * pickFrom.length)]
  return pick?.content.replace(/\s+/g, ' ').trim() ?? null
}
