# Sidekick（灵伴）— Agent 协作规范

> **给人和给 AI 共用**。新会话、换模型、换机器时：**先读本文**，再按任务打开子文档。  
> 子包细则：[packages/core/AGENTS.md](./packages/core/AGENTS.md) · [packages/ui/AGENTS.md](./packages/ui/AGENTS.md) · [packages/electron-app/AGENTS.md](./packages/electron-app/AGENTS.md)

## 1. 项目概述

**灵伴（Sidekick）**：Electron 桌面角落挂件 + 智能体陪伴短句 + 情绪日记（今日小结）+ 多窗设置/换肤。

| 层 | 包 | 职责 |
|----|-----|------|
| 领域与 API | `packages/core` | Schema、存储、DashScope/百炼客户端、文案 prompt、用例 |
| 界面 | `packages/ui` | Vite + React；`?mode=` 分壳（widget / toast / panel / …） |
| 桌面 | `packages/electron-app` | 主进程、preload、IPC、打包 |
| 扩展 | `packages/extension` | 浏览器 MV3（按需） |

**桌面能力仅 Electron**；浏览器 `?mode=app` 仅 UI 开发演示，无完整 `window.sidekickDesktop`。

## 2. 必读文档（按顺序）

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 结构、`mode`、主进程、数据流 |
| 2 | [docs/IPC.md](./docs/IPC.md) | `sidekickDesktop` ↔ IPC |
| 3 | [docs/FEATURE_PLAN_V1.1.md](./docs/FEATURE_PLAN_V1.1.md) | V1.1 需求（实现演进见 DECISIONS） |
| 4 | [docs/DECISIONS.md](./docs/DECISIONS.md) | 架构决策索引 |
| 5 | [CHANGELOG.md](./CHANGELOG.md) | 实现变更摘要 |

完整索引：[docs/README.md](./docs/README.md)

### 百炼 / 提示词（修改时必读）

| 文档 | 用途 |
|------|------|
| [docs/BAILIAN_AGENT_PROMPT.md](./docs/BAILIAN_AGENT_PROMPT.md) | **陪伴短句** → 全选复制到百炼系统提示词（纯文本，无 Markdown 包裹） |
| [docs/BAILIAN_COMPANION_AGENT.md](./docs/BAILIAN_COMPANION_AGENT.md) | 陪伴 Agent 接入、18 变量、与 `textPrompt.ts` 分工 |
| [docs/BAILIAN_MOOD_JOURNAL_AGENTS.md](./docs/BAILIAN_MOOD_JOURNAL_AGENTS.md) | 今日小结引导 / 润色（独立百炼应用） |

**改陪伴控制台提示词**：只改 `docs/BAILIAN_AGENT_PROMPT.md`（全选即正文）→ 提交后**提醒维护者全选复制粘贴**到百炼；语气细则真源在 `packages/core/src/prompts/textPrompt.ts`（`style_guide` 变量自动注入）。

## 3. 本地开发

```bash
pnpm install
pnpm dev          # UI + Electron（推荐）
pnpm dev:ui       # 仅 Vite，?mode=app
pnpm typecheck    # 合并前建议全仓
pnpm lint
```

- UI 入口：`packages/ui/src/App.tsx`
- 主进程：`packages/electron-app/scripts/dev-main.mjs`
- Preload / 类型：`preload.cjs` ↔ `ipcHandlers.mjs` ↔ `packages/ui/src/types/electron.d.ts`

## 4. Agent 工作约定

### 4.1 范围与质量

- **只改任务相关文件**；不顺手大重构。
- **业务逻辑放 `core`**；UI 展示与 IPC 桥接。
- 改动后：至少对**受影响包** `pnpm typecheck`；合并前建议根目录 `pnpm lint` + `pnpm typecheck`。
- **不要**在未要求时 `git commit` / `git push`；勿提交 `.env`、密钥。

### 4.2 Electron IPC 三处同步

新增或修改 `window.sidekickDesktop` 能力时，必须同步：

1. `packages/electron-app/scripts/preload.cjs`
2. `packages/electron-app/scripts/main/ipcHandlers.mjs`
3. `packages/ui/src/types/electron.d.ts`

详见 [docs/IPC.md](./docs/IPC.md)。

### 4.3 UI 视觉

涉及布局、颜色、间距、字体时遵循 Figma 还原规则（`.cursor/rules/figma-strict-restore.mdc`）：优先 `packages/ui/src/styles/tokens.css` 与 `utilities.css`，禁止随意硬编码色值。

### 4.4 文档与计划

- 勿擅自改 `FEATURE_PLAN` 已定稿决策表；实现差异记入 `docs/DECISIONS.md` / `CHANGELOG.md`。
- 对外文案：[docs/PROMO.md](./docs/PROMO.md)、根 [README.md](./README.md)。

## 5. 功能 → 代码地图

| 功能 | 主要位置 |
|------|----------|
| 精灵 / 菜单 / 拖动 | `packages/ui/src/components/sprite/` |
| 陪伴气泡 | `packages/ui/src/components/toast/` |
| 陪伴文案 / Agent | `packages/core/src/prompts/textPrompt.ts`，`packages/ui/src/app/companionCopy.ts` |
| 情绪 / 今日小结 | `packages/ui/src/components/emotion/` |
| 设置 | `packages/ui/src/components/settings/SettingsPanel.tsx` |
| 窗口与 IPC | `packages/electron-app/scripts/main/windows.mjs`，`ipcHandlers.mjs` |

## 6. 建议 @ 文件

| 任务 | 文件 |
|------|------|
| 多窗 / 结构 | `@docs/ARCHITECTURE.md` `@docs/IPC.md` |
| 陪伴 / 百炼 | `@docs/BAILIAN_AGENT_PROMPT.md` `@docs/BAILIAN_COMPANION_AGENT.md` `@packages/core/src/prompts/textPrompt.ts` |
| 拖动拖尾 | `@docs/adr/001-drag-star-trail-overlay.md` |

## 7. Cursor 规则（若仓库内有）

`.cursor/rules/sidekick-project.mdc`、`.cursor/rules/figma-strict-restore.mdc`（可能被 gitignore，以仓库为准）。
