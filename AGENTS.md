# Sidekick — Agent 协作说明

> **给人和给 AI 共用**：换电脑、换模型、新开 Cursor 会话时，先读本文，再按需打开下方链接。

## 项目是什么

**灵伴（Sidekick）**：Electron 桌面角落挂件 + 陪伴短句气泡 + 设置/换肤/情绪等辅窗。  
同一套 `packages/ui` 构建产物，通过 URL **`?mode=`** 在不同 `BrowserWindow` 里扮演不同壳（精灵 / 气泡 / 面板 / 拖尾 overlay 等）。业务数据与文案逻辑在 **`packages/core`**，与 React 解耦。

**桌面能力仅 Electron**；浏览器 `mode=app` 用于 UI 开发演示，无完整 `window.sidekickDesktop`。

## 必读文档（按顺序）

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 单仓结构、`mode` 表、主进程模块、hooks 分工 |
| 2 | [docs/IPC.md](./docs/IPC.md) | `window.sidekickDesktop` ↔ 主进程 channel 一览 |
| 3 | [docs/FEATURE_PLAN_V1.1.md](./docs/FEATURE_PLAN_V1.1.md) | V1.1 产品需求与技术方案（部分条目实现已演进，见 DECISIONS） |
| 4 | [docs/DECISIONS.md](./docs/DECISIONS.md) | 架构决策索引 |
| 5 | [CHANGELOG.md](./CHANGELOG.md) | 近期实现变更摘要 |

文档索引：[docs/README.md](./docs/README.md)

## 本地开发

```bash
pnpm install
pnpm dev          # UI dev server + Electron（推荐）
# 或 pnpm dev:ui  仅 Vite，浏览器打开 ?mode=app
```

- **UI 入口**：`packages/ui/src/App.tsx`（按 `readAppSearchParams()` 的 `mode` 分支）
- **主进程**：`packages/electron-app/scripts/dev-main.mjs` → `scripts/main/*.mjs`
- **Preload**：`packages/electron-app/scripts/preload.cjs` → 暴露 `window.sidekickDesktop`
- **类型**：`packages/ui/src/types/electron.d.ts`
- 提交前：`pnpm typecheck`（或根目录 turbo 脚本）

## 关键概念（避免改错窗）

| 概念 | 说明 |
|------|------|
| **`mode`** | `widget` 精灵挂件；`toast` 独立气泡；`panel` 设置等；`drag-trail` 拖动星星 overlay；见 ARCHITECTURE |
| **`sidekickDesktop`** | 仅 Electron preload 注入；改 IPC 需同步 preload、`ipcHandlers.mjs`、`electron.d.ts` |
| **精灵拖动** | `SpriteShell` → `moveWidgetBy` 移窗；拖尾 → `beginDragTrail` / 独立小窗 Canvas |
| **设置同步** | `broadcastSettingsSync` / localforage；多窗共用 |
| **辅面板** | `openPanelWindow('settings' \| 'emotion' \| …)` 独立大窗 |

## 功能 → 代码地图（常改）

| 功能 | 主要位置 |
|------|----------|
| 精灵 / 菜单 / 拖动 | `packages/ui/src/components/sprite/`，`WidgetSpriteLayer.tsx`，`SpriteMenu.tsx` |
| 拖动星星拖尾 | `electron-app/scripts/main/dragTrail.mjs`，`ui/.../DragTrailOverlayPage.tsx`，`spriteDragStarTrailCore.ts` |
| 陪伴气泡 | `packages/ui/src/components/toast/` |
| 设置面板 | `packages/ui/src/components/settings/SettingsPanel.tsx` |
| 情绪反馈 | `packages/ui/src/components/emotion/` |
| 陪伴文案 / 存储 | `packages/core/` |
| 窗口与 IPC | `packages/electron-app/scripts/main/windows.mjs`，`ipcHandlers.mjs` |

## 编码约定（Agent）

- **只改任务相关文件**；不顺手大重构、不删无关注释。
- **业务逻辑**优先放 `core`；UI 只做展示与桥接。
- **Electron 三处同步**：`preload.cjs`、`ipcHandlers.mjs`、`electron.d.ts`（+ 使用方）。
- **静态资源**放 `packages/ui/src/static/`，URL 用相对路径 `./lotties/...`。
- **Windows 路径**：避免 `SpriteFoo.ts` 与 `spriteFoo.ts` 仅大小写不同（Vite 解析会撞车）。
- **不要**在未要求时改 `FEATURE_PLAN` 已定稿决策表；实现差异记到 `docs/DECISIONS.md` / `CHANGELOG.md`。
- 产品仅 **Electron** 的能力不要假设浏览器 `app` 模式可用。

## Cursor 规则（若仓库内有）

可选：`.cursor/rules/sidekick-project.mdc`、`.cursor/rules/figma-strict-restore.mdc`（可能被 `.gitignore` 忽略，以仓库实际为准）。

## 对话时建议 @ 的文件

- 改结构 / 多窗：`@docs/ARCHITECTURE.md` `@docs/IPC.md`
- 做 V1.1 需求：`@docs/FEATURE_PLAN_V1.1.md`
- 改拖动拖尾：`@docs/adr/001-drag-star-trail-overlay.md` `@packages/electron-app/scripts/main/dragTrail.mjs`
