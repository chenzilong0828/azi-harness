# azi-harness

`azi-harness` 是一套面向前端团队的 AI Coding 运行时体系。它不是单独的页面代码生成器，也不是只服务某一个编辑器的 CLI，而是让 Codex、Cursor、OpenCode、Antigravity IDE、Harness 等 AI 工具在同一个前端项目中读取同一套项目事实、规则、Skills 和功能规格。

当前重点支持若依 Vue2、若依 Vue3、普通 Vue2/Vue3 后台项目，以及 uniapp 项目。

## 文档入口

- 源码项目文档中心：[docs/README.md](./docs/README.md)
- PRD 文档入口：[docs/PRD-azi-harness.md](./docs/PRD-azi-harness.md)
- 完整产品规划正文：[PRD-azi-harness.md](./PRD-azi-harness.md)
- 模型交接记忆：[docs/MEMORY.md](./docs/MEMORY.md)

## 当前已实现范围

- 识别 6 类目标项目：若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp、unknown。
- 安全初始化和同步 `.harness/` 运行时目录。
- 生成简短的 `AGENTS.md` 入口文件。
- 生成 `.harness/`、`.agents/skills/`、`specs/` 运行时结构。
- 项目内不再生成自写业务 `SKILL.md`，改为生成 `.harness/skill-map.json`、Skill 来源说明和使用索引。
- 创建和校验功能规格目录。
- `spec validate` 会校验规格章节结构，以及 `screens.yaml` 的来源与降级记录。
- 提供 `doctor` 和 `check` 检查流程，覆盖运行时、规格、规则和项目命令。
- 在 `.harness/proposals/` 下生成可人工审阅的建议补丁。
- 检查目标项目已安装的 HTWTable 公开 API 线索。
- 支持 `.harness/config.json` 中的安全配置覆盖。

## 工作区命令

```bash
npm install
npm run build
npm run pack:check
npm test
npm run azi -- --help
```

## 目标项目一条命令接入

发布到 npm 后，目标项目推荐直接使用：

```bash
npx azi-harness setup . --yes
```

这条命令会自动判断当前项目是首次接入还是已接入项目，然后自动执行 `init` 或 `sync`，最后补跑一次 `doctor`。

常用本地命令：

```bash
npm run azi -- detect .
npm run azi -- setup . --yes
npm run azi -- init . --dry-run
npm run azi -- init . --yes
npm run azi -- spec create user-management . --yes
npm run azi -- spec validate specs --json
npm run azi -- check . --quick
npm run azi -- doctor . --write-proposals
npm run azi -- htw inspect . --write-doc
```

Windows PowerShell 快速入口：

```powershell
./scripts/azi.ps1 detect . --explain
./scripts/azi.ps1 check . --quick
```

该入口只负责调用已构建的 TypeScript CLI。首次使用前仍需运行 `npm run build`。

## 已实现 CLI

```text
azi detect
azi setup
azi init
azi sync
azi doctor
azi check
azi htw inspect
azi spec create <feature-name>
azi spec validate [target]
```

## 运行时目录结构

```text
target-project/
├── AGENTS.md
├── .harness/
│   ├── config.json
│   ├── manifest.json
│   ├── project.json
│   ├── proposals/
│   ├── docs/
│   └── rules/
├── .agents/
│   └── skills/
└── specs/
```

## 使用原则

- `AGENTS.md` 必须保持简短，只作为 AI 协作入口。
- 详细规则放在 `.harness/docs/`、`.harness/rules/`、`.agents/skills/` 和 `specs/` 中。
- `.agents/skills/` 默认只保留 Skill 索引，不复制外部仓库的 Skill 正文。
- 大功能工作流优先考虑 `obra/superpowers`；Figma 相关工作优先使用 `figma` / `figma-use` / `figma-implement-design`。
- 动效任务优先考虑 `greensock/gsap-skills`；产品规划和 PRD 类任务优先考虑 `phuryn/pm-skills`。
- `.windsurfrules` 被明确忽略，不扫描、不迁移、不执行。
- 普通 Vue3 后台列表在目标项目支持时，应优先评估 `htw-table`。
- 使用 HTWTable 前，应先运行 `azi htw inspect --write-doc` 核对目标项目实际安装版本的公开 API。

更多审查说明见 [docs/README.md](./docs/README.md)。
