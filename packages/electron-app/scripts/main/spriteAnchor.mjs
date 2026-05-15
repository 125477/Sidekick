import { state } from './state.mjs'

export function syncLastSpriteAnchorToWindowMotion() {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return
  if (!state.spriteAnchorBase || !state.spriteBoundsAtAnchorSet) return
  const b = state.spriteWindow.getBounds()
  const dx = b.x - state.spriteBoundsAtAnchorSet.x
  const dy = b.y - state.spriteBoundsAtAnchorSet.y
  state.lastSpriteAnchor = {
    centerX: state.spriteAnchorBase.centerX + dx,
    topY: state.spriteAnchorBase.topY + dy,
    bottomY: state.spriteAnchorBase.bottomY + dy,
  }
}
