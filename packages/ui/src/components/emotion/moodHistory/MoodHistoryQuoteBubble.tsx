import type { ReactNode } from 'react'
import type { MoodHistoryQuoteBubbleVariant } from './moodHistoryQuoteBubbleVariants'

type MoodHistoryQuoteBubbleProps = {
  variant: MoodHistoryQuoteBubbleVariant
  children: ReactNode
  className?: string
}

function ArcDiamondFrame({ children }: { children: ReactNode }) {
  return (
    <div className="sk-mood-history-bubble__arc-wrap">
      <svg
        className="sk-mood-history-bubble__arc-svg"
        viewBox="0 0 200 120"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M 28 60 A 72 48 0 1 1 172 60"
          fill="none"
          stroke="var(--sk-accent-border-strong)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.42 0.58"
        />
        <path
          d="M 172 60 A 72 48 0 1 1 28 60"
          fill="none"
          stroke="var(--sk-accent-border-strong)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.42 0.58"
        />
        <polygon
          points="8,60 14,54 14,66"
          fill="var(--sk-accent)"
          transform="rotate(-90 11 60)"
        />
        <polygon
          points="192,60 186,54 186,66"
          fill="var(--sk-accent)"
          transform="rotate(90 189 60)"
        />
      </svg>
      <div className="sk-mood-history-bubble__arc-body">{children}</div>
    </div>
  )
}

function BubbleTail({
  side,
  align,
}: {
  side: 'left' | 'right' | 'center'
  align: 'top' | 'bottom'
}) {
  const pos =
    side === 'left'
      ? 'left-4'
      : side === 'right'
        ? 'right-4'
        : 'left-1/2 -translate-x-1/2'
  const edge = align === 'bottom' ? 'top-full' : 'bottom-full'
  const flip = align === 'bottom' ? 'rotate-0' : 'scale-y-[-1]'

  return (
    <div
      className={`pointer-events-none absolute ${pos} z-10 flex w-[18px] justify-center ${edge}`}
      aria-hidden
    >
      <svg
        width={18}
        height={11}
        viewBox="0 0 18 11"
        className={`block overflow-visible ${flip}`}
        aria-hidden
      >
        <path
          d="M 0 0 L 9 11 L 18 0 Z"
          fill="var(--sk-mood-bubble-fill, var(--sk-toast-shell-bg))"
        />
        <path
          d="M 0 0 L 9 11"
          fill="none"
          stroke="var(--sk-mood-bubble-border, var(--sk-toast-shell-border))"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <path
          d="M 18 0 L 9 11"
          fill="none"
          stroke="var(--sk-mood-bubble-border, var(--sk-toast-shell-border))"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function MoodHistoryQuoteBubble({
  variant,
  children,
  className = '',
}: MoodHistoryQuoteBubbleProps) {
  const text = (
    <span className="sk-mood-history-bubble__text">{children}</span>
  )

  switch (variant) {
    case 'companion-tail':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--companion-tail relative ${className}`}
        >
          <div className="sk-mood-history-bubble__body">{text}</div>
          <BubbleTail side="center" align="bottom" />
        </div>
      )
    case 'tail-left':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--companion-tail relative ${className}`}
        >
          <div className="sk-mood-history-bubble__body">{text}</div>
          <BubbleTail side="left" align="bottom" />
        </div>
      )
    case 'tail-right':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--companion-tail sk-mood-history-bubble--mirror relative ${className}`}
        >
          <div className="sk-mood-history-bubble__body">{text}</div>
          <BubbleTail side="right" align="bottom" />
        </div>
      )
    case 'soft-violet':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--soft-violet ${className}`}
        >
          {text}
        </div>
      )
    case 'editorial-wide':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--editorial ${className}`}
        >
          {text}
        </div>
      )
    case 'quote-bar':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--quote-bar ${className}`}
        >
          {text}
        </div>
      )
    case 'pill-chip':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--pill ${className}`}
        >
          {text}
        </div>
      )
    case 'pill-solid':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--pill-solid ${className}`}
        >
          {text}
        </div>
      )
    case 'border-card':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--border-card ${className}`}
        >
          {text}
        </div>
      )
    case 'lavender-block':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--lavender-block ${className}`}
        >
          {text}
        </div>
      )
    case 'watercolor-wash':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--watercolor ${className}`}
        >
          {text}
        </div>
      )
    case 'arc-diamond':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--arc-diamond ${className}`}
        >
          <ArcDiamondFrame>{text}</ArcDiamondFrame>
        </div>
      )
    case 'underline-accent':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--underline-accent ${className}`}
        >
          {text}
        </div>
      )
    case 'whisper-dashed':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--whisper ${className}`}
        >
          {text}
        </div>
      )
    case 'inset-card':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--inset ${className}`}
        >
          {text}
        </div>
      )
    case 'gradient-ring':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--gradient-ring ${className}`}
        >
          <div className="sk-mood-history-bubble__inner">{text}</div>
        </div>
      )
    case 'highlight-wash':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--highlight ${className}`}
        >
          {text}
        </div>
      )
    case 'closing-stamp':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--stamp ${className}`}
        >
          <span className="sk-mood-history-bubble__stamp-mark" aria-hidden>
            ◇
          </span>
          {text}
        </div>
      )
    case 'nested-echo':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--nested ${className}`}
        >
          <div className="sk-mood-history-bubble__echo-ring" aria-hidden />
          <div className="sk-mood-history-bubble__inner">{text}</div>
        </div>
      )
    case 'underline-minimal':
      return (
        <div
          className={`sk-mood-history-bubble sk-mood-history-bubble--underline ${className}`}
        >
          {text}
        </div>
      )
    default:
      return (
        <div className={`sk-mood-history-bubble sk-mood-history-bubble--soft-violet ${className}`}>
          {text}
        </div>
      )
  }
}
