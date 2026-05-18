/**
 * 暂时未引用（文案/工具栏已解耦）。恢复时接回 EmotionToastMessageCell / EmotionToastToolbarButton。
 */
import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'

export function buildRegenerateMessageHoverTip(maxChars?: number): string {
  return maxChars != null
    ? `点击换一句（不超过 ${maxChars} 个字）`
    : '点击换一句'
}

type EmotionToastHoverTipTargetProps = {
  title: string
  disabled?: boolean
  children: (props: {
    ref: Ref<HTMLElement>
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: () => void
    onBlur: () => void
  }) => ReactElement
}

/** 与工具栏图标一致的悬停提示（portal，避免 Electron 下原生 title 不显示）。 */
export function EmotionToastHoverTipTarget({
  title,
  disabled = false,
  children,
}: EmotionToastHoverTipTargetProps) {
  const anchorRef = useRef<HTMLElement | null>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })
  const tipPosRafRef = useRef<number | null>(null)

  const updateTipPos = () => {
    const el = anchorRef.current
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
      {children({
        ref: (node) => {
          anchorRef.current = node
        },
        onMouseEnter: showTip,
        onMouseLeave: hideTip,
        onFocus: showTip,
        onBlur: hideTip,
      })}
      {tipOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <EmotionToastHoverTipPortal title={title} tipPos={tipPos} />,
          document.body,
        )}
    </>
  )
}

function EmotionToastHoverTipPortal({
  title,
  tipPos,
}: {
  title: string
  tipPos: { x: number; y: number }
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[9999] max-w-[min(240px,90vw)] -translate-x-1/2 -translate-y-full whitespace-normal rounded-md bg-slate-800/95 px-2 py-1 text-left text-[11px] font-medium leading-snug text-white shadow-lg motion-reduce:transition-none"
      style={{ left: tipPos.x, top: tipPos.y - 6 }}
    >
      {title}
    </div>
  )
}
