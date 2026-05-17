# ADR-002：单 UI dist、多 mode 多窗

- **状态**：accepted

## 决策

`packages/ui` 只构建一份 `dist/`，Electron 各 `BrowserWindow` 通过 `index.html?mode=widget|toast|panel|…` 加载同一产物。`App.tsx` 根据 `readAppSearchParams()` 分支渲染。

## 后果

- 共享依赖与样式，发布简单。  
- 任意 mode 的代码都会打进 bundle（需注意 mode 专用逻辑体积）。  
- 浏览器 `mode=app` 可本地调试大部分 UI，但无 `sidekickDesktop`。
