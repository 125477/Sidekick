/** 单行 ≤16 字视为短句：文案/轻反馈居中、灰底铺满；更长或换行则左对齐 hug 内容。 */
export const COMPACT_TOAST_CHAR_MAX = 16

export function isCompactToastMessage(message: string): boolean {
  const t = message.trim()
  if (!t || t.includes('\n')) return false
  return t.length <= COMPACT_TOAST_CHAR_MAX
}

export function resolveCompactMessageLayout(
  message: string,
  opts?: { introMode?: boolean },
): boolean {
  if (opts?.introMode) return false
  return isCompactToastMessage(message)
}

export function toastMessageChromeClass(
  compact: boolean,
  regenerating: boolean,
): string {
  if (regenerating) return 'w-full'
  if (compact) return 'w-full self-stretch'
  return 'w-fit max-w-full self-start'
}

export function toastMessageInnerClass(compact: boolean): string {
  return `flex w-full min-w-0 max-w-full flex-col ${
    compact ? 'items-center' : 'items-start'
  }`
}

export function toastBarGroupClass(compact: boolean, groupName: string): string {
  return `${groupName} flex w-full min-w-0 flex-col ${
    compact ? 'items-center' : 'items-start'
  }`
}

export function toastMessageCellWrapClass(_compact: boolean): string {
  return 'sk-toast-message-cell min-w-0 w-full max-w-full shrink rounded-md px-0.5 py-0.5 motion-reduce:transition-none'
}

export function toastMessageTextClass(compact: boolean, multiline: boolean): string {
  return `block min-w-0 max-w-full whitespace-normal break-words px-0.5 py-0.5 ${
    compact ? 'w-full text-center' : 'w-auto text-left'
  } ${multiline ? 'whitespace-pre-wrap leading-relaxed' : ''}`
}
