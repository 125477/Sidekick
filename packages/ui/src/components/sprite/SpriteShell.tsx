import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { useCallback, useRef } from 'react'
import type { SpriteState } from '../../state/uiState'
import { isDotLottieSrc, isVideoAvatarSrc } from '../../utils/isDotLottieSrc'
import { spriteLayoutSizePx } from './spriteLayoutSize'

type SpriteShellProps = {
  spriteState: SpriteState
  avatarSrc: string | undefined
  motionProfile: 'enhanced' | 'template' | undefined
  avatarOpacity: number
  avatarSize: number
  /** 为 true 时禁止拖动精灵热区、禁止点击形象与菜单。 */
  interactionLocked?: boolean
  /** 首次越过拖动阈值时调用（开启 overlay 拖尾，屏幕坐标）。 */
  onDragTrailStart?: (screenX: number, screenY: number) => void
  /** 拖动中上报屏幕坐标。 */
  onDragTrailPoint?: (screenX: number, screenY: number) => void
  onDragTrailEnd?: () => void
  onToggleMenu: () => void
  onStateChange: (state: SpriteState) => void
}

/** 超过该位移视为拖窗，松手不再打开菜单（Electron `moveWidgetBy`）。 */
const POINTER_DRAG_THRESHOLD_PX = 6

