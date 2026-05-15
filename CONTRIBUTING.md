# Contributing to Sidekick

面向**人类贡献者**：开发环境、目录约定、提交流程。更完整的架构说明见 **`docs/ARCHITECTURE.md`**。与 **Cursor / Agent 的硬性规则** 见仓库 `.cursor/rules/`（不在此重复，避免两处维护不一致）。

## 环境要求

- **Node.js**：与团队 CI 对齐的版本（建议 LTS）。
- **pnpm**：仓库根 `package.json` 指定 `packageManager`（例如 `pnpm@10.x`），请使用 Corepack 或本地安装的对应版本。

## 常用命令（仓库根）

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖 |
| `pnpm dev` | Turbo 并行启动各包 `dev`（含 UI Vite、Electron 等，视包脚本而定） |
| `pnpm dev:ui` | 仅启动 `packages/ui` 的 Vite（默认端口见该包 `package.json`） |
| `pnpm build` | Turbo 构建 |
| `pnpm typecheck` | 全仓 TypeScript 检查 |
| `pnpm lint` | 全仓 ESLint |
| `pnpm format` | Prettier 写回格式化 |
| `pnpm format:check` | Prettier 仅检查 |

桌面打包（先构建 UI 再打包 Electron）：

- `pnpm pack:desktop`（根脚本：`build:ui` + `@sidekick/electron-app` 的 `pack`）
- **macOS 图标**：`packages/electron-app/resources/icon.png` 须 **至少 512×512**（electron-builder 校验）；当前仓库内为 1024 导出。若只更新了 UI 里较小的 `app-icon.png`，打包前请用设计稿导出大图覆盖 `resources/icon.png`，或在 macOS 上执行：`sips -z 1024 1024 packages/ui/src/static/app-icon.png --out packages/electron-app/resources/icon.png`。
- **DMG 与 Finder**：**`.dmg` 文件在 Finder / 飞书列表里**常为系统自带的「白底磁盘」图标，**不等于**安装包坏了；**挂载后**的卷标图标、以及 **`.app` 本体图标** 才由 `build.icon` / `dmg.icon`（见 `electron-app/package.json`）驱动。分发时优先发 **`*.dmg`** 或体积更小的 **`*.zip`**，不要拖整个 `release/` 文件夹。

## 目录约定（简要）

- **`packages/core`**：共享领域逻辑与类型（尽量无 UI）。
- **`packages/ui`**：Vite + React 渲染层（`App.tsx` 为多模式入口；具体结构见 `docs/ARCHITECTURE.md`）。
- **`packages/electron-app`**：Electron 主进程脚本（当前入口为 `scripts/dev-main.mjs`）与 `preload` 等。
- **`packages/extension`**：浏览器扩展（若参与该子项目再读其 README）。

更细的边界与演进方向见 **`docs/ARCHITECTURE.md`**。

## 提 PR 前自检

1. **`pnpm typecheck`** 通过（若只改 UI，至少 `pnpm --filter ui typecheck`）。
2. **`pnpm lint`** 或通过子包 lint（与改动范围一致即可）。
3. **行为变更**需在 PR 描述中写清：用户路径、Electron / 纯 Web 是否都测过。
4. **大范围重构**建议拆成多个小 PR，便于 review 与回滚。

## PR 描述建议

- **动机**：修 bug / 性能 / 可维护性。
- **方案**：关键设计决策一两段即可；复杂流程可链到 `docs/` 中的设计说明。
- **验证**：列出你实际点过的场景（例如「独立气泡 + 菜单开关」「挂件 + 推送」等）。

## 设计 / Figma

涉及 UI 视觉还原时，遵循 `.cursor/rules/figma-strict-restore.mdc`（若任务需要）。
