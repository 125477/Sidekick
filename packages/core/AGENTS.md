# @sidekick/core — Agent 说明

> 上级规范：[../../AGENTS.md](../../AGENTS.md)

## 职责

- 领域模型、schema、localStore
- 外部 API：DashScope chat/TTS、百炼 Agent（`dashscopeAgentClient`）
- **陪伴文案**：`src/prompts/textPrompt.ts`（prompt、校验、变量组装）
- **今日小结 Agent**：`src/prompts/moodJournalAgentPrompt.ts`
- 用例：`generateCompanionCopy*`、`generateMoodJournal*`、`getCompanionText`

## 边界

- **禁止** React、浏览器 DOM、Electron API
- 不依赖 `packages/ui` / `electron-app`

## 百炼陪伴短句

| 真源 | 说明 |
|------|------|
| `STYLE_GUIDE` / `STYLE_ANTI_FUNCTIONAL` | 语气细则；经 `style_guide` 注入智能体 |
| `buildCompanionAgentUserPromptParams` | 18 个 `user_prompt_params` 键名 |
| `buildCompanionAgentUserPrompt` | `input.prompt` 短任务 |
| `buildCompanionSystemPrompt` | 仅 **chat 回退** 长 system |

控制台：全选 **[docs/BAILIAN_AGENT_PROMPT.md](../../docs/BAILIAN_AGENT_PROMPT.md)** 粘贴（纯文本）  
接入说明：**[docs/BAILIAN_COMPANION_AGENT.md](../../docs/BAILIAN_COMPANION_AGENT.md)**

改 `CompanionCopyStyle` 枚举时：同步 `packages/ui` 设置/引导下拉、`docs/BAILIAN_*` 变量表。

## 常用命令

```bash
pnpm --filter @sidekick/core typecheck   # 若包名仅为 core，在包目录执行 pnpm typecheck
```

在 `packages/core` 目录：`pnpm typecheck`

## 导出

入口 `src/index.ts`；新增公共 API 须显式 export。
