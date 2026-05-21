import {
  buildMoodJournalPolishAgentParams,
  buildMoodJournalPolishAgentPrompt,
  buildMoodJournalPolishChatSystemPromptResolved,
  normalizeMoodJournalPolishText,
  type MoodJournalPolishAgentParamsInput,
} from '../prompts/moodJournalAgentPrompt'
import { requestDashScopeTextWithFallback } from '../clients/dashscopeTextClient'
import type { DashScopeTextRequest } from '../clients/dashscopeTextClient'
import { invokeBailianAgent, type InvokeBailianAgentInput } from './invokeBailianAgent'

export type GenerateMoodJournalPolishInput = MoodJournalPolishAgentParamsInput & {
  apiKey: string | undefined
  appId: string | undefined
  model: string
  modelFallbackEnv?: string
  maxChars?: number
  invokeAgent?: InvokeBailianAgentInput['invokeAgent']
  invokeChat?: (req: DashScopeTextRequest) => Promise<string>
  requestBasePath?: string
  chatCompletionsUrl?: string
}

export type MoodJournalPolishResult = {
  text: string
  source: 'agent' | 'chat' | 'local'
}

export async function generateMoodJournalPolish(
  input: GenerateMoodJournalPolishInput,
): Promise<MoodJournalPolishResult> {
  const maxChars = input.maxChars ?? 2000
  const params = buildMoodJournalPolishAgentParams(input)
  const prompt = buildMoodJournalPolishAgentPrompt()
  const draft = input.noteDraft.replace(/\s+/g, ' ').trim()
  const appId = input.appId?.trim()

  if (!draft) {
    return {
      text: '可以先写一两句今天印象最深的事。',
      source: 'local',
    }
  }

  if (appId) {
    try {
      const raw = await invokeBailianAgent({
        apiKey: input.apiKey,
        appId,
        prompt,
        userPromptParams: params,
        ...(input.invokeAgent ? { invokeAgent: input.invokeAgent } : {}),
        ...(input.requestBasePath !== undefined
          ? { requestBasePath: input.requestBasePath }
          : {}),
      })
      const text = normalizeMoodJournalPolishText(raw.text, maxChars)
      if (text) return { text, source: 'agent' }
    } catch {
      /* chat fallback */
    }
  }

  const apiKey = input.apiKey?.trim()
  if (apiKey) {
    try {
      const systemPrompt = buildMoodJournalPolishChatSystemPromptResolved(params)
      const req: DashScopeTextRequest = {
        apiKey,
        model: input.model,
        systemPrompt,
        userPrompt: '请润色上面的日记草稿。',
        temperature: 0.45,
        ...(input.chatCompletionsUrl !== undefined
          ? { chatCompletionsUrl: input.chatCompletionsUrl }
          : {}),
      }
      const content = input.invokeChat
        ? await input.invokeChat(req)
        : (
            await requestDashScopeTextWithFallback(
              req,
              input.modelFallbackEnv
                ? { envFallbackList: input.modelFallbackEnv }
                : {},
            )
          ).content
      const text = normalizeMoodJournalPolishText(content, maxChars)
      if (text) return { text, source: 'chat' }
    } catch {
      /* keep draft */
    }
  }

  return { text: draft, source: 'local' }
}
