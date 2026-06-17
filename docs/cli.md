# CLI 使用说明

本项目通过 npm workspace 提供 `azi` CLI。开发阶段可以使用根目录脚本运行：

```bash
npm run azi -- --help
```

发布后目标项目预期使用：

```bash
npx azi-harness setup . --yes
```

未发布到 npm 时，也可以直接从 GitHub 仓库执行：

```bash
npm exec --yes --package=git+https://github.com/chenzilong0828/azi-harness.git -c "azi-harness setup . --yes"
```

其中 `setup` 会自动判断：

- 未接入项目：执行初始化。
- 已接入项目：执行同步。
- 完成后自动补跑 `doctor`。

## 本地开发命令

```bash
npm install
npm run build
npm run typecheck
npm test
npm run pack:check
```

Windows PowerShell 可在构建后使用快速入口：

```powershell
./scripts/azi.ps1 --help
./scripts/azi.ps1 detect . --explain
./scripts/azi.ps1 check . --quick
```

PowerShell 入口只负责检查本地 `node` 和转发参数到 `packages/cli/dist/bin.js`，业务逻辑仍以 TypeScript CLI 为准。

## 当前命令

```text
azi detect [path] [--json] [--explain]
azi setup [path] [--dry-run] [--yes]
azi init [path] [--dry-run] [--yes]
azi sync [path] [--dry-run] [--yes]
azi doctor [path] [--json] [--write-proposals]
azi check [path] [--quick] [--json] [--write-proposals]
azi htw inspect [path] [--json] [--write-doc]
azi spec create <feature-name> [root] [--dry-run] [--yes]
azi spec validate [target] [--root <path>] [--json]
```

## 常用流程

首次接入前先查看识别结果：

```bash
npm run azi -- detect . --explain
```

一条命令接入或更新项目运行时：

```bash
npx azi-harness setup . --yes
```

本地开发时等价命令：

```bash
npm run azi -- setup . --yes
```

如果只想预览初始化会写入哪些文件：

```bash
npm run azi -- init . --dry-run
```

确认写入：

```bash
npm run azi -- init . --yes
```

创建功能规格：

```bash
npm run azi -- spec create user-management . --yes
```

检查运行时和规格：

```bash
npm run azi -- check . --quick
```

其中 `azi spec validate` 当前会重点检查：

- 5 个规格文件是否齐全。
- `screens.yaml` 是否可解析、字段是否合法、Figma 429 / fallback 信息是否完整。
- `requirements.md`、`design.md`、`tasks.md`、`acceptance.md` 是否保留了团队约定的关键章节。

生成建议补丁：

```bash
npm run azi -- doctor . --write-proposals
```

检查目标项目安装的 HTWTable 公开 API 线索：

```bash
npm run azi -- htw inspect . --write-doc
```

## 人工审查重点

- `detect --explain` 的证据是否来自当前项目。
- `init --dry-run` 是否会覆盖已有重要文件。
- `AGENTS.md` 是否保持短入口。
- `.harness/project.json` 是否准确描述项目类型、Vue 版本、若依能力和命令。
- `.harness/proposals/` 下的补丁是否需要人工合并。
- `htw inspect --write-doc` 生成的文档是否只来自已安装包公开入口。
