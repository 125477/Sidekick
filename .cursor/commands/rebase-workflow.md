# 智能提交与变基工作流

## 说明

**共享规则**：编码、PowerShell 约束、Commit Message 规范及分支检测，见同目录下的 [git-workflow-shared.md](./git-workflow-shared.md)。下文仅描述**变基与后续选项**专有步骤。

## 执行步骤

1. **暂存与提交**

   - 执行 `git add .`。
   - 按 [git-workflow-shared.md](./git-workflow-shared.md) 分析变更，生成符合规范的 Commit Message。
   - 将 Commit Message 写入临时文件（UTF-8 无 BOM），执行 `git commit -F <临时文件>`。
   - 立刻执行 `git show -s --format=%B HEAD` 校验提交信息可读性；若乱码，重提后再继续。

2. **拉取最新代码**

   - 执行 `git fetch origin`。

3. **变基与冲突处理**

   - 尝试执行 `git rebase origin/（对应的上游分支）`。
   - **冲突检测**：
     - **如果变基成功**：直接进入步骤 4。
     - **如果发生冲突**：
       - **禁止自动合并**：输出提示 "🛑 检测到冲突，请手动解决冲突文件。"
       - **等待用户**：等待用户在编辑器中解决冲突。
       - **继续指令**：告诉用户解决完冲突后，请再次运行此命令或手动执行 `git add .` 和 `git rebase --continue`。

4. **后续操作选择**

   - 只有在变基完全成功后，向用户展示以下选项（默认为选项 1）：
     - **选项 1 (默认)**: 执行 `git push` 推送代码到当前分支的远程上游分支。
     - **选项 2**: 执行 `git reset --soft HEAD^`。这将撤销刚才的提交，但保留所有代码在暂存区，方便最后检查或修改。

   - 等待用户确认（例如输入 "1" 或 "2"，或直接回车走默认）。
