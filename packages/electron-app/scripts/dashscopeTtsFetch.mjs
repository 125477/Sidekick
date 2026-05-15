/**
 * Electron 主进程拉取 DashScope TTS（与 packages/core `dashscopeTtsClient` 保持同步）。
 */
const BEIJING_ORIGIN = 'https://dashscope.aliyuncs.com'
const MULTIMODAL_PATH =
  '/api/v1/services/aigc/multimodal-generation/generation'
const SPEECH_SYNTH_PATH = '/api/v1/services/audio/tts/SpeechSynthesizer'

function joinBase(base, path) {
  const b = String(base).replace(/\/$/, '')
  return `${b}${path}`
}

function extractMultimodalAudioUrl(data) {
  const url = data?.output?.audio?.url
  if (typeof url === 'string' && url.startsWith('http')) return url
  throw new Error('DashScope TTS: multimodal response missing output.audio.url')
}

function extractSpeechSynthPayload(data) {
  const aud = data?.output?.audio
  if (typeof aud === 'string') return { base64: aud }
  if (aud && typeof aud === 'object') {
    if (typeof aud.url === 'string') return { url: aud.url }
    if (typeof aud.data === 'string') return { base64: aud.data }
  }
  throw new Error('DashScope TTS: SpeechSynthesizer response missing audio')
}

/**
 * @param {{
 *   apiKey: string
 *   model: 'qwen3-tts-flash' | 'cosyvoice-v3.5-flash'
 *   text: string
 *   voice: string
 *   languageType?: string
 *   speechRate?: number
 *   requestBasePath?: string
 * }} input
 * @returns {Promise<ArrayBuffer>}
 */
export async function dashscopeTtsFetch(input) {
  const key = String(input.apiKey ?? '').trim()
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY')
  const text = String(input.text ?? '').trim()
  if (!text) throw new Error('Empty TTS text')

  const base = String(input.requestBasePath ?? '').trim() || BEIJING_ORIGIN
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }

  if (input.model === 'qwen3-tts-flash') {
    const voice = String(input.voice ?? '').trim()
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
    const data = JSON.parse(raw)
    const audioUrl = extractMultimodalAudioUrl(data)
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) {
      throw new Error(`DashScope TTS: failed to download audio (${audioRes.status})`)
    }
    return await audioRes.arrayBuffer()
  }

  const voice = String(input.voice ?? '').trim()
  if (!voice) {
    throw new Error(
      'Missing voice for cosyvoice-v3.5-flash (configure VITE_DASHSCOPE_TTS_VOICE)',
    )
  }

  const rawRate = Number(input.speechRate)
  const rate =
    Number.isFinite(rawRate) ? Math.min(2, Math.max(0.5, rawRate)) : 1

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
    const data = JSON.parse(raw)
    const { url, base64 } = extractSpeechSynthPayload(data)
    if (base64) {
      const buf = Buffer.from(base64, 'base64')
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    }
    if (url) {
      const ar = await fetch(url)
      if (!ar.ok) throw new Error('DashScope TTS: failed to fetch audio URL')
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
