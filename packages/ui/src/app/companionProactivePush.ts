import { appendText, pickCompanionTriggerFallback } from '@sidekick/core'
import type { MutableRefObject } from 'react'
import type { SidekickSettings } from '../state/settingsState'
import type { SpriteState } from '../state/uiState'
import {
  canPushNow,
  fetchCompanionCopy,
  persistBailianAgentSessionId,
  type FetchCompanionCopyOptions,
} from './companionCopy'
import { RECENT_COMPANION_LINES_MAX } from './recentCompanionLines'
import {
  shouldApplyCompanionCopyResult,
  startCompanionCopyRequest,
} from './companionCopySession'
import { usesDetachedToastWindow } from '../utils/companionTts'
import { reportSpriteAnchorToMain } from '../utils/reportSpriteAnchor'
import { buildShowToastWindowPayload } from '../utils/toastWindowPayload'

const BLOCK_SCHEDULED_MS = 4 * 60 * 1000

export type PushProactiveCompanionInput = {
  settingsRef: MutableRefObject<SidekickSettings>
  recentCompanionLinesRef: MutableRefObject<string[]>
  blockScheduledPushRef?: MutableRefObject<boolean>
  showToastMessage: (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string
      favorite?: boolean
      toastMode?: 'normal' | 'intro'
      copyMeta?: { trigger: string; source: 'model' | 'fallback' }
    },
  ) => Promise<void>
  setToastMeta?: (meta: { id: string; favorite: boolean } | null) => void
  setSpriteState?: (state: SpriteState) => void
  widgetMeasureRef?: MutableRefObject<HTMLDivElement | null>
  isWidgetMode?: boolean
  fetchOptions: FetchCompanionCopyOptions
  /** 自动 ritual：须开推送且过 canPushNow */
  requireAutoPushGate?: boolean
}

function shouldGateAutoPush(
  settings: SidekickSettings,
  requireAutoPushGate: boolean,
): boolean {
  if (!requireAutoPushGate) return true
  if (!settings.pushEnabled) return false
  return canPushNow(settings)
}

export async function pushProactiveCompanionCopy(
  input: PushProactiveCompanionInput,
): Promise<string | null> {
  const s = input.settingsRef.current
  if (!shouldGateAutoPush(s, input.requireAutoPushGate ?? true)) return null

  const fetchId = startCompanionCopyRequest()
  const avoid = input.recentCompanionLinesRef.current
  const trigger = input.fetchOptions.trigger ?? 'manual'

  let text: string
  let source: 'model' | 'fallback' = 'model'
  let sessionId: string | null | undefined

  try {
    const result = await fetchCompanionCopy(
      s,
      undefined,
      undefined,
      avoid.length > 0 ? avoid : undefined,
      {
        ...input.fetchOptions,
        fetchKind: input.fetchOptions.fetchKind ?? 'startup',
        maxQualityRetries: input.fetchOptions.maxQualityRetries ?? 0,
      },
    )
    await persistBailianAgentSessionId(input.settingsRef, result.sessionId)
    if (!shouldApplyCompanionCopyResult(fetchId, result.source)) return null
    text = result.text.trim()
    source = result.source
    sessionId = result.sessionId
  } catch {
    text = pickCompanionTriggerFallback(trigger).trim()
    source = 'fallback'
  }

  if (!text) return null

  const next = await appendText({
    id: `text-${Date.now()}`,
    content: text,
    createdAt: new Date().toISOString(),
    source,
    favorite: false,
  })
  const newId = next.texts.history[0]?.id
  const dwell = s.toastAlwaysVisible ? 0 : s.dwellMinutes * 60
  const copyMeta = { trigger, source }
  const detachedToast =
    input.isWidgetMode && usesDetachedToastWindow() && input.widgetMeasureRef

  if (detachedToast && input.widgetMeasureRef) {
    await reportSpriteAnchorToMain(input.widgetMeasureRef.current, {
      flush: true,
      avatarSizePercent: s.avatarSize,
    })
    await window.sidekickDesktop!.showToastWindow(
      buildShowToastWindowPayload(s, {
        message: text,
        anchor: s.toastAnchor,
        dwellSeconds: dwell,
        copyMeta,
        ...(newId ? { textId: newId, favorite: false } : {}),
      }),
    )
  } else {
    await input.showToastMessage(text, {
      dwellSeconds: dwell,
      copyMeta,
      ...(newId ? { textId: newId, favorite: false } : {}),
    })
    if (newId && input.setToastMeta) {
      input.setToastMeta({ id: newId, favorite: false })
    }
  }

  input.recentCompanionLinesRef.current = [
    ...input.recentCompanionLinesRef.current,
    text,
  ].slice(-RECENT_COMPANION_LINES_MAX)

  if (input.blockScheduledPushRef) {
    input.blockScheduledPushRef.current = true
    window.setTimeout(() => {
      if (input.blockScheduledPushRef) {
        input.blockScheduledPushRef.current = false
      }
    }, BLOCK_SCHEDULED_MS)
  }

  if (input.setSpriteState) {
    input.setSpriteState('notify')
    window.setTimeout(() => input.setSpriteState?.('idle'), 520)
  }

  void sessionId
  return text
}

export function formatJournalClosureMoment(
  moodLabel: string,
  note: string,
): string {
  const excerpt = note.replace(/\s+/g, ' ').trim().slice(0, 100)
  return excerpt.length > 0
    ? `今日心情：${moodLabel}；日记摘录：${excerpt}`
    : `今日心情：${moodLabel}；用户已保存小结（正文较短或未写）`
}

export function formatFocusEndMoment(minutes: number): string {
  return `用户刚结束专注，本次约 ${minutes} 分钟。`
}

export function formatUnlockMoment(): string {
  return '用户刚解锁屏幕或从休眠恢复桌面（非昨日情绪续接）。'
}

export function formatStreakMoment(streakDays: number): string {
  return `用户已连续 ${streakDays} 天记录今日小结或心情。`
}
