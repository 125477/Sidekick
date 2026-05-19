/** Matches SpriteShell design box at 100% (`h-36` = 9rem). */
export const SPRITE_LAYOUT_BASE_PX = 144

export function spriteLayoutScale(avatarSizePercent: number): number {
  return Math.max(0.6, avatarSizePercent / 100)
}

export function spriteLayoutSizePx(avatarSizePercent: number): number {
  return Math.round(SPRITE_LAYOUT_BASE_PX * spriteLayoutScale(avatarSizePercent))
}
