import {
  buildMoodJournalGuideAgentParams,
  buildMoodJournalGuideAgentPrompt,
  buildMoodJournalGuideChatSystemPromptResolved,
  buildMoodJournalGuideChatUserPrompt,
  moodJournalGuideQuestionsEquivalent,
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

const LOCAL_REFRESH_QUESTIONS = [
  [
    '若用三个词形容今天，你会选哪三个？',
    '今天有没有一个瞬间，你想拍下来留住？',
    '睡前想对自己悄悄说什么？',
  ],
  [
    '今天谁或什么，悄悄影响了你的心情？',
    '有没有一句歌词或台词，突然跳进脑海？',
    '如果把今天写成标题，会叫什么？',
  ],
  [
    '今天最意外的一件小事是什么？',
    '有没有哪个细节，现在想起来还会微笑？',
    '你想把今天的哪一部分，留给明天的自己？',
  ],
] as const

function pickLocalRefreshQuestions(
  previous: string[] | undefined,
  seed: number,
): string[] {
  const batches = LOCAL_REFRESH_QUESTIONS.map((batch) => [...batch])
  for (let offset = 0; offset < batches.length; offset++) {
    const batch = batches[(seed + offset) % batches.length]!
    if (!previous?.length || !moodJournalGuideQuestionsEquivalent(batch, previous)) {
      return batch
    }
  }
  return [...LOCAL_FALLBACK_QUESTIONS]
}

function padGuideQuestions(questions: string[]): string[] {
  const out = [...questions]
  while (out.length < 3) {
    out.push(LOCAL_FALLBACK_QUESTIONS[out.length]!)
  }
  return out.slice(0, 3)
}

async function fetchGuideQuestionsOnce(
  input: GenerateMoodJournalGuideInput,
  refreshSeed: number,
): Promise<{ questions: string[]; source: 'agent' | 'chat' } | null> {
  const guideInput: MoodJournalGuideAgentParamsInput = {
    moodLabel: input.moodLabel,
    noteDraft: input.noteDraft,
    ...(input.interests !== undefined ? { interests: input.interests } : {}),
    ...(input.interestNote !== undefined ? { interestNote: input.interestNote } : {}),
    ...(input.previousQuestions !== undefined
      ? { previousQuestions: input.previousQuestions }
      : {}),
    refreshSeed,
  }
  const params = buildMoodJournalGuideAgentParams(guideInput)
  const prompt = buildMoodJournalGuideAgentPrompt(guideInput)
  const appId = input.appId?.trim()
  const isRefresh = (input.previousQuestions?.length ?? 0) > 0

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
        return { questions: padGuideQuestions(questions), source: 'agent' }
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
        userPrompt: buildMoodJournalGuideChatUserPrompt(guideInput),
        temperature: isRefresh ? 0.88 : 0.6,
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
        return { questions: padGuideQuestions(questions), source: 'chat' }
      }
    } catch {
      /* local fallback */
    }
  }

  return null
}

export async function generateMoodJournalGuide(
  input: GenerateMoodJournalGuideInput,
): Promise<MoodJournalGuideResult> {
  const baseSeed = input.refreshSeed ?? Date.now()

  for (let attempt = 0; attempt < 2; attempt++) {
    const refreshSeed = baseSeed + attempt * 1_048_583
    const result = await fetchGuideQuestionsOnce(input, refreshSeed)
    if (!result) break
    const previous = input.previousQuestions
    if (
      previous?.length &&
      moodJournalGuideQuestionsEquivalent(result.questions, previous)
    ) {
      continue
    }
    return result
  }

  if ((input.previousQuestions?.length ?? 0) > 0) {
    return {
      questions: pickLocalRefreshQuestions(input.previousQuestions, baseSeed),
      source: 'local',
    }
  }

  return {
    questions: [...LOCAL_FALLBACK_QUESTIONS],
    source: 'local',
  }
}
