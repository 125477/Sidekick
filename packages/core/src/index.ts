export type CompanionTextStyle =
  | 'healing'
  | 'motivating'
  | 'funny'
  | 'sleep'
  | 'work-relief'

export const CORE_PACKAGE = '@sidekick/core'

export type { DashScopeTextRequest } from './clients/dashscopeTextClient'
export { requestDashScopeText } from './clients/dashscopeTextClient'
export {
  synthesizeDashScopeTts,
  type DashScopeTtsModel,
  type DashScopeTtsRequest,
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
