/** 陪伴播报默认 TTS（控制台有免费额度的千问 TTS 快照）。 */
export const DEFAULT_QWEN_TTS_MODEL = 'qwen-tts-2025-05-22' as const

export type DashScopeTtsModel =
  | typeof DEFAULT_QWEN_TTS_MODEL
  | 'qwen3-tts-flash'
  | 'cosyvoice-v3.5-flash'

const QWEN_MULTIMODAL_TTS = new Set<string>([
  DEFAULT_QWEN_TTS_MODEL,
  'qwen3-tts-flash',
])

/** 走 multimodal-generation HTTP，支持 Cherry 等系统音色。 */
export function usesQwenMultimodalTtsApi(model: string): boolean {
  return QWEN_MULTIMODAL_TTS.has(model)
}

export function parseDashScopeTtsModelFromEnv(
  raw: string | undefined,
): DashScopeTtsModel | undefined {
  const m = raw?.trim()
  if (
    m === DEFAULT_QWEN_TTS_MODEL ||
    m === 'qwen3-tts-flash' ||
    m === 'cosyvoice-v3.5-flash'
  ) {
    return m
  }
  return undefined
}
