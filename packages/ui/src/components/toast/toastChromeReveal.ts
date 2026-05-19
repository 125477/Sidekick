type ToastRevealGroup = 'toastbar' | 'toastbar-plain' | 'toastbar-locked'

function groupSelectors(group: ToastRevealGroup): {
  hover: string
  focusWithin: string
} {
  if (group === 'toastbar-plain') {
    return {
      hover: 'group-hover/toastbar-plain',
      focusWithin: 'group-focus-within/toastbar-plain',
    }
  }
  if (group === 'toastbar-locked') {
    return {
      hover: 'group-hover/toastbar-locked',
      focusWithin: 'group-focus-within/toastbar-locked',
    }
  }
  return {
    hover: 'group-hover/toastbar',
    focusWithin: 'group-focus-within/toastbar',
  }
}

const revealTransition = (motionEnabled: boolean) =>
  `grid min-h-0 overflow-hidden transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
    motionEnabled ? 'duration-200' : 'duration-0'
  }`

const revealedClass =
  'grid-rows-[1fr] pointer-events-auto opacity-100'

/** 挂件内嵌：悬停 group 展开。 */
export function toastCollapseRevealClass(
  motionEnabled: boolean,
  revealed: boolean,
  group: ToastRevealGroup = 'toastbar',
): string {
  const { hover, focusWithin } = groupSelectors(group)
  return `${revealTransition(motionEnabled)} ${
    revealed
      ? revealedClass
      : `grid-rows-[0fr] pointer-events-none opacity-0 ${hover}:pointer-events-auto ${hover}:grid-rows-[1fr] ${hover}:opacity-100 ${focusWithin}:pointer-events-auto ${focusWithin}:grid-rows-[1fr] ${focusWithin}:opacity-100`
  }`
}

/** 独立气泡窗：仅状态驱动；高度瞬时切换，避免 grid 动画导致窗体分两段测量。 */
export function toastDetachedRevealClass(
  motionEnabled: boolean,
  revealed: boolean,
): string {
  const opacityMotion = motionEnabled
    ? 'transition-opacity duration-150 ease-out motion-reduce:transition-none'
    : ''
  return `grid min-h-0 overflow-hidden ${opacityMotion} ${
    revealed ? revealedClass : 'grid-rows-[0fr] pointer-events-none opacity-0'
  }`
}

export function toastChromeRevealClass(
  detached: boolean,
  motionEnabled: boolean,
  revealed: boolean,
  group: ToastRevealGroup = 'toastbar',
): string {
  return detached
    ? toastDetachedRevealClass(motionEnabled, revealed)
    : toastCollapseRevealClass(motionEnabled, revealed, group)
}
