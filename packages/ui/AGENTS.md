# packages/ui — Agent 说明

> 上级规范：[../../AGENTS.md](../../AGENTS.md)

## 职责

- Vite + React 全部界面；`App.tsx` 按 `readAppSearchParams().mode` 分支
- Tailwind v4；语义样式见 `src/styles/tokens.css`、`utilities.css`
- 状态：settings、uiState、localforage；**不**写复杂领域规则（调用 `@sidekick/core`）

## 边界

- 业务与 prompt 在 **core**；本包做展示、桥接、IPC 调用
- 仅本包使用 Tailwind；勿在 `core` 引 UI

## Electron 桥接

- 类型：`src/types/electron.d.ts`（与 preload 同步）
- 陪伴文案：`src/app/companionCopy.ts` → core `generateCompanionCopyViaAgent`
- 改 IPC 时同步 **electron-app** 三处（见根 AGENTS.md）

## 多窗 `mode`（勿改错窗）

| mode | 用途 |
|------|------|
| `widget` | 精灵挂件 |
| `toast` | 独立气泡 |
| `panel` | 设置 / 情绪等辅窗 |
| `drag-trail` | 拖动星星 overlay |

详见 [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)。

## UI 改动

- 视觉任务遵循 Figma 严格还原规则；优先 token，禁止硬编码 `#hex`
- 静态资源：`src/static/`；Lottie 等用相对路径 `./lotties/...`
- Windows：避免仅大小写不同的文件名（Vite 会撞车）

## 常用命令

```bash
# 在 packages/ui
pnpm dev        # :5173
pnpm typecheck
pnpm lint
```