export function SpriteShell({
  spriteState,
  avatarSrc,
  motionProfile = 'template',
  avatarOpacity,
  avatarSize,
  interactionLocked = false,
  onDragTrailStart,
  onDragTrailPoint,
  onDragTrailEnd,
  onToggleMenu,
  onStateChange,
}: SpriteShellProps) {
  const animation = getMotionAnimation(spriteState, motionProfile)
  const isLaugh = spriteState === 'laugh'
  const isSmile = spriteState === 'hover' || spriteState === 'notify'
  const faceOpacity = motionProfile === 'enhanced' ? 0.95 : 0.55
  const layoutSizePx = spriteLayoutSizePx(avatarSize)

  const dragRef = useRef<{
    startX: number
    startY: number
    passedThreshold: boolean
  } | null>(null)
  const suppressNextClickRef = useRef(false)

  const resetDrag = () => {
    dragRef.current = null
  }

  const onSpritePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (interactionLocked) return
      if (e.button !== 0) return
      dragRef.current = { startX: e.clientX, startY: e.clientY, passedThreshold: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [interactionLocked],
  )

  const onSpritePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (interactionLocked) return
      if (!(e.buttons & 1)) return
      const st = dragRef.current
      if (!st) return
      const dx0 = e.clientX - st.startX
      const dy0 = e.clientY - st.startY
      if (!st.passedThreshold) {
        if (Math.hypot(dx0, dy0) < POINTER_DRAG_THRESHOLD_PX) return
        st.passedThreshold = true
        onDragTrailStart?.(e.screenX, e.screenY)
      } else {
        onDragTrailPoint?.(e.screenX, e.screenY)
      }
      const api = window.sidekickDesktop?.moveWidgetBy
      if (!api) return
      void api({ dx: e.movementX, dy: e.movementY })
    },
    [interactionLocked, onDragTrailStart, onDragTrailPoint],
  )

  const finishSpritePointer = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, fireMenuIfTap: boolean) => {
      if (interactionLocked) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* 未 capture 时忽略 */
      }
      const st = dragRef.current
      const wasTap = st != null && !st.passedThreshold
      const dragged = st != null && st.passedThreshold
      resetDrag()
      if (dragged) {
        suppressNextClickRef.current = true
        onDragTrailEnd?.()
      }
      if (fireMenuIfTap && wasTap) {
        suppressNextClickRef.current = true
        onStateChange('tap')
        onToggleMenu()
        window.setTimeout(() => onStateChange('idle'), 200)
      }
    },
    [interactionLocked, onDragTrailEnd, onStateChange, onToggleMenu],
  )

  const onSpriteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressNextClickRef.current) {
        e.preventDefault()
        suppressNextClickRef.current = false
        return
      }
      if (interactionLocked) return
      onStateChange('tap')
      onToggleMenu()
      window.setTimeout(() => onStateChange('idle'), 200)
    },
    [interactionLocked, onStateChange, onToggleMenu],
  )

  /**
   * Electron：`drag` 区域不派发点击，无法在同一像素上既拖窗又点菜单。
   * 外层保留 `drag` 作窄环；形象区 `no-drag` + 主进程 `moveWidgetBy`（见 `pointer*`）实现整块拖移且可点出菜单。
   */
  return (
    <div
      className={`inline-flex items-center justify-center  outline-none ${
        interactionLocked
          ? 'pointer-events-none cursor-default [-webkit-app-region:no-drag]'
          : '[-webkit-app-region:drag]'
      }`}
      style={{ width: layoutSizePx, height: layoutSizePx }}
    >
      <div className="relative h-full w-full">
        <button
          type="button"
          data-sprite-menu-trigger
          disabled={interactionLocked}
          onPointerDown={onSpritePointerDown}
          onPointerMove={onSpritePointerMove}
          onPointerUp={(e) => finishSpritePointer(e, true)}
          onPointerCancel={(e) => finishSpritePointer(e, false)}
          onClick={onSpriteClick}
          onMouseEnter={() => {
            if (!interactionLocked) onStateChange('hover')
          }}
          onMouseLeave={() => {
            if (!interactionLocked) onStateChange('idle')
          }}
          className={`relative h-full w-full cursor-pointer overflow-hidden outline-none motion-reduce:transition-none focus:outline-none focus-visible:outline-none [-webkit-app-region:no-drag] disabled:cursor-default ${
            interactionLocked ? 'pointer-events-none' : ''
          }`}
          style={{ animation }}
          aria-label="精灵热区"
        >
          <style>{`
          @keyframes sprite-idle-breathe {
            0%,100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-2px) scale(1.03); }
          }
          @keyframes sprite-hover-float {
            0%,100% { transform: translateY(-4px) scale(1.02); }
            50% { transform: translateY(-8px) scale(1.04); }
          }
          @keyframes sprite-jump {
            0% { transform: translateY(0) scale(1); }
            30% { transform: translateY(-18px) scale(1.04); }
            60% { transform: translateY(0) scale(0.97); }
            100% { transform: translateY(0) scale(1); }
          }
          @keyframes sprite-wave {
            0%,100% { transform: rotate(0deg) translateY(0); }
            25% { transform: rotate(-4deg) translateY(-2px); }
            50% { transform: rotate(4deg) translateY(-2px); }
            75% { transform: rotate(-3deg) translateY(-1px); }
          }
          @keyframes sprite-laugh {
            0%,100% { transform: scale(1) translateY(0); }
            25% { transform: scale(1.05,0.95) translateY(1px); }
            50% { transform: scale(0.95,1.04) translateY(-1px); }
            75% { transform: scale(1.04,0.96) translateY(1px); }
          }
          @keyframes sprite-stretch {
            0%,100% { transform: scale(1,1); }
            40% { transform: scale(1.08,0.94) translateY(1px); }
            70% { transform: scale(0.96,1.05) translateY(-1px); }
          }
          @keyframes sprite-notify {
            0%,100% { transform: translateY(0) scale(1); }
            20% { transform: translateY(-6px) scale(1.04); }
            45% { transform: translateY(0) scale(0.98); }
            70% { transform: translateY(-3px) scale(1.02); }
          }
        `}</style>
          {avatarSrc ? (
            isVideoAvatarSrc(avatarSrc) ? (
              <video
                key={avatarSrc}
                src={avatarSrc}
                className="h-full w-full object-contain"
                style={{
                  opacity: Math.min(1, Math.max(0.4, avatarOpacity / 100)),
                }}
                muted
                playsInline
                loop
                autoPlay
                aria-label="当前形象"
              />
            ) : isDotLottieSrc(avatarSrc) ? (
              <div
                className="relative h-full w-full [&_.dotlottie-react]:h-full [&_.dotlottie-react]:w-full"
                style={{
                  opacity: Math.min(1, Math.max(0.4, avatarOpacity / 100)),
                }}
              >
                <DotLottieReact
                  key={avatarSrc}
                  src={avatarSrc}
                  loop
                  autoplay
                  layout={{ fit: 'contain' }}
                />
              </div>
            ) : (
              <>
                <img
                  src={avatarSrc}
                  alt="当前形象"
                  className="h-full w-full object-contain"
                  style={{
                    opacity: Math.min(1, Math.max(0.4, avatarOpacity / 100)),
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ opacity: faceOpacity }}
                >
                  <span
                    className={`absolute left-1/2 top-[39%] -translate-x-1/2 rounded-full border-b-2 border-[#6d3f3f] transition-all duration-200 ${
                      isLaugh
                        ? 'h-3 w-5 border-2 border-[#6d3f3f] bg-[#f8b4b4]'
                        : isSmile
                          ? 'h-1.5 w-4'
                          : 'h-1 w-3'
                    }`}
                  />
                </div>
              </>
            )
          ) : (
            <span className="text-4xl">🫧</span>
          )}
        </button>
      </div>
    </div>
  )
}

function getMotionAnimation(
  state: SpriteState,
  profile: 'enhanced' | 'template',
): string {
  if (state === 'hover') return 'sprite-hover-float 0.45s ease-in-out infinite'
  if (state === 'tap' || state === 'jump') return 'sprite-jump 0.7s ease-out 1'
  if (state === 'notify' || state === 'wave')
    return profile === 'enhanced'
      ? 'sprite-wave 0.9s ease-in-out 1'
      : 'sprite-notify 0.9s ease-in-out 1'
  if (state === 'laugh')
    return profile === 'enhanced'
      ? 'sprite-laugh 1s ease-in-out 1'
      : 'sprite-notify 0.9s ease-in-out 1'
  if (state === 'stretch')
    return profile === 'enhanced'
      ? 'sprite-stretch 1s ease-in-out 1'
      : 'sprite-hover-float 0.7s ease-in-out 1'
  return 'sprite-idle-breathe 3s ease-in-out infinite'
}
