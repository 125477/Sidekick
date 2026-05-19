# 发布说明（维护者）

本文档供**维护者**发版使用；访客下载见仓库 [README 下载一节](../README.md#下载)。

- **用户下载页**：<https://github.com/125477/Sidekick/releases/latest>
- **全部版本**：<https://github.com/125477/Sidekick/releases>

---

## 用户下载什么

| 系统 | 安装包（文件名以 `electron-builder` 实际输出为准） | 说明 |
|------|--------------------------------------------------|------|
| **macOS** | `灵伴-<版本>.dmg`（或同目录下的 `.zip`） | Apple Silicon / Intel 以你本机打包架构为准；未公证时首次打开需在「系统设置 → 隐私与安全性」中允许。 |
| **Windows** | `Sidekick Setup <版本>.exe`（NSIS 安装程序） | 当前配置为 **x64**；未代码签名时 SmartScreen 可能提示，需点「仍要运行」。 |

产物目录（已 `.gitignore`）：`packages/electron-app/release/`

---

## 维护者：发一个新版本

### 1. 准备版本号

以下位置的 **`version` 建议一致**（至少 `packages/electron-app/package.json` 与 Git 标签）：

- 根目录 `package.json`（`0.1.0`）
- `packages/electron-app/package.json`

在 `CHANGELOG.md` 的 **`[Unreleased]`** 下写好本版变更，发版时可新建 `## [0.1.0] - 2026-05-19` 小节。

### 2. 本地打包

```bash
pnpm install

# 仅 macOS（在本机 Mac 上执行）
pnpm pack:desktop:mac

# 仅 Windows（在 Windows 上执行；mac 上无法打 win 安装包）
pnpm pack:desktop:win

# 当前机器能打的平台都会打（Mac 上通常只有 dmg/zip）
pnpm pack:desktop
```

打完后到 `packages/electron-app/release/` 确认 `.dmg` / `.exe` 等文件存在且能安装运行。

### 3. 提交并打标签

```bash
git add CHANGELOG.md package.json packages/electron-app/package.json
# 以及本版其它已改文件
git commit -m "chore: release v0.1.0"
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

标签格式建议 **`v` + 语义化版本**（如 `v0.1.0`），与 Release 标题一致。

### 4. 在 GitHub 创建 Release

1. 打开 <https://github.com/125477/Sidekick/releases/new>
2. **Choose a tag**：选刚推送的 `v0.1.0`（或新建同名 tag）
3. **Release title**：例如 `v0.1.0` 或 `灵伴 0.1.0`
4. **Describe**：从 `CHANGELOG.md` 粘贴本版说明；可附上：
   - macOS / Windows 各下哪个文件
   - 未签名时的系统安全提示说明
   - 需要的系统版本（如 macOS 12+、Windows 10+）
5. **Attach binaries**：把 `packages/electron-app/release/` 里对应安装包拖进 **Release assets**（建议至少上传面向用户的 `.dmg` 与 `.exe`；`.blockmap`、`.yml` 可选，用于自动更新时再考虑）
6. 若首版：可勾选 **Set as the latest release**
7. 点击 **Publish release**

### 5. 验证

- 用无痕窗口打开 <https://github.com/125477/Sidekick/releases/latest>，确认能下载
- 在另一台机器或虚拟机安装 smoke test

---

## 可选后续（非必须）

| 能力 | 说明 |
|------|------|
| **GitHub Actions 自动打包** | push tag 时在 CI 里跑 `electron-builder` 并上传 assets；省本机双平台，但需配置 macOS / Windows runner 与签名密钥。 |
| **独立官网** | 静态页链到 `releases/latest` 即可，仍可不租服务器。 |
| **mac 公证 / Win 签名** | 减少系统安全拦截；需 Apple Developer、Windows 代码签名证书（付费）。 |
| **应用内自动更新** | `electron-updater` + Release 上的 `latest.yml`；可另开需求再做。 |

---

## 环境变量与密钥

Release **安装包内**若需 DashScope 等能力，仍由用户在本机 **设置面板** 或 `.env`（开发态）配置，不要把 API Key 打进安装包或上传到 Release。
