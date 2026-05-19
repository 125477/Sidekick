/** SVG tails avoid border-hack rotated squares (visible diamond seam) with backdrop-blur / translucent cards. */
export function EmotionToastTail({ pointsDown }: { pointsDown: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 z-10 flex w-[18px] -translate-x-1/2 justify-center ${
        pointsDown ? 'top-full' : 'bottom-full'
      }`}
      aria-hidden
    >
      <svg
        width={18}
        height={11}
        viewBox="0 0 18 11"
        className={`block origin-center overflow-visible ${
          pointsDown ? 'rotate-0' : 'scale-y-[-1]'
        }`}
        aria-hidden
      >
        <path d="M 0 0 L 9 11 L 18 0 Z" fill="var(--sk-toast-shell-bg)" />
        <path
          d="M 0 0 L 9 11"
          fill="none"
          stroke="var(--sk-toast-shell-border)"
          strokeWidth={1}
          strokeLinecap="round"
        />
        <path
          d="M 18 0 L 9 11"
          fill="none"
          stroke="var(--sk-toast-shell-border)"
          strokeWidth={1}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
