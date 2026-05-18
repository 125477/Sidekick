import {
  DEFAULT_QWEN_TTS_MODEL,
  parseDashScopeTtsModelFromEnv,
  resolveDashScopeAudioPlaybackUrl,
  synthesizeDashScopeTts,
  usesQwenMultimodalTtsApi,
  type DashScopeTtsModel,
  type DashScopeTtsSynthesisResult,
} from '@sidekick/core'
import {
  DEFAULT_QWEN_TTS_VOICE,
  QWEN_TTS_VOICE_IDS,
} from '../constants/qwenTtsVoices'

export type CompanionTtsOptions = {
  enabled: boolean
  model?: DashScopeTtsModel
  voice?: string
  speechRate?: number
}

let playingAudio: HTMLAudioElement | null = null
/** 账户欠费/Access denied 后本会话不再重复请求 TTS。 */
let ttsBlockedForSession = false
/** 忽略过期的 TTS 请求，避免「换一句」后仍播放上一条。 */
let speakGeneration = 0

/** 当前句已合成的可重播地址（同渲染进程内有效）。 */
let ttsPlaybackCache: {
  text: string
  src: string
  ownedObjectUrl: string | null
} | null = null

/** Electron 独立气泡窗展示文案；播报应在 toast 渲染进程触发。 */
export function usesDetachedToastWindow(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.sidekickDesktop?.showToastWindow,
  )
}

function isTtsAccountStandingError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('access denied') ||
    msg.includes('good standing') ||
    msg.includes('arrearage') ||
    msg.includes('overdue') ||
    msg.includes('欠费')
  )
}

function revokeOwnedObjectUrl(url: string | null): void {
  if (url) URL.revokeObjectURL(url)
}

function setPlaybackCache(
  text: string,
  playback: { src: string; revokeOnEnd: string | null },
): void {
  if (ttsPlaybackCache?.ownedObjectUrl) {
    revokeOwnedObjectUrl(ttsPlaybackCache.ownedObjectUrl)
  }
  ttsPlaybackCache = {
    text: text.trim(),
    src: playback.src,
    ownedObjectUrl: playback.revokeOnEnd,
  }
}

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
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function resolveTtsModel(override?: DashScopeTtsModel): DashScopeTtsModel {
  if (override) return override
  return (
    parseDashScopeTtsModelFromEnv(
      import.meta.env.VITE_DASHSCOPE_TTS_MODEL as string | undefined,
    ) ?? DEFAULT_QWEN_TTS_MODEL
  )
}

function resolveVoice(model: DashScopeTtsModel, override?: string): string {
  const pick = (raw: string | undefined): string => {
    const v = raw?.trim() ?? ''
    if (!v) return usesQwenMultimodalTtsApi(model) ? DEFAULT_QWEN_TTS_VOICE : ''
    if (usesQwenMultimodalTtsApi(model) && !QWEN_TTS_VOICE_IDS.has(v)) {
      return DEFAULT_QWEN_TTS_VOICE
    }
    return v
  }
  const fromSettings = pick(override)
  if (fromSettings) return fromSettings
  return pick(import.meta.env.VITE_DASHSCOPE_TTS_VOICE as string | undefined)
}

function sniffAudioMime(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf, 0, 4)
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) {
    return 'audio/wav'
  }
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'audio/mpeg'
  if (u8[0] === 0xff && (u8[1]! & 0xe0) === 0xe0) return 'audio/mpeg'
  return 'audio/wav'
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

async function playAudioSrc(src: string): Promise<void> {
  const audio = new Audio(src)
  playingAudio = audio

  const cleanup = () => {
    if (playingAudio === audio) playingAudio = null
  }
  audio.addEventListener('ended', cleanup)
  audio.addEventListener('error', cleanup)
  try {
    await audio.play()
  } catch {
    cleanup()
  }
}

function synthesisToPlayback(
  result: DashScopeTtsSynthesisResult,
  requestBasePath: string | undefined,
): { src: string; revokeOnEnd: string | null } {
  if (result.kind === 'url') {
    return {
      src: resolveDashScopeAudioPlaybackUrl(result.remoteUrl, requestBasePath),
      revokeOnEnd: null,
    }
  }
  const blob = new Blob([result.data], { type: sniffAudioMime(result.data) })
  const url = URL.createObjectURL(blob)
  return { src: url, revokeOnEnd: url }
}

/**
 * 再听一遍：复用本句已缓存的播放地址，不重新请求 TTS。
 * 无缓存时若传入 options 则回退为重新合成。
 */
export async function replayCompanionSpeech(
  text: string,
  options?: CompanionTtsOptions,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const cached = ttsPlaybackCache
  if (cached && cached.text === trimmed) {
    const gen = ++speakGeneration
    stopCompanionSpeech()
    if (gen !== speakGeneration) return
    await playAudioSrc(cached.src)
    return
  }

  if (options?.enabled) {
    await speakCompanionLine(trimmed, options)
  }
}

/**
 * DashScope TTS（默认 qwen-tts-2025-05-22；仍支持 qwen3-tts-flash / cosyvoice）。
 * 有 OSS 链接时由 `<audio src>` 直接拉流播放，不再用 fetch 下载整段音频。
 */
export async function speakCompanionLine(
  text: string,
  options: CompanionTtsOptions,
): Promise<void> {
  if (!options.enabled || !text?.trim() || ttsBlockedForSession) return

  const gen = ++speakGeneration
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
  const requestBasePath = dashscopeRequestBase()

  const trimmed = text.trim()
  const ttsBase = {
    apiKey,
    model,
    text: trimmed,
    voice,
    languageType: 'Chinese' as const,
  }

  try {
    let playback: { src: string; revokeOnEnd: string | null }

    if (window.sidekickDesktop?.dashscopeTts) {
      const r = await window.sidekickDesktop.dashscopeTts({
        ...ttsBase,
        ...(speechRate !== undefined ? { speechRate } : {}),
      })
      if (r.url) {
        playback = {
          src: resolveDashScopeAudioPlaybackUrl(r.url, requestBasePath),
          revokeOnEnd: null,
        }
      } else if (r.base64) {
        playback = synthesisToPlayback(
          { kind: 'buffer', data: base64ToArrayBuffer(r.base64) },
          requestBasePath,
        )
      } else {
        throw new Error('DashScope TTS: empty IPC result')
      }
    } else {
      const req = {
        ...ttsBase,
        ...(speechRate !== undefined ? { speechRate } : {}),
        ...(requestBasePath !== undefined
          ? { requestBasePath }
          : {}),
      }
      const result = await synthesizeDashScopeTts(req)
      playback = synthesisToPlayback(result, requestBasePath)
    }

    if (gen !== speakGeneration) return
    setPlaybackCache(trimmed, playback)
    await playAudioSrc(playback.src)
  } catch (e) {
    if (gen !== speakGeneration) return
    if (isTtsAccountStandingError(e)) {
      ttsBlockedForSession = true
      console.warn(
        'Sidekick TTS: 账户欠费或状态异常（qwen-tts 不可用），已暂停语音播报。请至阿里云费用中心充值后重启应用。',
      )
    } else {
      console.warn('Sidekick TTS failed', e)
    }
  }
}
