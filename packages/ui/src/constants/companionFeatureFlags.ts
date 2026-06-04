function envTruthy(raw: string | undefined): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * 本地开发：`VITE_SIDEKICK_COMPANION_QA_MODE=1` 时任意气泡均可测兴趣输入框。
 * 正式产品：仅 `interest-deepen` 推送句展示输入框。
 */
export function isCompanionQaModeEnabled(): boolean {
  return envTruthy(
    import.meta.env.VITE_SIDEKICK_COMPANION_QA_MODE as string | undefined,
  )
}
