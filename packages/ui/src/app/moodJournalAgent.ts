import {
  generateMoodJournalGuide,
  generateMoodJournalPolish,
  type DashScopeTextRequest,
  type MoodJournalGuideResult,
  type MoodJournalPolishResult,
} from '@sidekick/core'
import { parseCompanionInterestNote } from '../constants/companionInterestTags'
import type { SidekickSettings } from '../state/settingsState'

function apiKeyFromEnv(): string | undefined {
  return import.meta.env.VITE_DASHSCOPE_API_KEY as string | undefined
}

function moodGuideAppIdFromEnv(): string | undefined {
  const raw = import.meta.env.VITE_BAILIAN_MOOD_GUIDE_APP_ID as string | undefined
  const id = raw?.trim()
  return id || undefined
}

function moodPolishAppIdFromEnv(): string | undefined {
  const raw = import.meta.env.VITE_BAILIAN_MOOD_POLISH_APP_ID as string | undefined
  const id = raw?.trim()
  return id || undefined
}

function dashscopeRequestBase(): string | undefined {
  if (typeof window === 'undefined') return undefined
  if (import.meta.env.DEV) {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      return `${window.location.origin}/dashscope`
    }
  }
  return undefined
}

function dashscopeChatCompletionsUrl(): string | undefined {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const { protocol } = window.location
    if (protocol === 'http:' || protocol === 'https:') {
      return `${window.location.origin}/dashscope/compatible-mode/v1/chat/completions`
    }
  }
  return undefined
}

const modelFromEnv =
  (import.meta.env.VITE_DASHSCOPE_MODEL as string | undefined) ?? 'qwen-turbo'
const modelFallbackEnv = import.meta.env.VITE_DASHSCOPE_MODEL_FALLBACK as
  | string
  | undefined

function moodJournalAgentExtras(apiKey: string | undefined): {
  invokeAgent?: (payload: {
    appId: string
    prompt: string
    sessionId?: string | null
    userPromptParams: Record<string, string>
  }) => Promise<{ text: string; sessionId: string | null }>
  invokeChat?: (req: DashScopeTextRequest) => Promise<string>
  requestBasePath?: string
  chatCompletionsUrl?: string
  modelFallbackEnv?: string
} {
  const extras: {
    invokeAgent?: (payload: {
      appId: string
      prompt: string
      sessionId?: string | null
      userPromptParams: Record<string, string>
    }) => Promise<{ text: string; sessionId: string | null }>
    invokeChat?: (req: DashScopeTextRequest) => Promise<string>
    requestBasePath?: string
    chatCompletionsUrl?: string
    modelFallbackEnv?: string
  } = {}

  const ipcAgent = window.sidekickDesktop?.dashscopeAgent
  if (ipcAgent) {
    extras.invokeAgent = (payload) =>
      ipcAgent({
        apiKey,
        appId: payload.appId,
        prompt: payload.prompt,
        ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
        userPromptParams: payload.userPromptParams,
      })
  }

  const ipcChat = window.sidekickDesktop?.dashscopeChat
  if (ipcChat) {
    extras.invokeChat = (req) =>
      ipcChat({
        ...req,
        ...(modelFallbackEnv !== undefined ? { modelFallbackEnv } : {}),
      })
  }

  const base = dashscopeRequestBase()
  if (base !== undefined) extras.requestBasePath = base

  const chatUrl = dashscopeChatCompletionsUrl()
  if (chatUrl !== undefined) extras.chatCompletionsUrl = chatUrl

  if (modelFallbackEnv !== undefined) extras.modelFallbackEnv = modelFallbackEnv

  return extras
}

export async function fetchMoodJournalGuideQuestions(
  settings: SidekickSettings,
  input: {
    moodLabel: string
    noteDraft: string
    previousQuestions?: string[]
    refreshBatch?: boolean
  },
): Promise<MoodJournalGuideResult> {
  const apiKey = apiKeyFromEnv()
  const { tags, note } = parseCompanionInterestNote(settings.companionInterests)
  const refreshSeed = Date.now() ^ Math.floor(Math.random() * 1_000_000_000)
  return generateMoodJournalGuide({
    apiKey,
    appId: moodGuideAppIdFromEnv(),
    model: modelFromEnv,
    moodLabel: input.moodLabel,
    noteDraft: input.noteDraft,
    ...(tags.length > 0 ? { interests: tags } : {}),
    ...(note.trim() ? { interestNote: note.trim() } : {}),
    ...(input.previousQuestions?.length
      ? { previousQuestions: input.previousQuestions }
      : {}),
    ...(input.refreshBatch ? { refreshSeed } : {}),
    ...moodJournalAgentExtras(apiKey),
  })
}

export async function fetchMoodJournalPolish(
  input: { moodLabel: string; noteDraft: string },
): Promise<MoodJournalPolishResult> {
  const apiKey = apiKeyFromEnv()
  return generateMoodJournalPolish({
    apiKey,
    appId: moodPolishAppIdFromEnv(),
    model: modelFromEnv,
    moodLabel: input.moodLabel,
    noteDraft: input.noteDraft,
    ...moodJournalAgentExtras(apiKey),
  })
}
