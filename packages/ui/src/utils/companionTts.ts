import {
  synthesizeDashScopeTts,
  type DashScopeTtsModel,
} from '@sidekick/core'

export type CompanionTtsOptions = {
  enabled: boolean
  model?: DashScopeTtsModel
  voice?: string
  speechRate?: number
}

let playingAudio: HTMLAudioElement | null = null
let playingObjectUrl: string | null = null

export function stopCompanionSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  if (playingAudio) {
    playingAudio.pause()
    playingAudio.removeAttribute('src')
    playingAudio.load()
    playingAudio = null
  }
  if (playingObjectUrl) {
    URL.revokeObjectURL(playingObjectUrl)
    playingObjectUrl = null
  }
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function resolveTtsModel(override?: DashScopeTtsModel): DashScopeTtsModel {
  if (override === 'cosyvoice-v3.5-flash' || override === 'qwen3-tts-flash') {
    return override
  }
  const raw = import.meta.env.VITE_DASHSCOPE_TTS_MODEL as string | undefined
  const m = raw?.trim()
  if (m === 'cosyvoice-v3.5-flash' || m === 'qwen3-tts-flash') return m
  return 'qwen3-tts-flash'
}

function resolveVoice(model: DashScopeTtsModel, override?: string): string {
  const fromSettings = override?.trim()
  if (fromSettings) return fromSettings
  const v = import.meta.env.VITE_DASHSCOPE_TTS_VOICE?.trim()
  if (v) return v
  return model === 'qwen3-tts-flash' ? 'Cherry' : ''
}

function parseSpeechRate(override?: number): number | undefined {
  if (override != null && Number.isFinite(override)) {
    return Math.min(2, Math.max(0.5, override))
  }
  const raw = import.meta.env.VITE_DASHSCOPE_TTS_RATE as string | undefined
  if (!raw?.trim()) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? Math.min(2, Math.max(0.5, n)) : undefined
}

/** Dev：走 Vite `/dashscope` 代理，避免浏览器直连跨域 */
function dashscopeRequestBase(): string | undefined {
  if (typeof window === 'undefined') return undefined
  if (
    import.meta.env.DEV &&
    (window.location.protocol === 'http:' ||
      window.location.protocol === 'https:')
  ) {
    return `${window.location.origin}/dashscope`
  }
  return undefined
}

/**
 * 使用 DashScope 云端 TTS（qwen3-tts-flash / cosyvoice-v3.5-flash），播放 mp3。
 * 模型 / 音色 / 语速优先使用设置里传入的 options，其次读 Vite 环境变量。
 */
export async function speakCompanionLine(
  text: string,
  options: CompanionTtsOptions,
): Promise<void> {
  if (!options.enabled || !text?.trim()) return

  stopCompanionSpeech()

  const apiKey = import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined
  if (!apiKey?.trim()) {
    console.warn(
      'Sidekick TTS: missing VITE_DASHSCOPE_API_KEY — skipping playback.',
    )
    return
  }

  const model = resolveTtsModel(options.model)
  const voice = resolveVoice(model, options.voice)
  const speechRate = parseSpeechRate(options.speechRate)

  const trimmed = text.trim()
  const ttsBase = {
    apiKey,
    model,
    text: trimmed,
    voice,
    languageType: 'Chinese' as const,
  }

  try {
    let buf: ArrayBuffer
    if (window.sidekickDesktop?.dashscopeTts) {
      const r = await window.sidekickDesktop.dashscopeTts({
        ...ttsBase,
        ...(speechRate !== undefined ? { speechRate } : {}),
      })
      buf = base64ToArrayBuffer(r.base64)
    } else {
      const req = {
        ...ttsBase,
        ...(speechRate !== undefined ? { speechRate } : {}),
      }
      const basePath = dashscopeRequestBase()
      buf = await synthesizeDashScopeTts(
        basePath !== undefined ? { ...req, requestBasePath: basePath } : req,
      )
    }

    const blob = new Blob([buf], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    playingObjectUrl = url
    const audio = new Audio(url)
    playingAudio = audio
    const cleanup = () => {
      if (playingObjectUrl === url) {
        URL.revokeObjectURL(url)
        playingObjectUrl = null
      }
      if (playingAudio === audio) playingAudio = null
    }
    audio.addEventListener('ended', cleanup)
    audio.addEventListener('error', cleanup)
    try {
      await audio.play()
    } catch {
      cleanup()
    }
  } catch (e) {
    console.warn('Sidekick TTS failed', e)
  }
}
