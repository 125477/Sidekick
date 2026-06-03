const EXPORT_SESSION_KEY = 'sidekick.companion.export.v1'

export type CompanionExportSession = {
  message: string
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

/** 独立 panel 窗与 widget 不共享 sessionStorage，优先读 URL `exportMessage`。 */
export function resolveCompanionExportInitialMessage(
  exportMessageFromQuery?: string | null,
): string {
  const fromQuery = exportMessageFromQuery?.trim()
  if (fromQuery) return fromQuery.slice(0, 200)
  const fromSession = readCompanionExportSession()?.message?.trim()
  if (fromSession) return fromSession
  return ''
}

export function openCompanionExportPanel(message: string): void {
  stashCompanionExportSession({ message })
  void window.sidekickDesktop?.openPanelWindow?.('companion-export', {
    exportMessage: message.slice(0, 200),
  })
}
