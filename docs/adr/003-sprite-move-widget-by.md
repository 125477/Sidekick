# ADR-003：精灵热区 no-drag + moveWidgetBy

- **状态**：accepted

## 决策

挂件外层保留 `-webkit-app-region: drag` 作窄环；形象按钮区域 `no-drag`，在 `pointermove` 中调用 `sidekick:move-widget-by` 按 `movementX/Y` 平移窗口。超过 `POINTER_DRAG_THRESHOLD_PX`（6px）视为拖动，松手不打开菜单。

## 后果

- 同一像素既可拖窗又可点击出菜单（Electron `drag` 区域无法点击）。  
- 拖尾起点在越过阈值时 `beginDragTrail(screenX, screenY)`。
