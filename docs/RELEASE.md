# 发布说明（维护者）

本文档供**维护者**发版使用；访客下载见仓库 [README 下载一节](../README.md#下载)。

- **用户下载页**：<https://github.com/125477/Sidekick/releases/latest>
- **全部版本**：<https://github.com/125477/Sidekick/releases>

---

## 用户下载什么

| 系统 | 安装包（文件名以 `electron-builder` 实际输出为准） | 说明 |
|------|--------------------------------------------------|------|
| **macOS** | `Lingban-<版本>-arm64.dmg` | 应用内显示名仍为「灵伴」；未公证时首次打开需在「系统设置 → 隐私与安全性」中允许。 |
| **Windows** | `Lingban-Setup-<版本>.exe` | 当前配置为 **x64**；进程名仍为 Sidekick；未代码签名时 SmartScreen 可能提示。 |

产物目录（已 `.gitignore`）：`packages/electron-app/release/`

**安装包文件名 vs 应用显示名**：GitHub Release 等资源 URL 对中文文件名支持差，上传后可能只剩 `1.1.0-arm64-mac.zip`。因此 **`productName` 仍为「灵伴」**（启动台、Dock、关于页显示），**发布文件名统一用 ASCII 前缀 `Lingban-`**（与 `appId` `app.lingban.companion` 一致）。用户看到的仍是灵伴，下载的是 `Lingban-1.1.0-arm64-mac.zip` 等。

---

## 维护者：发一个新版本

### 1. 准备版本号

以下位置的 **`version` 建议一致**（至少 `packages/electron-app/package.json` 与 Git 标签）：

- 根目录 `package.json`（`0.1.0`）
- `packages/electron-app/package.json`（当前 shipping 版本 **1.2.0**）

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
3. **Release title**：例如 `v1.1.0` 或 `灵伴 1.1.0`
4. **Describe**：从 `CHANGELOG.md` 粘贴，或直接使用 [`RELEASE_NOTES_v1.2.0.md`](./RELEASE_NOTES_v1.2.0.md)（或 [`RELEASE_NOTES_v1.1.0.md`](./RELEASE_NOTES_v1.1.0.md)）；可附上：
   - macOS / Windows 各下哪个文件
   - 未签名时的系统安全提示说明
   - 需要的系统版本（如 macOS 12+、Windows 10+）
5. **Attach binaries**：把 `packages/electron-app/release/` 里**全部**与版本相关的产物拖进 **Release assets**：
   - **用户手动安装**：macOS `.dmg`、Windows `Sidekick Setup *.exe`
   - **应用内自动更新（必须）**：
     - macOS：`Lingban-<版本>-arm64-mac.zip`、`latest-mac.yml`、同名 `.zip.blockmap`（勿用中文文件名；`pack:mac` 末尾会同步 yml）
     - Windows：`Sidekick Setup <版本>.exe`、`latest.yml`、对应 `.exe.blockmap`
   - 仅上传 `.dmg` / 安装 `.exe` 时，已安装客户端**无法**通过 `electron-updater` 完成更新
6. 若首版：可勾选 **Set as the latest release**
7. 点击 **Publish release**

也可用 `electron-builder` 直接发布（需 `GH_TOKEN`）：

```bash
# 打包并上传当前平台产物 + yml/blockmap 到 GitHub Release（标签须已存在且 version 一致）
GH_TOKEN=<github_pat> pnpm --filter sidekick-electron exec electron-builder --publish always
```

`packages/electron-app/package.json` 的 `build.publish` 已指向 `125477/Sidekick`。

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
| **应用内自动更新** | 已实现：`electron-updater`（启动约 12s 后检查、后台下载）；设置 → 通用 → **版本更新** 可手动检查 / 重启安装。 |

---

## 环境变量与密钥

Release **安装包内**若需 DashScope 等能力，仍由用户在本机 **设置面板** 或 `.env`（开发态）配置，不要把 API Key 打进安装包或上传到 Release。
