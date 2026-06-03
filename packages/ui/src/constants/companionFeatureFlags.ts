function envTruthy(raw: string | undefined): boolean {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

/**
 * 陪伴气泡「问答模式」：在仓库根目录 `.env.local` 设 `VITE_SIDEKICK_COMPANION_QA_MODE=1`
 * （Vite `envDir` 指向 monorepo 根，非 `packages/ui/.env.local`）。
 * hover 气泡工具栏区域时直接展示输入框（最多 100 字），提交写入兴趣补充；首启自我介绍气泡不显示。
 */
export function isCompanionQaModeEnabled(): boolean {
  return envTruthy(
    import.meta.env.VITE_SIDEKICK_COMPANION_QA_MODE as string | undefined,
  )
}
