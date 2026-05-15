# Sidekick 架构说明

本文给**人类**阅读：多包职责、UI 入口形态、Electron 主进程与后续拆分方向。Agent 侧规则仍以 `.cursor/rules/` 为准。

## 单仓结构（pnpm workspace）

```
packages/
  core/           # 共享逻辑、存储模型、与 UI 无关的能力
  ui/             # React + Vite 前端（同一套代码跑多「模式」）
  electron-app/   # Electron 主进程、preload、打包配置
  extension/      # 浏览器扩展（独立子产品）
```

根目录 `package.json` 使用 **Turbo** 编排 `dev` / `build` / `lint` / `typecheck`。

## `packages/ui`：单应用、多壳（mode）

运行时由 **URL query**（`readAppSearchParams()`）解析 `mode` 等参数，典型包括：

| `mode` | 用途 |
|--------|------|
| （默认 / `app`） | 浏览器内「主应用」演示：面板 + 精灵 + 内嵌气泡等 |
| `widget` | 桌面挂件精灵窗 |
| `toast` | 独立气泡窗（Electron 加载同一 dist） |
| `panel` | 独立设置类面板窗 |
| `onboarding` | 首次引导窗 |
| `sprite-menu` | 无独立菜单进程时，用弹窗模拟菜单页 |

**`App.tsx`** 承担：全局状态、设置/形象/推送、与 `window.sidekickDesktop` 的桥接、按 `mode` 分发到 `HostAppMain` / `WidgetSpriteLayer` / `DetachedToastShell` 等。体量已从单文件巨石拆为薄入口 + hooks：

| 模块 | 职责 |
|------|------|
| **`app/useAppBootstrap.ts`** | 加载设置/形象/历史、订阅同步、形象持久化 |
| **`app/useAppModeShell.ts`** | 各 mode 的 document class、主题、resize、引导、精灵锁定/穿透、idle 动效 |
| **`app/useDetachedSpriteMenu.ts`** | 独立精灵菜单窗布局与浏览器 popup 桥接 |
| **`app/useAppMenuMachine.ts`** | 菜单/气泡状态机、blur 关闭、panel query 解析 |
| **`app/useCompanionActions.ts`** | `showToastMessage`、`handleMenuAction`、引导完成、陪伴文案请求等 |
| **`app/useScheduledCompanionPush.ts`** | 定时陪伴推送 |
| **`app/openAuxPanelFromBridgeOrDispatch.ts`** | 从气泡工具栏打开辅窗（桥接或 dispatch） |

**气泡组件 `EmotionToast`**：同一组件在「挂件内嵌」与「独立窗」下复用。入口为薄包装 **`EmotionToast.tsx`**；逻辑与展示已拆到 **`toast/`** 目录：

| 模块 | 职责 |
|------|------|
| **`emotionToastTypes.ts`** | Props 与共享类型 |
| **`useEmotionToastChrome.ts`** | hooks、布局/动画/穿透、重新生成 |
| **`EmotionToastCard.tsx`** | 卡片主体组装 |
| **`EmotionToastMessageCell.tsx`** | 消息格 UI |
| **`EmotionToastUnlockedToolbar.tsx`** / **`EmotionToastLockedChrome.tsx`** | 解锁/锁定工具栏 |
| **`EmotionToastTail.tsx`** / **`EmotionToastToolbarButton.tsx`** / **`EmotionToastToolbarIcons.tsx`** | 尾巴、按钮、图标 |

**静态资源与内置形象**（`packages/ui`）：

- 静态文件在 **`src/static/`**（`lotties/`、`gif/`、`video/`、`avatars/`、`app-icon.png` 等）；Vite `publicDir` 指向该目录，构建时原样复制到 `dist/` 根路径（运行时 URL 形如 **`./lotties/foo.json`**，与 `base: './'` 及 Electron `file://` 一致）。
- 内置 Lottie / GIF 文件名采用 **`lingban-lottie-*.json`**、**`lingban-gif-*.gif`** 前缀；`lottieFolderBuiltinPresets` / `gifFolderBuiltinPresets` 内 **`STABLE_ID_SLUG_BY_FILENAME`** 将新文件名映射到旧 slug，避免已存 `selectedAvatarId` 失效。
- **`core`** 不再依赖 UI 资产目录；启动时 `main.tsx` 调用 `configureDefaultAvatars(DEFAULT_AVATARS)` 注入完整列表供 `loadData` / `mergeAvatarPresetsWithDefaults` 使用。

## `packages/electron-app`：主进程

- **入口**：`scripts/dev-main.mjs`（`package.json` 的 `main`），仅负责 `app` 生命周期、注册 IPC、激活时重建精灵窗。
- **职责**：创建精灵窗 / 气泡窗 / 面板窗 / 菜单子窗、`ipcMain` 处理、与 `packages/ui/dist` 的 `loadURL`、工作区几何与挂件边界持久化等。
- **模块化**：具体实现按职责拆在 **`scripts/main/`**：
  - **`constants.mjs`** / **`paths.mjs`** / **`state.mjs`**：常量、preload 路径、可变单例状态
  - **`widgetBounds.mjs`**：挂件边界读写与落盘
  - **`toastPlacement.mjs`** / **`spriteAnchor.mjs`** / **`detachedToast.mjs`**：气泡相对精灵的几何、锚点刷新、`applyToastWindowBounds`
  - **`toastPassthrough.mjs`**：气泡锁定穿透与精灵窗穿透
  - **`spriteMenu.mjs`**：独立精灵菜单小窗
  - **`windows.mjs`**：各 `BrowserWindow` 的创建与 `loadURL`
  - **`ipcHandlers.mjs`**：`ipcMain` 注册（含 DashScope 代理等）
  - **`geometry.mjs`** / **`route.mjs`**：纯函数（夹取、相交、路由 query 拼装）

- **打包图标**：`packages/electron-app/resources/icon.png`（**须至少 512×512 像素**），`build.icon` 与 **`dmg.icon`** 均指向该文件；electron-builder 会生成 **`.app` 内图标**与 **挂载 DMG 时的卷标图标**。
- **Finder 里的 `.dmg` 文件**：列表/聊天里常为 **系统默认「磁盘映像」白图标**，与 `dmg.icon` 无关；属 macOS 常见表现，**不代表 DMG 内应用图标未生效**。请以挂载后窗口或「应用程序里的 灵伴.app」为准。

`electron-builder` 的 `files` 包含 `scripts/**/*`，新增 `scripts/main/` 下的模块会随打包带上。

## `packages/core`

陪伴文案、历史文本、设置与形象等**与 React 解耦**的数据与 API；`ui` 与 `extension` 通过 workspace 依赖引用。

## 数据流（概念）

- **设置**：本地存储 + 跨窗 `broadcastSettingsSync` / `subscribeSettingsSync`（详见 `App.tsx` 与 `state/`）。
- **气泡**：应用内 `uiReducer` 的 `toastState`；Electron 侧另由主进程 `showToastWindow` / `hideToastWindow` 与独立窗生命周期配合。
- **菜单**：`menuState` 状态机 + 独立菜单窗或内联 `SpriteMenu`；从气泡打开时需区分 `spriteMenuSurface`（避免 IPC 命中错误窗口）。

## 相关文档

- **命令、包边界与编码约定**：`.cursor/rules/sidekick-project.mdc`
- **Figma 1:1 等 UI 硬规则**：`.cursor/rules/figma-strict-restore.mdc`
