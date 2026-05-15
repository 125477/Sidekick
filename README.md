# 灵伴（Sidekick）

在桌面角落陪你的小精灵：**陪伴短句**、**情绪气泡**、**换肤与形象**、**每日抽签**与**收藏历史**，同一套 UI 既跑在 **Electron 挂件**里，也能在浏览器里调试。

---

## 目录

- [亮点速览](#亮点速览)
- [功能说明](#功能说明)
- [技术栈](#技术栈)
- [仓库结构](#仓库结构)
- [环境要求](#环境要求)
- [安装与开发](#安装与开发)
- [常用脚本](#常用脚本)
- [桌面打包](#桌面打包)
- [配置说明](#配置说明)
- [文档与规范](#文档与规范)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 亮点速览

| 维度 | 说明 |
|------|------|
| **形态** | 桌面透明挂件 + 可选**独立气泡窗** + 设置/换肤等**独立辅窗**；同一 `packages/ui` 通过 URL `mode` 切换壳层。 |
| **形象** | 内置 Lottie / GIF / 视频等预设；可扩展上传与「即梦」等生成流（以当前面板为准）。 |
| **陪伴** | 定时或手动推送短句；气泡内支持**重新生成**、复制、收藏、**TTS 朗读**与快捷入口。 |
| **数据** | 本地优先存储；多窗通过 `broadcastSettingsSync` 等保持设置与形象列表一致。 |
| **工程** | **pnpm workspace** + **Turbo**；`core` 与 UI 解耦，便于单测与复用（含可选 **MV3 扩展**包）。 |

---

## 功能说明

### 桌面（Electron）

- **挂件窗**：置顶、透明背景；精灵区可点击出菜单，支持在精灵热区**拖拽移动**整窗（`moveWidgetBy`）；主进程负责工作区夹取与边界持久化。
- **独立气泡窗**：与精灵锚点对齐的几何布局；竖直方向在贴顶/贴底时会自动翻转「在精灵上/下方」，并通过 IPC 把**尾巴方向**同步到渲染进程；水平方向随精灵**贴屏裁切**时可半窗在屏外，与挂件视觉一致。
- **辅窗**：设置、换肤、情绪、抽签、收藏等以独立 `BrowserWindow` 打开，避免窄挂件裁切复杂表单。
- **首次引导**：`onboarding` 模式收集基础偏好，完成后通知主流程。

### 内容与玩法

- **陪伴文案**：与 `@sidekick/core` 中的用例与提示词配合，可接 DashScope 等模型；支持字数上限、推送间隔、是否常驻气泡等设置项（以设置面板为准）。
- **情绪**：快捷反馈与趋势图（Chart.js）。
- **每日抽签**：独立面板玩法。
- **收藏与历史**：文案收藏、历史列表与面板内管理。

### 浏览器与扩展

- **`mode=app`（默认）**：在浏览器中单页体验「面板 + 精灵 + 内嵌气泡」完整路径，适合 UI 开发。
- **`packages/extension`**：Chrome MV3 扩展骨架，可与主产品并行演进。

更细的 **URL `mode` 表**、窗口与 IPC 列表见 **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**。

---

## 技术栈

| 层级 | 选型 |
|------|------|
| **UI** | React 19、Vite 8、Tailwind CSS v4（`@tailwindcss/vite`） |
| **动效 / 媒体** | DotLottie、GIF / 视频形象、Chart.js |
| **桌面** | Electron（主进程脚本为 ESM `.mjs` + `preload.cjs`） |
| **语言** | TypeScript（根 `tsconfig.base.json` 与各包 `tsconfig`） |
| **仓内逻辑** | `@sidekick/core`（无 React 依赖的领域与存储） |
| **编排** | pnpm workspace、Turbo |

---

## 仓库结构

```
.
├── docs/
│   └── ARCHITECTURE.md    # 架构、mode、数据流、主进程模块索引
├── packages/
│   ├── core/              # 领域逻辑、schema、本地存储、DashScope 客户端等
│   ├── ui/                # Vite + React，多 mode 单应用
│   ├── electron-app/      # Electron 主进程、preload、electron-builder 配置
│   └── extension/         # 浏览器扩展（MV3）
├── package.json           # 根脚本与 packageManager（pnpm）
├── pnpm-workspace.yaml
├── turbo.json
└── README.md              # 本文件
```

---

## 环境要求

| 工具 | 说明 |
|------|------|
| **Node.js** | 建议使用当前 **LTS** 主版本，与团队本机一致即可。 |
| **pnpm** | 须与根 `package.json` 的 **`packageManager`** 字段一致；推荐 `corepack enable` 后由 Corepack 自动选用版本。 |

---

## 安装与开发

```bash
# 安装依赖
pnpm install

# 并行启动各包 dev（含 UI Vite、Electron 等，视各包 scripts）
pnpm dev
```

**仅前端（不启 Electron）**：

```bash
pnpm dev:ui
```

默认 Vite 端口见 `packages/ui/package.json`（当前脚本为 **`5173`**）；Electron 开发态会按 `electron-app` 内配置的候选端口去拉取 UI。

---

## 常用脚本

### 根目录

| 脚本 | 作用 |
|------|------|
| `pnpm dev` | Turbo 并行 `dev`。 |
| `pnpm build` | Turbo 全仓 `build`。 |
| `pnpm typecheck` | 全仓 TypeScript 检查。 |
| `pnpm lint` | 全仓 ESLint。 |
| `pnpm format` | Prettier 写回。 |
| `pnpm format:check` | Prettier 仅检查。 |
| `pnpm dev:ui` | 只跑 `packages/ui` 的 Vite。 |
| `pnpm build:ui` | 只构建 UI（`electron-builder` 前通常需要先执行）。 |
| `pnpm pack:desktop` | `build:ui` + `electron-app` 的 `electron-builder` 打安装包。 |
| `pnpm lint:ui` | 仅对 `ui` 包跑 ESLint。 |

### `packages/ui`（节选）

| 脚本 | 作用 |
|------|------|
| `pnpm --filter ui sync:lottie-presets` 等 | 同步内置 Lottie/GIF/Video 预设元数据。 |
| `pnpm --filter ui build` | `tsc -b` + `vite build`。 |
| `pnpm --filter ui preview` | 本地预览构建产物。 |

---

## 桌面打包

```bash
pnpm pack:desktop
```

流程：**先构建 UI**（输出到 `packages/ui/dist`），再执行 **`@sidekick/electron-app` 的 `electron-pack`**，将 `dist` 打进桌面产物。

- **应用图标**：`packages/electron-app/resources/icon.png`（建议 ≥512px；仓库内为高清 PNG），macOS 另由脚本生成 **`icon.icns`** 供 `mac.icon` / `dmg.icon` 使用。
- **DMG**：Finder 里 `.dmg` **文件图标**可能与挂载卷不同，属 macOS 常见表现；以挂载后卷标与 `.app` 内图标为准。

---

## 配置说明

- **环境变量**：若接入 DashScope 等云端能力，密钥与 endpoint 请放在 **`.env`**（已被 `.gitignore` 忽略），切勿提交仓库。
- **各包自有配置**：见各包 `package.json` 与源码内注释；Electron 窗口尺寸常量集中在 `packages/electron-app/scripts/main/constants.mjs`。

---

## 文档与规范

| 文档 | 内容 |
|------|------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 单仓划分、`mode` 路由、主进程模块、气泡与设置数据流。 |
| `.cursor/rules/sidekick-project.mdc` | 包边界、常用命令、TS/ESLint 约定（若 `.gitignore` 未忽略 `.cursor` 则纳入版本控制）。 |
| `.cursor/rules/figma-strict-restore.mdc` | 涉及 Figma 级 UI 还原时的硬性流程（若有设计稿对齐需求）。 |

---

## 常见问题

**Q：为什么本地改了 `.cursor/rules/` 但别人克隆仓库看不到？**  
A：若根 `.gitignore` 包含 `.cursor/`，则规则不会进远程。需要团队共享时请调整 ignore 策略（例如只忽略 `.cursor/` 下个人缓存目录）。

**Q：`pnpm dev` 起不来 Electron？**  
A：先确认 `pnpm dev:ui` 能单独访问；再查 `electron-app` 内 `DEV_SERVER_URL_CANDIDATES` 是否与当前 Vite 端口一致。

**Q：气泡尾巴方向或水平位置不对？**  
A：竖直方向由主进程 `toastPlacement.mjs` 与 `detachedToast` 内同步逻辑共同维护；水平方向已按精灵锚点居中且允许贴屏裁切。若仍异常，请带 **屏幕录屏 + 设置里气泡上下偏好** 提 issue。

---

## 许可证

以仓库内实际 **`LICENSE`** 文件为准；若尚未添加，请在对外分发前自行补充。
