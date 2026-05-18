type ToastRevealGroup = 'toastbar' | 'toastbar-plain'

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
  return {
    hover: 'group-hover/toastbar',
    focusWithin: 'group-focus-within/toastbar',
  }
}

/** 悬停时 grid 展开；独立窗配合 debounce 缩窗 + 顶边锚定，避免抖动。 */
export function toastCollapseRevealClass(
  motionEnabled: boolean,
  revealed: boolean,
  group: ToastRevealGroup = 'toastbar',
): string {
  const { hover, focusWithin } = groupSelectors(group)
  return `grid min-h-0 overflow-hidden transition-[grid-template-rows,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
    motionEnabled ? 'duration-200' : 'duration-0'
  } ${
    revealed
      ? 'grid-rows-[1fr] pointer-events-auto opacity-100'
      : `grid-rows-[0fr] pointer-events-none opacity-0 ${hover}:pointer-events-auto ${hover}:grid-rows-[1fr] ${hover}:opacity-100 ${focusWithin}:pointer-events-auto ${focusWithin}:grid-rows-[1fr] ${focusWithin}:opacity-100`
  }`
}
