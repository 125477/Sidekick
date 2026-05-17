# ADR-004：独立气泡 BrowserWindow

- **状态**：accepted

## 决策

陪伴短句可在独立透明窗展示（`showToastWindow`），相对精灵锚点定位（`toastPlacement.mjs`、`setSpriteAnchor`）。竖直方向可翻转 above/below；锁定工具栏时可 `reportToastPassthroughInteractRect` 实现点击穿透。

气泡 UI 与挂件内嵌共用 `EmotionToast` 组件树（`packages/ui/src/components/toast/`）。

## 后果

- 主进程需维护精灵窗移动与气泡窗 `applyToastWindowBounds` 同步。  
- `toast` mode 与 `widget` mode 各跑一份 React 实例，设置通过 `broadcastSettingsSync` 对齐。
