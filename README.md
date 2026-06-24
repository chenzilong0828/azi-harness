# azi-harness

`azi-harness` 是安装到前端项目里的团队级 AI 开发运行时。

它不是新的代码生成器，也不是让用户记更多 CLI 子命令；它把项目事实、团队规则、Figma 缓存、Skill 匹配、相似页面和交付检查放进 `.harness/`，让 Codex、Cursor、OpenCode、Antigravity IDE、Harness 等 AI 工具读到同一套上下文。

当前重点支持若依 Vue2、若依 Vue3、普通 Vue2/Vue3 后台项目，以及 uniapp 项目。

## 最简单用法

在目标项目里安装并初始化：

```bash
npm install -D azi-harness
npx azi-harness setup . --yes
```

然后直接对 AI 说：

```text
请依照这个 Figma 页面开发：<url>
```

AI 看到 `AGENTS.md` 和 `.harness/` 后，会自动读取项目事实、优先复用 `.harness/figma-cache/`，必要时调用 `azi figma "<url>" --yes` 的同等流程，找相似页面、匹配 Skill、生成 Codex/AI 可执行上下文、跑 quick check / review，并输出阻塞项。只有明确允许 `--apply` 时，才会创建缺失目标页面；已有业务页面只做最小补丁。

如果想显式走统一自然语言入口：

```bash
npx azi-harness task "请依照这个 Figma 页面开发：<url>"
```

## 它会帮团队记住什么

- 项目事实：Vue 版本、若依类型、UI 框架、请求封装、分页约定、HTWTable 状态。
- 团队约束：权限、字典、路由、菜单、store、公共组件不能凭空生成或随意覆盖。
- Figma 缓存：相同 fileKey + nodeId 下次优先读 `.harness/figma-cache/`，避免重复请求 Figma API/MCP 和 429。
- Skill 匹配：按任务提示 Figma、Superpowers、HTWTable、Review 等合适能力。
- 交付证据：workflow、specs、implementation context、reviews、proposals，让多人和多 AI 能接续。

## 文档入口

- 源码项目文档中心：[docs/README.md](./docs/README.md)
- 完整产品规划正文：[docs/PRD-azi-harness.md](./docs/PRD-azi-harness.md)
- 两张参考图差距路线图：[docs/development-plan.md](./docs/development-plan.md)
- 根目录 PRD 入口：[PRD-azi-harness.md](./PRD-azi-harness.md)
- 模型交接记忆：[docs/MEMORY.md](./docs/MEMORY.md)

## 当前已实现范围

