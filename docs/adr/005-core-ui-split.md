# ADR-005：core 与 ui 分包

- **状态**：accepted

## 决策

`packages/core`：陪伴文案生成、IndexedDB/localforage 存储、情绪记录、设置 schema、与 React 无关的纯 TS。  
`packages/ui`：React 组件、Electron 桥接、各 mode 壳层。  
`packages/extension`：浏览器扩展，可选依赖 core。

内置形象资源在 `ui/src/static/`，启动时 `configureDefaultAvatars` 注入 core 所用默认列表。

## 后果

- 新业务能力先考虑是否进 core。  
- core 不得 import UI 或静态资源路径。
