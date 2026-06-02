const EXPORT_SESSION_KEY = 'sidekick.companion.export.v1'

export type CompanionExportSession = {
  message: string
  variant?: string
}

export function stashCompanionExportSession(session: CompanionExportSession): void {
  sessionStorage.setItem(EXPORT_SESSION_KEY, JSON.stringify(session))
}

export function readCompanionExportSession(): CompanionExportSession | null {
  try {
    const raw = sessionStorage.getItem(EXPORT_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CompanionExportSession
    if (!parsed?.message?.trim()) return null
    return parsed
  } catch {
    return null
  }
}

export function clearCompanionExportSession(): void {
  sessionStorage.removeItem(EXPORT_SESSION_KEY)
}

export function openCompanionExportPanel(
  message: string,
  variant?: string,
): void {
  stashCompanionExportSession({
    message,
    ...(variant ? { variant } : {}),
  })
  void window.sidekickDesktop?.openPanelWindow?.('companion-export', {
    exportMessage: message.slice(0, 200),
  })
}
