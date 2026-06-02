/** Vite 不可用时仍能在独立窗展示今日心情提醒（不依赖 React 路由）。 */

/**
 * @param {string} title
 * @param {string} message
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {string} title
 * @param {string} message
 */
export function buildCornerNotificationDataUrl(title, message) {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<style>
  html, body { margin: 0; width: 100%; height: 100%; background: transparent; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; user-select: none; }
  .wrap { box-sizing: border-box; display: flex; width: 100%; height: 100%; padding: 0; }
  .card { display: flex; gap: 12px; width: 100%; padding: 14px 12px; border-radius: 16px;
    border: 1px solid #e2e8f0; background: #fff;
    box-shadow: 0 4px 14px -6px rgba(15, 23, 42, 0.10); }
  .icon { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #6366f1);
    flex-shrink: 0; }
  .body { min-width: 0; flex: 1; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
  h1 { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.25; color: #0f172a; }
  .close { border: 0; background: transparent; color: #94a3b8; width: 28px; height: 28px;
    border-radius: 8px; cursor: pointer; font-size: 16px; line-height: 1; }
  .close:hover { background: #f5f3ff; color: #7c3aed; }
  p { margin: 0; font-size: 13px; line-height: 1.35; color: #475569; }
  .cta { margin-top: 8px; border: 0; background: transparent; padding: 4px 6px; margin-left: -6px;
    font-size: 12px; font-weight: 600; color: #7c3aed; cursor: pointer; border-radius: 6px; }
  .cta:hover { background: #f5f3ff; text-decoration: underline; }
</style>
</head>
<body>
  <div class="wrap">
    <article class="card" role="status" aria-live="polite">
      <div class="icon" aria-hidden="true"></div>
      <div class="body">
        <div class="head">
          <h1>${safeTitle}</h1>
          <button type="button" class="close" aria-label="关闭" id="dismiss">×</button>
        </div>
        <p>${safeMessage}</p>
        <button type="button" class="cta" id="open">去写小结 →</button>
      </div>
    </article>
  </div>
  <script>
    document.getElementById('dismiss')?.addEventListener('click', () => {
      window.sidekickDesktop?.hideCornerNotification?.();
    });
    document.getElementById('open')?.addEventListener('click', () => {
      window.sidekickDesktop?.openCornerNotificationTarget?.();
    });
  </script>
</body>
</html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/**
 * @param {import('electron').BrowserWindow} win
 * @param {string} title
 * @param {string} message
 */
export async function loadCornerNotificationFallback(win, title, message) {
  await win.loadURL(buildCornerNotificationDataUrl(title, message))
  return true
}
