# Changelog

本文件记录**实现层面**变更，便于换环境或 AI 对齐现状。产品定稿仍以 `docs/FEATURE_PLAN_V1.1.md` 为准；若冲突见 `docs/DECISIONS.md`。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

### Added

- `docs/RELEASE.md`：GitHub Releases 发版流程；README 增加「下载（桌面版）」链接。
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
