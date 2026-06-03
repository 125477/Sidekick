import { app } from 'electron'

/**
 * macOS Dock：应用运行期间始终显示图标（不随气泡/面板/贴边半露隐藏）。
 * Windows 任务栏由各自窗口 `skipTaskbar` 控制。
 */
export function syncAppDockVisibility() {
  if (process.platform !== 'darwin' || !app.dock) return
  try {
    app.dock.show()
  } catch {
    /* noop */
  }
}
