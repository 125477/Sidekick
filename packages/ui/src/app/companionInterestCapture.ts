import { isCompanionQaModeEnabled } from '../constants/companionFeatureFlags'

/** 每日兴趣深化推送（`interest-deepen` trigger）才展示输入框。 */
export function shouldShowCompanionInterestInput(
  copyTrigger?: string | null,
): boolean {
  if (isCompanionQaModeEnabled()) return true
  return copyTrigger === 'interest-deepen'
}
