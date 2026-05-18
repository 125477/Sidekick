# 提交并推送（无变基）

## 说明

本命令完成：**暂存 → 规范提交 → 推送到当前分支上游**。不进行 `fetch` / `rebase`。

**共享规则**：与变基工作流相同的编码、PowerShell 约束与 Commit Message 规范，见同目录下的 [git-workflow-shared.md](./git-workflow-shared.md)。执行前须完整遵守该文件。

## 执行步骤

1. **暂存与提交**

   - 执行 `git add .`。
   - 按 [git-workflow-shared.md](./git-workflow-shared.md) 分析变更并生成 Commit Message。
   - 将 Commit Message 写入临时文件（UTF-8 无 BOM），执行 `git commit -F <临时文件>`（**禁止**用 `git commit -m` 承载中文或非 ASCII，除非用户明确要求且环境已验证无乱码）。
   - 立刻执行 `git show -s --format=%B HEAD` 校验提交信息可读性；若乱码，重提后再继续。

2. **推送**

   - 若当前分支已设置上游：执行 `git push`。
   - 若未设置上游：执行 `git push -u origin <当前分支名>`（或等价命令），并告知用户已建立跟踪关系。

3. **失败处理**

   - 若 `git push` 因非快进被拒绝，**不要**自动 force；说明原因并给出可选方案（例如先拉取/变基，或让用户明确指示后再操作）。
