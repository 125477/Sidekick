# @sidekick/electron-app — Agent 说明

> 上级规范：[../../AGENTS.md](../../AGENTS.md)

## 职责

- Electron **主进程**：`scripts/dev-main.mjs` → `scripts/main/*.mjs`
- **preload**：`scripts/preload.cjs` → `window.sidekickDesktop`
- IPC：`scripts/main/ipcHandlers.mjs`
- 多窗：`windows.mjs`、拖尾 `dragTrail.mjs`、角标通知等
- 打包：`electron-builder`、图标 `resources/`

## 边界

- 不实现业务文案逻辑；可调 core 或转发给渲染进程
- UI 构建产物来自 `packages/ui`；勿在 main 里写 React

## IPC 变更清单

1. `scripts/preload.cjs` — `contextBridge` 暴露
2. `scripts/main/ipcHandlers.mjs` — `ipcMain.handle`
3. `packages/ui/src/types/electron.d.ts` — TypeScript

文档：[docs/IPC.md](../../docs/IPC.md)

## 开发

```bash
# 仓库根目录
pnpm dev    # 启动 Vite + Electron
```

仅 Electron 包脚本见 `package.json`（`dev` 由根 turbo 编排）。

## 注意

- 面板 URL 带 `?mode=`；dev 下 UI 默认 `localhost:5173`
- 环境变量：如 `SIDEKICK_UI_URL` 可固定 Vite 端口（见 ARCHITECTURE / 主进程常量）
