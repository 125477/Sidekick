import type { EmotionKind } from '@sidekick/core'

const KEY = 'sidekick.pendingEmotionCompanion.v1'

const EMOTION_KINDS = new Set<EmotionKind>([
  'happy',
  'calm',
  'anxious',
  'low',
  'tired',
])

type PendingEmotionPayload = {
  emotion: EmotionKind
  savedAt: string
}

function parsePayload(raw: string): PendingEmotionPayload | null {
  try {
    const parsed = JSON.parse(raw) as PendingEmotionPayload
    if (!parsed || typeof parsed !== 'object') return null
    if (!EMOTION_KINDS.has(parsed.emotion)) return null
    if (typeof parsed.savedAt !== 'string' || !parsed.savedAt.trim()) return null
    return parsed
  } catch {
    return null
  }
}

/** 点选「此刻」情绪后暂存，待下一条定时陪伴推送时带上并消费。 */
export async function setPendingEmotionForCompanion(
  emotion: EmotionKind,
): Promise<void> {
  const payload: PendingEmotionPayload = {
    emotion,
    savedAt: new Date().toISOString(),
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

/** 读取待消费的情绪；无则返回 null（不清除）。 */
export async function readPendingEmotionForCompanion(): Promise<EmotionKind | null> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = parsePayload(raw)
    return parsed?.emotion ?? null
  } catch {
    return null
  }
}

/** 清除已挂起的情绪（通常在定时推送成功落库后调用）。 */
export async function clearPendingEmotionForCompanion(): Promise<void> {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
