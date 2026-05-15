import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export function EmotionToastToolbarIconButton({
  title,
  ariaLabel,
  disabled,
  onClick,
  children,
  dataSpriteMenuTrigger = false,
  spriteMenuDetachedAnchor = false,
  domId,
}: {
  title: string
  ariaLabel: string
  disabled?: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
  /** 与 `SpriteShell` 一致：菜单打开时点此处不触发 `SpriteMenu` 外层 pointer 捕获关闭。 */
  dataSpriteMenuTrigger?: boolean
  /** Electron 独立菜单窗：`App` 用此锚点测量屏幕坐标（避免与精灵共用 `querySelector` 命中顺序问题）。 */
  spriteMenuDetachedAnchor?: boolean
  /** 独立气泡窗：`App` 内 `getElementById` 定位菜单锚点，避免 `data-*` 选择器偶发未命中。 */
  domId?: string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })

  const updateTipPos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({ x: r.left + r.width / 2, y: r.top })
  }

  useEffect(() => {
    if (!tipOpen) return
    updateTipPos()
    const onMove = () => updateTipPos()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [tipOpen])

  const showTip = () => {
    if (disabled) return
    updateTipPos()
    setTipOpen(true)
  }
  const hideTip = () => setTipOpen(false)

  return (
    <>
      <button
        ref={btnRef}
        id={domId}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        {...(dataSpriteMenuTrigger ? { 'data-sprite-menu-trigger': '' } : {})}
        {...(spriteMenuDetachedAnchor
          ? { 'data-sprite-menu-anchor': 'toast-toolbar' }
          : {})}
        onClick={onClick}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50 disabled:cursor-wait disabled:opacity-40 [-webkit-app-region:no-drag]"
      >
        {children}
      </button>
      {tipOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] max-w-[min(240px,90vw)] -translate-x-1/2 -translate-y-full whitespace-normal rounded-md bg-slate-800/95 px-2 py-1 text-left text-[11px] font-medium leading-snug text-white shadow-lg motion-reduce:transition-none"
            style={{ left: tipPos.x, top: tipPos.y - 6 }}
          >
            {title}
          </div>,
          document.body,
        )}
    </>
  )
}
