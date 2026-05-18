/**
 * Electron 主进程拉取 DashScope TTS（与 packages/core dashscopeTtsClient 保持同步）。
 */
const BEIJING_ORIGIN = 'https://dashscope.aliyuncs.com'
const MULTIMODAL_PATH =
  '/api/v1/services/aigc/multimodal-generation/generation'
const SPEECH_SYNTH_PATH = '/api/v1/services/audio/tts/SpeechSynthesizer'

const QWEN_MULTIMODAL_TTS = new Set([
  'qwen-tts-2025-05-22',
  'qwen3-tts-flash',
])

/** qwen-tts-2025-05-22 当前仅支持这 7 个 voice（与 ui/constants/qwenTtsVoices 一致） */
const QWEN_TTS_2025_VOICES = new Set([
  'Cherry',
  'Serena',
  'Ethan',
  'Chelsie',
  'Dylan',
  'Jada',
  'Sunny',
])

function usesQwenMultimodalTts(model) {
  return QWEN_MULTIMODAL_TTS.has(model)
}

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

function resolveQwenVoice(modelId, rawVoice) {
  let voice = String(rawVoice ?? '').trim()
  if (!voice) voice = 'Chelsie'
  if (modelId === 'qwen-tts-2025-05-22' && !QWEN_TTS_2025_VOICES.has(voice)) {
    voice = 'Chelsie'
  }
  return voice
}

async function synthesizeQwenMultimodal(input, modelId) {
  const voice = resolveQwenVoice(modelId, input.voice)

  const base = String(input.requestBasePath ?? '').trim() || BEIJING_ORIGIN
  const res = await fetch(joinBase(base, MULTIMODAL_PATH), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${String(input.apiKey ?? '').trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      input: {
        text: String(input.text ?? '').trim(),
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
  const data = JSON.parse(raw)
  const audioUrl = extractMultimodalAudioUrl(data)
  return { url: audioUrl }
}

/**
 * @param {object} input
 * @returns {Promise<{ url?: string, base64?: string, mimeType?: string }>}
 */
export async function dashscopeTtsFetch(input) {
  const key = String(input.apiKey ?? '').trim()
  if (!key) throw new Error('Missing DASHSCOPE_API_KEY')
  const text = String(input.text ?? '').trim()
  if (!text) throw new Error('Empty TTS text')

  const model = String(input.model ?? 'qwen-tts-2025-05-22').trim()

  if (usesQwenMultimodalTts(model)) {
    return synthesizeQwenMultimodal(input, model)
  }

  const voice = String(input.voice ?? '').trim()
  if (!voice) {
    throw new Error(
      'Missing voice for cosyvoice-v3.5-flash (configure VITE_DASHSCOPE_TTS_VOICE)',
    )
  }

  const base = String(input.requestBasePath ?? '').trim() || BEIJING_ORIGIN
  const rawRate = Number(input.speechRate)
  const rate =
    Number.isFinite(rawRate) ? Math.min(2, Math.max(0.5, rawRate)) : 1

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
    const data = JSON.parse(raw)
    const { url, base64 } = extractSpeechSynthPayload(data)
    if (url) return { url }
    if (base64) {
      return { base64, mimeType: 'audio/mpeg' }
    }
    throw new Error('DashScope TTS: could not parse SpeechSynthesizer JSON')
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `DashScope TTS ${res.status}${errText ? `: ${errText.slice(0, 320)}` : ''}`,
    )
  }
  const buf = await res.arrayBuffer()
  return {
    base64: Buffer.from(buf).toString('base64'),
    mimeType: 'audio/mpeg',
  }
}
