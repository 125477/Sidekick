import { screen } from 'electron'
import { clamp } from './geometry.mjs'
import {
  SPRITE_SIZE,
  TOAST_GAP,
  TOAST_WINDOW_WIDTH,
  TOAST_WINDOW_HEIGHT,
  WIDGET_PAD_BOTTOM,
} from './constants.mjs'
import { state } from './state.mjs'
import { syncLastSpriteAnchorToWindowMotion } from './spriteAnchor.mjs'

function getSpriteVerticalExtent(spriteBounds) {
  const spriteBottomY = spriteBounds.y + spriteBounds.height - WIDGET_PAD_BOTTOM
  const spriteTopY = spriteBottomY - SPRITE_SIZE
  return { spriteTopY, spriteBottomY }
}

/**
 * Places the toast vs the sprite box (not the widget window top edge).
 * Returns screen coordinates and an effective anchor for tail direction when falling back.
 */
export function computeToastPlacement(preferredAnchor, toastH = TOAST_WINDOW_HEIGHT) {
  if (!state.spriteWindow || state.spriteWindow.isDestroyed()) return null
  syncLastSpriteAnchorToWindowMotion()
  const spriteBounds = state.spriteWindow.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: spriteBounds.x + spriteBounds.width / 2,
    y: spriteBounds.y + spriteBounds.height / 2,
  })
  const { x: workX, y: workY, height: workH } = display.workArea
  const pct =
    Number.isFinite(state.lastAvatarSizePercent) && state.lastAvatarSizePercent > 0
      ? state.lastAvatarSizePercent
      : 80
  const gap = TOAST_GAP * (pct / 80)
  const maxY = workY + workH - toastH
  let centerX
  let spriteTopY
  let spriteBottomY

  if (state.lastSpriteAnchor) {
    centerX = state.lastSpriteAnchor.centerX
    spriteTopY = state.lastSpriteAnchor.topY
    spriteBottomY = state.lastSpriteAnchor.bottomY
  } else {
    const extent = getSpriteVerticalExtent(spriteBounds)
    spriteTopY = extent.spriteTopY
    spriteBottomY = extent.spriteBottomY
    /** Matches widget `pr-3`: sprite sits against the bottom-right of the window. */
    const PAD_R = 12
    const spriteRight = spriteBounds.x + spriteBounds.width - PAD_R
    const spriteLeft = spriteRight - SPRITE_SIZE
    centerX = (spriteLeft + spriteRight) / 2
  }

  let x = centerX - TOAST_WINDOW_WIDTH / 2

  let y
  let effectiveAnchor = preferredAnchor

  if (preferredAnchor === 'top') {
    y = spriteTopY - toastH - gap
    if (y < workY) {
      effectiveAnchor = 'bottom'
      y = spriteBottomY + gap
      if (y > maxY) {
        effectiveAnchor = 'top'
        y = clamp(spriteTopY - toastH - gap, workY, maxY)
      } else {
        y = clamp(y, workY, maxY)
      }
    } else {
      y = clamp(y, workY, maxY)
    }
  } else {
    y = spriteBottomY + gap
    if (y > maxY) {
      effectiveAnchor = 'top'
      y = spriteTopY - toastH - gap
      if (y < workY) {
        effectiveAnchor = 'bottom'
        y = clamp(spriteBottomY + gap, workY, maxY)
      } else {
        y = clamp(y, workY, maxY)
      }
    } else {
      y = clamp(y, workY, maxY)
    }
  }

  /**
   * 水平方向与精灵锚点对齐，不再强夹在工作区内：精灵贴屏幕左右时气泡应跟着移，
   * 允许约一半被屏幕裁切（与挂件窗体被裁切一致）。竖直方向仍 clamp 在工作区内。
   *
   * 尾巴方向必须与「最终 y」一致。独立气泡窗含 padding/工具栏，整窗高度远大于白卡片，
   * 用窗体中点与精灵中点比会误判；用「窗底 vs 精灵顶 / 窗顶 vs 精灵底」为主，重叠时再回退到中点。
   */
  const toastBottom = y + toastH
  const toastTop = y
  const gapTol = Math.max(8, Math.round(gap * 0.4))
  const spriteMidY = (spriteTopY + spriteBottomY) / 2
  const toastMidY = toastTop + toastH / 2

  const toastStackAboveSprite = toastBottom <= spriteTopY + gapTol
  const toastStackBelowSprite = toastTop >= spriteBottomY - gapTol

  if (toastStackAboveSprite && !toastStackBelowSprite) {
    effectiveAnchor = 'top'
  } else if (toastStackBelowSprite && !toastStackAboveSprite) {
    effectiveAnchor = 'bottom'
  } else {
    effectiveAnchor = toastMidY < spriteMidY ? 'top' : 'bottom'
  }

  return { x, y, effectiveAnchor }
}
