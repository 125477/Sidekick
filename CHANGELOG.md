# Changelog

本文件记录**实现层面**变更，便于换环境或 AI 对齐现状。产品定稿仍以 `docs/FEATURE_PLAN_V1.1.md` 为准；若冲突见 `docs/DECISIONS.md`。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

（暂无）

## [1.2.0] - 2026-06-01

### Added

- 贴边推送展示秒数可配置（`dockPushDwellSeconds`，默认 15s）。
- 兴趣深化：气泡 hover「点击输入」→ 提交写入 `companionInterests`。
- 收藏句偶尔再现（`favoriteResurfaceEnabled`）。
- 今日小结连续天数徽章（`MoodJournalStreakBadge`）。
- 开机恢复窗口位置、右缘半露与勿扰锁状态。
- 全局快捷键：换一句 / 今日小结 / 导出卡片。
- 陪伴卡片导出面板（多气泡样式、PNG 导出）；工具栏复制改为导出。

### Changed

- 吸附推送 dwell 由硬编码改为主进程读取设置同步值。

## [1.1.0] - 2026-05-22

### Added

- 桌面应用内更新：`electron-updater`（GitHub `125477/Sidekick`）、启动自动检查与后台下载；设置 → 通用 → **版本更新**。
- 陪伴智能体扩展：`similar` / `unlock` / `focus-end` / `journal-closure` / `streak-nudge` / `interest-deepen` 等 trigger；轻反馈提示 3s。
- 情绪历史详情公众号式排版；今日小结多种**文案气泡**；设置 → 文案展示 → **气泡样式**。
- `docs/RELEASE.md`、`docs/RELEASE_NOTES_v1.1.0.md`；`docs/PROMO.md` 推广文案。
- 根目录 `AGENTS.md`、`docs/README.md`、`docs/IPC.md`、`docs/DECISIONS.md`、`docs/adr/*` 文档体系。
- 拖动星星拖尾：独立 `drag-trail` 小窗 overlay（ADR-001）、彩色高亮粒子、IPC 批量打点。
- 面板背景透明度、情绪趋势图、轻量反馈 chips 等 V1.1 相关 UI（详见 FEATURE_PLAN）。

### Changed

- 拖动特效由 FEATURE_PLAN 中的「挂件内流星」演进为「屏幕坐标 + 小窗 Canvas 星星」。
- 拖尾性能：30fps、粒子上限、脏矩形、跟随指针小窗（非整屏）。

### Removed

- 挂件内 `SpriteDragTrailCanvas` / 设置项「拖动流星拖尾」（改由 `motionEnabled` 总控）。

## [历史]

更早变更未逐条录入；自本文件起在 PR / 大功能合并时追加 **Unreleased** 小节即可。
