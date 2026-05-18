import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

// EmotionToastHoverTip 暂时不用；工具栏仍保留本文件内 portal 悬停提示。

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
  dataSpriteMenuTrigger?: boolean
  spriteMenuDetachedAnchor?: boolean
  domId?: string
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })
  const tipPosRafRef = useRef<number | null>(null)

  const updateTipPos = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTipPos({ x: r.left + r.width / 2, y: r.top })
  }

  const scheduleTipPosUpdate = () => {
    if (tipPosRafRef.current != null) return
    tipPosRafRef.current = window.requestAnimationFrame(() => {
      tipPosRafRef.current = null
      updateTipPos()
    })
  }

  useEffect(() => {
    if (!tipOpen) return
    updateTipPos()
    const onMove = () => scheduleTipPosUpdate()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
      if (tipPosRafRef.current != null) {
        window.cancelAnimationFrame(tipPosRafRef.current)
        tipPosRafRef.current = null
      }
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
        className="sk-toast-clickable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/50 disabled:cursor-wait disabled:opacity-40"
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
