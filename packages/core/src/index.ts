export type CompanionTextStyle =
  | 'healing'
  | 'motivating'
  | 'funny'
  | 'sleep'
  | 'work-relief'

export const CORE_PACKAGE = '@sidekick/core'

export type {
  DashScopeChatCompleteResult,
  DashScopeHttpError,
  DashScopeTextRequest,
} from './clients/dashscopeTextClient'
export {
  isDashScopeQuotaOrAccessError,
  listDashScopeChatModels,
  modelsListUrl,
  requestDashScopeChatCompletion,
  requestDashScopeText,
  requestDashScopeTextWithFallback,
} from './clients/dashscopeTextClient'
export {
  buildDashScopeModelTryOrder,
  DASHSCOPE_CHAT_FALLBACK_MODELS,
  filterLikelyChatModelIds,
  parseExtraFallbackModelsFromEnv,
} from './constants/dashscopeFallbackModels'
export {
  clearDashScopeUnavailableModels,
  filterOutUnavailableDashScopeModels,
  getDashScopeUnavailableModels,
  isDashScopeModelMarkedUnavailable,
  markDashScopeModelUnavailable,
  prepareDashScopeModelTryOrder,
} from './constants/dashscopeUnavailableModels'
export {
  DEFAULT_QWEN_TTS_MODEL,
  parseDashScopeTtsModelFromEnv,
  usesQwenMultimodalTtsApi,
  type DashScopeTtsModel,
} from './constants/dashscopeTtsModels'
export {
  isAllowedDashScopeResultAudioUrl,
  resolveDashScopeAudioPlaybackUrl,
  synthesizeDashScopeTts,
  type DashScopeTtsRequest,
  type DashScopeTtsSynthesisResult,
} from './clients/dashscopeTtsClient'
export * from './schema/config'
export * from './schema/data'
export * from './usecases/generateAvatar'
export * from './usecases/generateCompanionCopy'
export * from './usecases/getCompanionText'
export * from './utils/scheduler'
export * from './utils/emotionTrend'
export * from './storage/localStore'
export * from './utils/dailyFortuneLottery'
export * from './prompts/avatarPrompt'
export * from './prompts/textPrompt'
export * from './fallback/quotes'
