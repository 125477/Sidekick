import {
  buildMoodJournalGuideAgentParams,
  buildMoodJournalGuideAgentPrompt,
  buildMoodJournalGuideChatSystemPromptResolved,
  parseMoodJournalGuideQuestions,
  type MoodJournalGuideAgentParamsInput,
} from '../prompts/moodJournalAgentPrompt'
import { requestDashScopeTextWithFallback } from '../clients/dashscopeTextClient'
import type { DashScopeTextRequest } from '../clients/dashscopeTextClient'
import { invokeBailianAgent, type InvokeBailianAgentInput } from './invokeBailianAgent'

export type GenerateMoodJournalGuideInput = MoodJournalGuideAgentParamsInput & {
  apiKey: string | undefined
  appId: string | undefined
  model: string
  modelFallbackEnv?: string
  invokeAgent?: InvokeBailianAgentInput['invokeAgent']
  invokeChat?: (req: DashScopeTextRequest) => Promise<string>
  requestBasePath?: string
  chatCompletionsUrl?: string
}

export type MoodJournalGuideResult = {
  questions: string[]
  source: 'agent' | 'chat' | 'local'
}

const LOCAL_FALLBACK_QUESTIONS = [
  '今天整体心情里，最鲜明的一刻是什么？',
  '有没有一件小事，你想多留一会儿？',
  '想对今天的自己说一句什么？',
] as const

export async function generateMoodJournalGuide(
  input: GenerateMoodJournalGuideInput,
): Promise<MoodJournalGuideResult> {
  const params = buildMoodJournalGuideAgentParams(input)
  const prompt = buildMoodJournalGuideAgentPrompt()
  const appId = input.appId?.trim()

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
      const questions = parseMoodJournalGuideQuestions(raw.text)
      if (questions.length >= 1) {
        while (questions.length < 3) {
          questions.push(LOCAL_FALLBACK_QUESTIONS[questions.length]!)
        }
        return { questions: questions.slice(0, 3), source: 'agent' }
      }
    } catch {
      /* fall through to chat */
    }
  }

  const apiKey = input.apiKey?.trim()
  if (apiKey) {
    try {
      const systemPrompt = buildMoodJournalGuideChatSystemPromptResolved(params)
      const req: DashScopeTextRequest = {
        apiKey,
        model: input.model,
        systemPrompt,
        userPrompt: '请输出 3 条引导问题。',
        temperature: 0.6,
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
      const questions = parseMoodJournalGuideQuestions(content)
      if (questions.length >= 1) {
        while (questions.length < 3) {
          questions.push(LOCAL_FALLBACK_QUESTIONS[questions.length]!)
        }
        return { questions: questions.slice(0, 3), source: 'chat' }
      }
    } catch {
      /* local fallback */
    }
  }

  return {
    questions: [...LOCAL_FALLBACK_QUESTIONS],
    source: 'local',
  }
}