- 识别 6 类目标项目：若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp、unknown。
- 安全初始化和同步 `.harness/` 运行时目录。
- 生成简短的 `AGENTS.md` 入口文件。
- 生成 `.harness/`、`.agents/skills/`、`specs/` 运行时结构。
- 项目内不再生成自写业务 `SKILL.md`，改为生成 `.harness/skill-map.json`、`.harness/skill-catalog.json` 和中文 Skill Hub。
- 提供 `azi skill list/search/match/doctor/sources/install-guide`，用于浏览、搜索、匹配、校验和查看外部 Skill 安装提示。
- 提供 `azi context "<任务描述>"`，合成项目画像、Skill 匹配、必读文件、当前规则和检查命令，作为 AI 启动上下文。
- 提供 `azi task "<用户原话>"` / `azi go "<用户原话>"` 作为统一自然语言入口，自动判断 Figma、HTWTable、质量检查、普通功能开发或上下文任务，并触发缓存、相似页面、Skill 匹配、workflow、实现上下文、API 证据或 quick check。
- 提供 `azi workflow start/status/advance/log`，一条命令启动功能规格、写入 `.harness/workflows/` 状态，并可追踪阶段推进。
- 工作流进入编码、测试、质检、Review、Commit 前会检查规格是否仍为空模板；确需绕过时必须使用 `--force --reason` 留痕。
- 提供 `azi sdd clarify/prd/issues/tasks/acceptance/retrospective/status`，生成阶段辅助文档并校验 `REQ -> TASK -> ACC` 追踪关系。
- SDD 辅助文档默认只预览；加 `--write` 后写入 `specs/<id-feature>/sdd/`，已有不同内容会冲突退出，不静默覆盖。
- 提供 `azi figma <url> --yes` 和 `azi figma spec/cache/status/fallback`，记录节点级 Figma 来源、缓存 429 / fallback 信息、下载 SVG、寻找相似页面、生成 Codex 实现上下文、候选实现补丁和 quick check 结果。
- 提供 Review v2：对比规格意图与 staged、unstaged、untracked 变更，检查超范围文件、验收证据和命令结果声明。
- 提供 `azi review --ci` 守门员模式：CI/MR 中遇到 error 或 warning 都会非 0 退出；若依项目会阻断未经证据确认的 API 路径、权限标识、字典类型、绕过请求封装和缺少 HTWTable 证据的改动。
- `azi review --suggest-patch` 只在 `.harness/proposals/` 生成 acceptance 建议补丁，不直接修改业务或规格文件。
- 创建和校验功能规格目录。
- `spec validate` 会校验规格章节结构、关键字段是否填入、`screens.yaml` 的来源与降级记录。
- 提供 `doctor` 和 `check` 检查流程，覆盖运行时、manifest 摘要、Skill Catalog、规格、规则和项目命令。
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
npm run azi -- workflow start user-management . --task "根据 Figma 节点还原用户管理页面" --yes
npm run azi -- workflow start "用户管理列表改造" . --slug user-management-list --task "根据 Figma 节点完成用户管理列表改造" --yes
npm run azi -- workflow status .
npm run azi -- workflow advance . --target specs/001-user-management-list --to plan
npm run azi -- workflow log . --target specs/001-user-management-list
npm run azi -- sdd clarify . --target specs/001-user-management-list --write
npm run azi -- sdd status . --target specs/001-user-management-list
npm run azi -- figma "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" . --yes
npm run azi -- figma "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" . --apply
npm run azi -- task "请依照这个 Figma 页面开发：https://www.figma.com/design/<fileKey>/<name>?node-id=1-2"
npm run azi -- task "请开发审计日志列表页面"
npm run azi -- figma spec . --target specs/001-user-management-list --url "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" --write
npm run azi -- figma fallback . --target specs/001-user-management-list --source screenshot --reference specs/001-user-management-list/evidence/list.png --retried-at "2026-06-23T10:00:00.000Z" --write
npm run azi -- figma status . --target specs/001-user-management-list
npm run azi -- context "根据 Figma 节点还原页面并完成视觉验收"
npm run azi -- skill list
npm run azi -- skill search figma
npm run azi -- skill match "根据 Figma 节点还原页面并完成视觉验收"
npm run azi -- skill doctor
npm run azi -- skill install-guide obra/superpowers
npm run azi -- review . --target specs/001-user-management --full --diff --evidence --write
npm run azi -- review . --target specs/001-user-management --ci
npm run azi -- review . --target specs/001-user-management --suggest-patch
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
azi workflow start <feature-name>
azi workflow status
azi workflow advance --target <spec-path> --to <stage>
azi workflow log --target <spec-path>
azi sdd clarify|prd|issues|tasks|acceptance|retrospective --target <spec-path> [--write]
azi sdd status --target <spec-path>
azi figma <figma-node-url> [--yes] [--apply]
azi figma spec --target <spec-path> --url <figma-node-url> [--write]
azi figma cache --target <spec-path>
azi figma status --target <spec-path>
azi figma fallback --target <spec-path> --source <figma-export|screenshot|legacy-page> --reference <path-or-url> [--retried-at <time>] [--write]
azi task <user-task> [--apply]
azi go <user-task> [--apply]
azi review [--ci] [--diff] [--evidence] [--suggest-patch]
azi context <task-description>
azi htw inspect
azi skill list
azi skill search <keyword>
azi skill match <task-description>
azi skill doctor
azi skill sources
azi skill install-guide <source-id>
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
│   ├── skill-map.json
│   ├── skill-catalog.json
│   ├── proposals/
│   ├── reviews/
│   ├── workflows/
│   ├── figma-cache/
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
- 开始任务时优先运行 `azi task "<用户原话>"`，让 harness 自动判断是否需要 Figma 缓存、HTWTable 证据、quick check、workflow/spec 或普通上下文。
- 用户给出 Figma URL、说“按 Figma 页面开发”或“还原设计稿”时，优先运行 `azi task "<用户原话>"`；它会自动路由到 Figma 缓存、相似页面、Skill 匹配、实现上下文和 quick check。
- 用户说“使用 HTWTable / 核对表格 API”时，`azi task "<用户原话>"` 会自动检查目标项目安装的 HTWTable 公开 API，并写入 `.harness/docs/htw-table-api.md`。
- 用户说“自检 / 跑检查 / 交付前检查”时，`azi task "<用户原话>"` 会自动运行 quick check，输出规格、规则和命令状态。
- 用户说“开发 / 新增 / 修改 / 修复某个功能”且没有 Figma URL 时，`azi task "<用户原话>"` 会自动派生稳定 slug，创建或复用规格目录，写入 `.harness/workflows/<id-feature>.json` 和 `specs/<id-feature>/workflow.md`，并输出 Skill 匹配、必读文件、quick check 和下一步。
- `azi workflow start <feature-name> --task "<任务描述>" --yes` 保留为显式底层入口，适合人工指定 feature name 与 slug。
- 用 `azi workflow status` 查看所有进行中的功能；用 `azi workflow advance --target specs/<id-feature> --to <stage>` 推进阶段；用 `azi workflow log --target specs/<id-feature>` 查看日志。
- 编码前运行 `azi sdd status --target specs/<id-feature>`。每个 `TASK-###` 和 `ACC-###` 必须关联已定义的 `REQ-###`；仍为 `draft` 的需求会阻止进入实现阶段。
- `azi sdd <phase> --target specs/<id-feature>` 默认只预览结构化辅助内容；确认后加 `--write` 写入规格目录的 `sdd/`，不会改写 `requirements.md` 等主规格。
- 最简单的 Figma 入口是 `azi figma "<figma-node-url>" --yes`：它会自动识别 Figma URL、创建或复用 workflow 规格、缓存来源，并生成规格建议补丁。
- 设置 `FIGMA_TOKEN` 后，`azi figma "<figma-node-url>" --yes` 会用 fileKey + nodeId 优先读取 `.harness/figma-cache/`；缺失时才调用 Figma REST API 批量导出 SVG icon，并缓存到 `icons/` 和 `assets.json`。
- 缓存命中、缓存缺失、429 和 fallback 会在输出中明确显示；429 会写入 `retriedAt`，后续运行会先使用本地记录，避免连续请求 Figma。
- `azi figma "<figma-node-url>" --yes` 还会扫描相似页面，生成 `.harness/implementation/<id-feature>/codex-context.md`，供 Codex 直接执行页面实现或最小补丁。
- 如果建议目标页面不存在，直接入口会生成 `.harness/proposals/<id-feature>-implementation.patch` 作为候选业务补丁；若目标页面已存在，则只给上下文，避免重写业务代码。
- 如果你明确希望直接创建缺失的目标页面，可以使用 `azi figma "<figma-node-url>" --apply`；它会同时保留候选补丁，但不会覆盖已有目标文件。
- 直接入口会自动跑一遍 quick check，并在输出里汇总规格、规则和命令跳过状态。
- Figma 节点必须使用带 `node-id` 的节点级 URL；`azi figma spec --write` 会写入 `.harness/figma-cache/` 并生成 `.harness/proposals/*-figma-source.patch`，不会直接覆盖规格文件。
- Figma MCP 429、无法访问或仅有截图时，使用 `azi figma fallback --source <figma-export|screenshot|legacy-page> --reference <path-or-url> --retried-at <time> --write` 记录降级来源。
- `workflow.md` 的工具生成内容会放在 `azi-harness` 标记块内；标记块外的人工备注会在阶段推进时保留。
- 阶段状态机为 `clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit`。默认不能跳阶段，确需跳过必须加 `--force --reason "<人工确认原因>"`。
- 中文功能名直接走 `azi task "<用户原话>"` 会自动派生稳定 slug；手动使用 `workflow start` 时仍建议提供英文 slug，例如 `azi workflow start "用户管理列表改造" --slug user-management-list --task "用户管理列表改造" --yes`。
- 使用 `azi skill list` 查看目录、`azi skill search <关键词>` 搜索来源、`azi skill doctor` 校验目录与匹配表；只需要查看任务推荐与回避原因时运行 `azi skill match "<任务描述>"`。
- Skill 的真实全局安装状态不能由项目目录可靠读取，因此统一标为“未验证”；`azi skill install-guide <source-id>` 只给安装提示，不会修改全局环境。
- 交付前运行 `azi review --target specs/<id-feature> --full --diff --evidence --write`，把审查记录写入 `.harness/reviews/`。
- CI/MR 中运行 `azi review --target specs/<id-feature> --ci`；它隐含 `--diff` 和 `--evidence`，并且 warning 也会阻塞。若依项目会阻断凭空新增 API、权限、字典、绕过请求封装和缺少 HTWTable 证据。
- `--diff` 在报告中附带受长度限制的 tracked diff；`--evidence` 严格核对 ACC、evidence 文件和 lint/test/build 的真实结果；未执行的命令不能写成通过。
- Review 会读取 tasks.md 的 `Files / 文件` 声明并与 Git 变更比对；路由、权限、store、请求封装和包配置等敏感超范围变更会阻塞交付。
- 大功能工作流优先考虑 `obra/superpowers`；Figma 相关工作优先使用 `figma` / `figma-use` / `figma-implement-design`。
- 动效任务优先考虑 `greensock/gsap-skills`；产品规划和 PRD 类任务优先考虑 `phuryn/pm-skills`。
- `.windsurfrules` 被明确忽略，不扫描、不迁移、不执行。
- 普通 Vue3 后台列表在目标项目支持时，应优先评估 `htw-table`。
- 使用 HTWTable 前，应先运行 `azi htw inspect --write-doc` 核对目标项目实际安装版本的公开 API。

更多审查说明见 [docs/README.md](./docs/README.md)。
