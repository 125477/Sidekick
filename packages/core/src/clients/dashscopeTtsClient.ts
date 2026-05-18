/**
 * DashScope 云端 TTS（千问 TTS 走 multimodal-generation；CosyVoice 走 SpeechSynthesizer）。
 */
import {
  type DashScopeTtsModel,
  usesQwenMultimodalTtsApi,
} from '../constants/dashscopeTtsModels'

export type { DashScopeTtsModel } from '../constants/dashscopeTtsModels'
export { DEFAULT_QWEN_TTS_MODEL } from '../constants/dashscopeTtsModels'

export type DashScopeTtsRequest = {
  apiKey: string
  model: DashScopeTtsModel
  text: string
  /** Qwen 系统音色名（如 Cherry）；CosyVoice v3.5 多为声音设计/复刻返回的 voice id */
  voice: string
  languageType?: string
  speechRate?: number
  requestBasePath?: string
}

const BEIJING_ORIGIN = 'https://dashscope.aliyuncs.com'
const MULTIMODAL_PATH =
  '/api/v1/services/aigc/multimodal-generation/generation'
const SPEECH_SYNTH_PATH = '/api/v1/services/audio/tts/SpeechSynthesizer'

function joinBase(base: string, path: string): string {
  const b = base.replace(/\/$/, '')
  return `${b}${path}`
}

function extractMultimodalAudioUrl(data: unknown): string {
  const d = data as {
    output?: { audio?: { url?: string } }
  }
  const url = d?.output?.audio?.url
  if (typeof url === 'string' && url.startsWith('http')) return url
  throw new Error('DashScope TTS: multimodal response missing output.audio.url')
}

function extractSpeechSynthPayload(data: unknown): {
  url?: string
  base64?: string
} {
  const d = data as {
    output?: {
      audio?:
        | string
        | {
            url?: string
            data?: string
          }
    }
  }
  const aud = d?.output?.audio
  if (typeof aud === 'string') return { base64: aud }
  if (aud && typeof aud === 'object') {
    if (typeof aud.url === 'string') return { url: aud.url }
    if (typeof aud.data === 'string') return { base64: aud.data }
  }
  throw new Error('DashScope TTS: SpeechSynthesizer response missing audio')
}

function decodeBase64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

/** DashScope TTS 返回的 OSS 结果音频 URL（浏览器需经同源代理，避免 CORS）。 */
export function isAllowedDashScopeResultAudioUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return host.endsWith('.aliyuncs.com') || host.includes('dashscope')
  } catch {
    return false
  }
}

function originFromRequestBasePath(requestBasePath: string): string | undefined {
  try {
    return new URL(requestBasePath).origin
  } catch {
    return undefined
  }
}

function dashscopeAudioProxyUrl(origin: string, targetUrl: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/dashscope-audio?target=${encodeURIComponent(targetUrl)}`
}

/** 供 `<audio src>` 播放：dev 走同源代理，Electron 可用 OSS 直链。 */
export function resolveDashScopeAudioPlaybackUrl(
  audioUrl: string,
  requestBasePath?: string,
): string {
  const base = requestBasePath?.trim()
  if (base) {
    const origin = originFromRequestBasePath(base)
    if (origin && isAllowedDashScopeResultAudioUrl(audioUrl)) {
      return dashscopeAudioProxyUrl(origin, audioUrl)
    }
  }
  return audioUrl
}

export type DashScopeTtsSynthesisResult =
  | { kind: 'url'; remoteUrl: string }
  | { kind: 'buffer'; data: ArrayBuffer }

async function synthesizeQwenMultimodalTts(
  input: DashScopeTtsRequest,
  modelId: string,
): Promise<DashScopeTtsSynthesisResult> {
  const voice = input.voice.trim()
  if (!voice) throw new Error(`Missing voice for ${modelId}`)

  const base = input.requestBasePath?.trim() || BEIJING_ORIGIN
  const res = await fetch(joinBase(base, MULTIMODAL_PATH), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      input: {
        text: input.text.trim(),
        voice,
        language_type: input.languageType ?? 'Chinese',
      },
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(
      `DashScope TTS ${res.status} (model=${modelId})${raw ? `: ${raw.slice(0, 320)}` : ''}`,
    )
  }
  let data: unknown
  try {
    data = JSON.parse(raw) as unknown
  } catch {
    throw new Error('DashScope TTS: invalid JSON body')
  }
  const audioUrl = extractMultimodalAudioUrl(data)
  return { kind: 'url', remoteUrl: audioUrl }
}

/** TTS 结果：优先返回 OSS 直链供 `<audio>` 播放；内联 base64/二进制时返回 buffer。 */
export async function synthesizeDashScopeTts(
  input: DashScopeTtsRequest,
): Promise<DashScopeTtsSynthesisResult> {
  const key = input.apiKey.trim()
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY')
  const text = input.text.trim()
  if (!text) throw new Error('Empty TTS text')

  if (usesQwenMultimodalTtsApi(input.model)) {
    return synthesizeQwenMultimodalTts(input, input.model)
  }

  const voice = input.voice.trim()
  if (!voice) {
    throw new Error(
      'Missing voice for cosyvoice-v3.5-flash (configure VITE_DASHSCOPE_TTS_VOICE)',
    )
  }

  const base = input.requestBasePath?.trim() || BEIJING_ORIGIN
  const rate =
    typeof input.speechRate === 'number' && Number.isFinite(input.speechRate)
      ? Math.min(2, Math.max(0.5, input.speechRate))
      : 1

  const res = await fetch(joinBase(base, SPEECH_SYNTH_PATH), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'cosyvoice-v3.5-flash',
      input: {
        text,
        voice,
        format: 'mp3',
        sample_rate: 24000,
        rate,
      },
    }),
  })

  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json') || ct.includes('json')) {
    const raw = await res.text()
    if (!res.ok) {
      throw new Error(
        `DashScope TTS ${res.status}${raw ? `: ${raw.slice(0, 320)}` : ''}`,
      )
    }
    let data: unknown
    try {
      data = JSON.parse(raw) as unknown
    } catch {
      throw new Error('DashScope TTS: invalid JSON body')
    }
    const { url, base64 } = extractSpeechSynthPayload(data)
    if (base64) return { kind: 'buffer', data: decodeBase64ToArrayBuffer(base64) }
    if (url) return { kind: 'url', remoteUrl: url }
    throw new Error('DashScope TTS: could not parse SpeechSynthesizer JSON')
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `DashScope TTS ${res.status}${errText ? `: ${errText.slice(0, 320)}` : ''}`,
    )
  }
  return { kind: 'buffer', data: await res.arrayBuffer() }
}
