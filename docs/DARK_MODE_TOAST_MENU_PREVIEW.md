# 夜间模式 · 气泡 & 菜单（已实现）

## 视觉

- **气泡外卡**：`--sk-toast-shell-*`，深色为紫灰 `#1e1b2e` 系（对齐设置面板 `--sk-frame-bg`）。
- **文案区**：`sk-toast-message-panel`，与设置卡片同色底（`--sk-card-bg`），无外框线。
- **精灵菜单**：沿用 `--sk-content-surface` 等 token，随 `html[data-theme='dark']` 切换。
- **交互**：与日间一致（悬停展开工具栏、轻反馈逻辑不变）。

预览图：`docs/images/dark-mode/sidekick-dark-toast-menu-preview.png`

## 设置 · 夜间模式来源

| 模式 | 行为 |
|------|------|
| **手动** | 「开启夜间」开关 → `settings.darkMode` |
| **跟随系统**（**默认**） | `prefers-color-scheme: dark`，与 macOS / Windows 外观一致 |
| **定时** | 默认 **20:00–06:00**（可改开始/结束），由灵伴自己按本地时钟切换，不读系统日程 |

实现：`packages/ui/src/hooks/useEffectiveDarkMode.ts`、`resolveEffectiveDarkMode.ts`、`@sidekick/core` 的 `isWithinScheduledInterval`。

主题同步窗口：挂件、独立气泡、精灵菜单、设置/引导面板（`App.tsx` `themeSyncApplies`）。
