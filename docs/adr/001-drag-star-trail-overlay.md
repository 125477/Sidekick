# ADR-001：拖动星星拖尾 — 小窗 overlay

- **状态**：accepted  
- **日期**：2026-05  
- **相关**：`FEATURE_PLAN_V1.1.md` §5（原「流星」方案）

## 背景

拖动桌面精灵时需要在指针轨迹上显示短暂星星特效（约 1–2s 淡出）。若在挂件窗内用 `clientX/Y` 绘制，窗口随 `moveWidgetBy` 移动，轨迹无法留在桌面上。

## 决策

1. **独立 `BrowserWindow`**，`mode=drag-trail`，全透明、`pointer-events: none`、低于精灵窗层级。  
2. **非整屏**：窗口约 **560×400**，在**单次拖动开始时**定位一次（拖动中不再 `setBounds`，避免 Windows 卡顿）。  
3. **屏幕坐标**：挂件 `SpriteShell` 上报 `screenX/screenY`；主进程换算为 overlay 内局部坐标；批量 `sidekick:drag-trail-points` 降低 IPC。  
4. **性能**：24fps、粒子上限 ~56、预渲染彩色贴图、小窗全量 `clearRect`；精灵窗就绪后 `warmDragTrailWindow` 预加载拖尾页。  
5. **开关**：`settings.motionEnabled === false` 时不启用；尊重 `prefers-reduced-motion`。

## 否决方案

| 方案 | 原因 |
|------|------|
| 挂件窗内 Canvas | 轨迹随窗移动，无桌面拖尾 |
| 整屏 workArea overlay | 每帧大面积合成，明显卡顿 |
| 主进程 Native 绘制 | 开发与维护成本高 |

## 主要文件

- `packages/electron-app/scripts/main/dragTrail.mjs`
- `packages/ui/src/app/DragTrailOverlayPage.tsx`
- `packages/ui/src/components/sprite/spriteDragStarTrailCore.ts`
- `packages/ui/src/utils/desktopDragTrail.ts`

## 后果

- 多一个 Chromium 实例（拖尾窗），拖动时唤醒。  
- 跨显示器长距离拖动时，小窗会多次 reposition（已节流）。  
- FEATURE_PLAN 中「流星」文案与设置字段名已过时，以本 ADR 为准。
