/** 收藏再现：同一句再次抽中前的最短间隔（天）。 */
export const FAVORITE_RESURFACE_COOLDOWN_DAYS = 3

export const FAVORITE_RESURFACE_COOLDOWN_MS =
  FAVORITE_RESURFACE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000

/** 是否在冷却期内（再现后 N 天内不可再抽同句）。 */
export function isFavoriteResurfaceCooldownActive(
  lastResurfacedAt: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastResurfacedAt) return false
  const t = Date.parse(lastResurfacedAt)
  if (!Number.isFinite(t)) return false
  return now.getTime() - t < FAVORITE_RESURFACE_COOLDOWN_MS
}
