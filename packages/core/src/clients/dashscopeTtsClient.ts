/**
 * DashScope 云端 TTS（Qwen3-TTS-Flash 用多模态生成；CosyVoice 用 SpeechSynthesizer HTTP）。
 * 与 {@link requestDashScopeText} 一样，开发环境可经 Vite 代理 `requestBasePath` 同源访问。
 */

export type DashScopeTtsModel = 'qwen3-tts-flash' | 'cosyvoice-v3.5-flash'

export type DashScopeTtsRequest = {
  apiKey: string
  model: DashScopeTtsModel
  text: string
  /** Qwen 系统音色名（如 Cherry）；CosyVoice v3.5 多为声音设计/复刻返回的 voice id */
  voice: string
  /** Qwen 多模态接口使用 */
  languageType?: string
  /** CosyVoice SpeechSynthesizer：`rate` 语速 0.5–2 */
  speechRate?: number
  /**
   * 例如 Dev：`${origin}/dashscope` → 请求发到同源 `/dashscope/api/v1/...`
   * 不传则直连 `https://dashscope.aliyuncs.com`
   */
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

/** 返回音频二进制（多为 mp3），供 Web Audio / `<audio>` 播放 */
export async function synthesizeDashScopeTts(
  input: DashScopeTtsRequest,
): Promise<ArrayBuffer> {
  const key = input.apiKey.trim()
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY')
  const text = input.text.trim()
  if (!text) throw new Error('Empty TTS text')

  const base = input.requestBasePath?.trim() || BEIJING_ORIGIN
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  if (input.model === 'qwen3-tts-flash') {
    const voice = input.voice.trim()
    if (!voice) throw new Error('Missing voice for qwen3-tts-flash')

    const res = await fetch(joinBase(base, MULTIMODAL_PATH), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'qwen3-tts-flash',
        input: {
          text,
          voice,
          language_type: input.languageType ?? 'Chinese',
        },
      }),
    })

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
    const audioUrl = extractMultimodalAudioUrl(data)
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      throw new Error(`DashScope TTS: failed to download audio (${audioRes.status})`)
    }
    return await audioRes.arrayBuffer()
  }

  /** cosyvoice-v3.5-flash：非实时 SpeechSynthesizer HTTP */
  const voice = input.voice.trim()
  if (!voice) {
    throw new Error(
      'Missing voice for cosyvoice-v3.5-flash (configure VITE_DASHSCOPE_TTS_VOICE — often a clone/design voice id)',
    )
  }

  const rate =
    typeof input.speechRate === 'number' &&
    Number.isFinite(input.speechRate)
      ? Math.min(2, Math.max(0.5, input.speechRate))
      : 1

  const res = await fetch(joinBase(base, SPEECH_SYNTH_PATH), {
    method: 'POST',
    headers,
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
    if (base64) return decodeBase64ToArrayBuffer(base64)
    if (url) {
      const ar = await fetch(url)
      if (!ar.ok) throw new Error(`DashScope TTS: failed to fetch audio URL`)
      return await ar.arrayBuffer()
    }
    throw new Error('DashScope TTS: could not parse SpeechSynthesizer JSON')
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `DashScope TTS ${res.status}${errText ? `: ${errText.slice(0, 320)}` : ''}`,
    )
  }
  return await res.arrayBuffer()
}
