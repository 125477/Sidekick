import { SIDEKICK_MORE_FEATURES_PLACEHOLDER } from '../constants/toastCopy'

export function isMeaningfulCompanionLine(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length >= 2 && normalized !== SIDEKICK_MORE_FEATURES_PLACEHOLDER
}

/** 屏上是否已有有效陪伴文案（Electron 以主进程独立气泡为准）。 */
export async function isCompanionCopyOnScreen(opts?: {
  toastVisible?: boolean
  toastMessage?: string
}): Promise<boolean> {
  if (window.sidekickDesktop?.isCompanionToastVisible) {
    return (await window.sidekickDesktop.isCompanionToastVisible()) === true
  }
  return Boolean(
    opts?.toastVisible && isMeaningfulCompanionLine(opts?.toastMessage ?? ''),
  )
}
