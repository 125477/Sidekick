import { useCallback, useEffect, useMemo, useState } from 'react'

type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

type AppUpdateSnapshot = {
  enabled: boolean
  currentVersion: string
  phase: AppUpdatePhase
  version?: string
  percent?: number
  message?: string
  releaseNotes?: string
}

function phaseLabel(snapshot: AppUpdateSnapshot): string {
  if (!snapshot.enabled) {
    return '当前为开发态（pnpm dev），不支持应用内更新；请安装打包版 .app 后测试，或从 GitHub Releases 下载。'
  }
  switch (snapshot.phase) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return snapshot.version
        ? `发现新版本 ${snapshot.version}，确认后将下载（系统弹窗或点「下载更新」）。`
        : '发现新版本，确认后将下载。'
    case 'downloading':
      return snapshot.percent != null
        ? `正在下载更新（${Math.round(snapshot.percent)}%）…`
        : '正在下载更新…'
    case 'downloaded':
      return snapshot.version
        ? `新版本 ${snapshot.version} 已就绪，可重启安装。`
        : '更新已下载，可重启安装。'
    case 'not-available':
      return '当前已是最新版本。'
    case 'error':
      return snapshot.message
        ? `更新失败：${snapshot.message}`
        : '更新失败，请稍后重试。'
    default:
      return '启动后会自动检查更新；发现新版本时会询问是否下载。'
  }
}

export function AppUpdateSettingsSection() {
  const desktop = window.sidekickDesktop
  const [snapshot, setSnapshot] = useState<AppUpdateSnapshot>({
    enabled: false,
    currentVersion: '—',
    phase: 'idle',
  })

  const refresh = useCallback(async () => {
    if (!desktop?.getAppUpdateStatus) return
    const next = await desktop.getAppUpdateStatus()
    setSnapshot(next)
  }, [desktop])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!desktop?.onAppUpdateStatus) return
    return desktop.onAppUpdateStatus((next) => setSnapshot(next))
  }, [desktop])

  const statusText = useMemo(() => phaseLabel(snapshot), [snapshot])

  const checkDisabled =
    !snapshot.enabled ||
    snapshot.phase === 'checking' ||
    snapshot.phase === 'downloading'

  const downloadDisabled =
    !snapshot.enabled ||
    snapshot.phase !== 'available' ||
    !desktop?.downloadAppUpdate

  const installDisabled = !snapshot.enabled || snapshot.phase !== 'downloaded'

  const onCheck = () => {
    if (!desktop?.checkForAppUpdate) return
    void desktop.checkForAppUpdate().then(setSnapshot)
  }

  const onDownload = () => {
    if (!desktop?.downloadAppUpdate) return
    void desktop.downloadAppUpdate().then(setSnapshot)
  }

  const onInstall = () => {
    if (!desktop?.installAppUpdate) return
    void desktop.installAppUpdate()
  }

  return (
    <section className="sk-settings-card sk-settings-card--titled">
      <h3 className="sk-settings-card-title">版本更新</h3>
      <div className="sk-settings-card-body grid gap-3">
        <p className="sk-muted text-sm leading-relaxed">
          当前版本 <span className="text-foreground font-medium">{snapshot.currentVersion}</span>
        </p>
        <p className="sk-muted text-sm leading-relaxed" aria-live="polite">
          {statusText}
        </p>
        {snapshot.phase === 'downloading' && snapshot.percent != null ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={Math.round(snapshot.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.min(100, Math.max(0, snapshot.percent))}%` }}
            />
          </div>
        ) : null}
        {snapshot.releaseNotes?.trim() ? (
          <pre className="sk-muted max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed">
            {snapshot.releaseNotes.trim()}
          </pre>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="sk-btn-secondary"
            onClick={onCheck}
            disabled={checkDisabled}
          >
            检查更新
          </button>
          <button
            type="button"
            className="sk-btn-secondary"
            onClick={onDownload}
            disabled={downloadDisabled}
          >
            下载更新
          </button>
          <button
            type="button"
            className="sk-btn-primary"
            onClick={onInstall}
            disabled={installDisabled}
          >
            立即重启并安装
          </button>
        </div>
      </div>
    </section>
  )
}
