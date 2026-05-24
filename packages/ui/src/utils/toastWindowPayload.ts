import type { SidekickSettings } from '../state/settingsState'
import type { SidekickToastAnchor } from '../types/electron'

export type ShowToastWindowPayloadInput = {
  message: string
  anchor: SidekickToastAnchor
  dwellSeconds: number
  textId?: string
  favorite?: boolean
  toastIntro?: boolean
}

export type BuildShowToastWindowPayloadOpts = {
  /** 显式覆盖 URL 中的 autoTts（用于 intro / 收藏刷新等必须静音的场景）。 */
  autoTts?: boolean
}

/** 打开独立气泡时带上 autoTts，气泡窗只认 URL 参数，避免设置未 hydrate 误播报。 */
export function buildShowToastWindowPayload(
  settings: SidekickSettings,
  input: ShowToastWindowPayloadInput,
  opts?: BuildShowToastWindowPayloadOpts,
): ShowToastWindowPayloadInput & { autoTts: boolean } {
  const autoTts =
    typeof opts?.autoTts === 'boolean'
      ? opts.autoTts
      : settings.companionTtsEnabled === true
  return {
    ...input,
    autoTts,
  }
}
