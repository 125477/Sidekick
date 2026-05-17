# 架构决策记录（ADR 索引）

记录**为何**这样实现，避免后续 AI 或开发者按过期方案（如 FEATURE_PLAN 里的「流星整屏」）改错代码。

格式：状态 `accepted` | `superseded` | `deprecated`；详情见 `docs/adr/` 下独立文件。

| ID | 标题 | 状态 | 摘要 |
|----|------|------|------|
| [001](./adr/001-drag-star-trail-overlay.md) | 拖动星星拖尾用小窗 overlay | accepted | 非整屏第二 Chromium；屏幕坐标 + 跟随指针的 480×360 透明窗 |
| [002](./adr/002-single-ui-dist-multi-mode.md) | 单 UI dist、多 mode 多窗 | accepted | 同一 Vite 构建，query 区分壳；降低维护成本 |
| [003](./adr/003-sprite-move-widget-by.md) | 精灵区 no-drag + moveWidgetBy | accepted | 避免 `-webkit-app-region: drag` 吞点击；热区内 IPC 移窗 |
| [004](./adr/004-detached-toast-window.md) | 独立气泡 BrowserWindow | accepted | 几何由主进程 `toastPlacement` + 精灵锚点；可穿透锁定 |
| [005](./adr/005-core-ui-split.md) | core 与 ui 分包 | accepted | 存储、文案、用例在 core；React 仅展示与桥接 |

## 与 FEATURE_PLAN 的差异（实现演进）

| FEATURE_PLAN 描述 | 当前实现 | 见 |
|-------------------|----------|-----|
| 拖动「流星」、`SpriteDragTrailCanvas` 挂件窗内 | 彩色星星、独立 `drag-trail` 小窗 | ADR-001 |
| `spriteDragTrailEnabled` 设置项 | 跟随 `motionEnabled`，无单独开关 | CHANGELOG |

新增决策：在 `docs/adr/` 增加 `00N-简短英文名.md`，并更新本表。
