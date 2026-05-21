import { requestDashScopeAgentCompletion } from '../clients/dashscopeAgentClient'

export type InvokeBailianAgentInput = {
  apiKey: string | undefined
  appId: string
  prompt: string
  userPromptParams: Record<string, string>
  sessionId?: string | null
  invokeAgent?: (payload: {
    appId: string
    prompt: string
    sessionId?: string | null
    userPromptParams: Record<string, string>
  }) => Promise<{ text: string; sessionId: string | null }>
  requestBasePath?: string
}

export async function invokeBailianAgent(
  input: InvokeBailianAgentInput,
): Promise<{ text: string; sessionId: string | null }> {
  if (input.invokeAgent) {
    return input.invokeAgent({
      appId: input.appId,
      prompt: input.prompt,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
      userPromptParams: input.userPromptParams,
    })
  }
  return requestDashScopeAgentCompletion(
    {
      apiKey: input.apiKey,
      appId: input.appId,
      prompt: input.prompt,
      ...(input.sessionId != null ? { sessionId: input.sessionId } : {}),
      userPromptParams: input.userPromptParams,
    },
    input.requestBasePath !== undefined
      ? { requestBasePath: input.requestBasePath }
      : undefined,
  )
}
