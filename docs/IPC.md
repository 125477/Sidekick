# Sidekick IPC 与 `window.sidekickDesktop`

渲染进程通过 **`packages/electron-app/scripts/preload.cjs`** 暴露 `window.sidekickDesktop`。  
主进程在 **`packages/electron-app/scripts/main/ipcHandlers.mjs`** 注册 `ipcMain.handle` / `ipcMain.on`。  
TypeScript 声明：**`packages/ui/src/types/electron.d.ts`**。

约定：

- **`invoke`**：渲染 → 主进程，有返回值（Promise）
- **`send` / `on`**：单向；高频路径用 `send`（如拖尾点、锚点 push）
- **主 → 渲染**：`webContents.send('sidekick:…')`，由 preload 的 `onXxx` 订阅

## 窗口与路由

| 窗口 | 典型 `loadURL` mode | 说明 |
|------|-------------------|------|
| 精灵挂件 | `widget` | 形象、`moveWidgetBy`、内嵌或触发独立气泡 |
| 独立气泡 | `toast` | `showToastWindow` 加载，query 带 message/anchor 等 |
| 辅面板 | `panel` | settings / emotion / skin / fortune / favorites |
| 引导 | `onboarding` | 首次引导 |
| 精灵菜单 | `sprite-menu` | 窄菜单小窗 |
| 拖动拖尾 | `drag-trail` | 透明 overlay，仅 Canvas；见 `dragTrail.mjs` |

路由拼装：`scripts/main/route.mjs` → `buildRoute(baseUrl, mode, params)`。

## API 一览（preload 方法 → channel）

### 辅窗 / 应用

| preload | channel | 方向 |
|---------|---------|------|
| `openPanelWindow(panel, opts?)` | `sidekick:open-panel` | invoke |
| `openOnboardingWindow()` | `sidekick:open-onboarding` | invoke |
| `notifyOnboardingComplete()` | `sidekick:onboarding-complete` | invoke |
| `onOnboardingFinished(cb)` | `sidekick:onboarding-finished` | 主→精灵 |
| `quitApp()` | `sidekick:quit-app` | invoke |
| `showSystemNotification(payload)` | `sidekick:show-system-notification` | invoke |

### 气泡窗

| preload | channel | 方向 |
|---------|---------|------|
| `showToastWindow(payload)` | `sidekick:show-toast` | invoke |
| `hideToastWindow()` | `sidekick:hide-toast` | invoke |
| `setToastAnchorPreference(payload)` | `sidekick:set-toast-anchor-preference` | invoke |
| `resizeToastWindow({ height })` | `sidekick:resize-toast` | invoke |
| `onDetachedToastPlacementSync(cb)` | `sidekick:detached-toast-placement` | 主→toast |
| `reportToastPassthroughInteractRect(rect)` | `sidekick:toast-passthrough-interact-rect` | send |
| `requestRegenerateCopy()` | `sidekick:toast-regenerate-request` | send |
| `onRegenerateCopyRequested(cb)` | `sidekick:regenerate-copy` | 主→widget |

### 精灵挂件

| preload | channel | 方向 |
|---------|---------|------|
| `resizeWidgetWindow({ height, width? })` | `sidekick:resize-widget` | invoke |
| `moveWidgetBy({ dx, dy })` | `sidekick:move-widget-by` | invoke |
| `setSpriteAnchor(anchor)` | `sidekick:set-sprite-anchor`（`_sync: true`）或 `sidekick:set-sprite-anchor-push` | invoke / send |
| `getWorkArea()` | `sidekick:get-work-area` | invoke |
| `setWidgetPointerPassthrough(enabled)` | `sidekick:widget-pointer-passthrough` | send |
| `setSpriteInteractionLocked(locked)` | `sidekick:set-sprite-interaction-locked` | invoke |
| `getSpriteInteractionLocked()` | `sidekick:get-sprite-interaction-locked` | invoke |
| `onSpriteInteractionLocked(cb)` | `sidekick:sprite-interaction-locked` | 主→各窗 |

### 精灵菜单（独立小窗）

| preload | channel | 方向 |
|---------|---------|------|
| `openWidgetSpriteMenu(bounds)` | `sidekick:open-widget-sprite-menu` | invoke |
| `closeWidgetSpriteMenu(opts?)` | `sidekick:close-widget-sprite-menu` | invoke |
| `submitWidgetSpriteMenuAction(action)` | `sidekick:widget-sprite-menu-submit` | invoke |
| `onWidgetSpriteMenuPick(cb)` | `sidekick:widget-sprite-menu-pick` | 主→widget/toast |
| `onWidgetSpriteMenuClosed(cb)` | `sidekick:widget-sprite-menu-closed` | 主→widget/toast |

### 拖动星星拖尾

| preload | channel | 方向 |
|---------|---------|------|
| `beginDragTrail({ screenX, screenY })` | `sidekick:begin-drag-trail` | invoke |
| `pushDragTrailPoint({ screenX, screenY })` | `sidekick:drag-trail-point` | send（主进程合并为 batch） |
| `endDragTrail()` | `sidekick:end-drag-trail` | send |
| `onDragTrailPoints(cb)` | `sidekick:drag-trail-points` | 主→drag-trail |
| `onDragTrailShift(cb)` | `sidekick:drag-trail-shift` | 主→drag-trail（小窗平移时补偿粒子坐标） |
| `onDragTrailReset(cb)` | `sidekick:drag-trail-reset` | 主→drag-trail |
| `onDragTrailResetSampler(cb)` | `sidekick:drag-trail-reset-sampler` | 主→drag-trail |
| `onDragTrailSync(cb)` | `sidekick:drag-trail-sync` | 主→drag-trail（窗口 bounds） |

实现：`scripts/main/dragTrail.mjs`；UI：`DragTrailOverlayPage.tsx`、`desktopDragTrail.ts`、`SpriteShell` 回调。

### 模型代理（主进程出网）

| preload | channel | 方向 |
|---------|---------|------|
| `dashscopeChat(payload)` | `sidekick:dashscope-chat` | invoke |
| `dashscopeTts(payload)` | `sidekick:dashscope-tts` | invoke |

### 系统

| preload | channel | 方向 |
|---------|---------|------|
| `onSystemResume(cb)` | `sidekick:system-resume` | 主→各窗（休眠恢复） |
| `resizePanelWindow()` | `sidekick:resize-panel` | invoke |

## 修改 IPC 时的检查清单

1. `preload.cjs` 增加/修改暴露方法  
2. `ipcHandlers.mjs`（或 `dragTrail.mjs` 等）注册处理  
3. `packages/ui/src/types/electron.d.ts` 更新类型  
4. 调用方（多为 `App.tsx`、hooks、`desktopDragTrail.ts`）  
5. 本文档与 [DECISIONS.md](./DECISIONS.md)（若涉及架构选择）
