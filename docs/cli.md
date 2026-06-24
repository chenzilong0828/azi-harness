# CLI 使用说明

本项目通过 npm workspace 提供 `azi` CLI。开发阶段可以使用根目录脚本运行：

```bash
npm run azi -- --help
```

发布后目标项目预期使用：

```bash
npx azi-harness setup . --yes
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
azi workflow start <feature-name> [root] [--task <description>] [--slug <feature-slug>] [--dry-run] [--yes] [--json]
azi workflow status [root] [--json]
azi workflow advance [root] --target <spec-path> --to <stage> [--force --reason <text>] [--json]
azi workflow log [root] --target <spec-path> [--json]
azi review [path] [--target <spec-path>] [--diff] [--evidence] [--suggest-patch] [--write] [--json] [--full]
azi sdd <clarify|prd|issues|tasks|acceptance|retrospective> [root] --target <spec-path> [--write] [--json]
azi sdd status [root] --target <spec-path> [--json]
azi figma <figma-node-url> [root] [--feature <name>] [--slug <feature-slug>] [--yes] [--apply] [--json]
azi figma spec [root] --target <spec-path> --url <figma-node-url> [--write] [--json]
azi figma cache [root] --target <spec-path> [--json]
azi figma status [root] --target <spec-path> [--json]
azi figma fallback [root] --target <spec-path> --source <figma-export|screenshot|legacy-page> --reference <path-or-url> [--retried-at <time>] [--notes <text>] [--write] [--json]
azi task <user-task> [root] [--apply] [--json] [--include-avoided]
azi go <user-task> [root] [--apply] [--json] [--include-avoided]
azi context <task-description> [root] [--json] [--include-avoided]
azi htw inspect [path] [--json] [--write-doc]
azi skill list [root] [--category <name>] [--enabled-only] [--json]
azi skill search <keyword> [root] [--json]
azi skill match <task-description> [root] [--json] [--limit <n>] [--include-avoided]
azi skill doctor [root] [--json]
azi skill sources [root] [--json]
azi skill install-guide <source-id> [root] [--json]
azi spec create <feature-name> [root] [--dry-run] [--yes]
azi spec validate [target] [--root <path>] [--json]
```

## 常用流程

## 最少指令入口

团队成员不需要先记住 Figma、workflow、skill match 等子命令。安装运行时后，优先让 AI 读取 `AGENTS.md` 和 `.harness/`，然后直接用自然语言描述任务：

```bash
npm run azi -- task "请依照这个 Figma 页面开发：https://www.figma.com/design/<fileKey>/<name>?node-id=1-2"
```

`azi go` 是同一个入口的别名，文档默认只推荐 `azi task`。

`azi task` 会：

- 自动识别任务中的 Figma URL。
- 检测到 Figma URL 时，走 `azi figma "<url>" --yes` 的同等流程。
- 优先复用 `.harness/figma-cache/` 中相同 fileKey + nodeId 的缓存。
- 缓存缺失时才请求 Figma 资源；遇到 429 会记录 `retriedAt` 和 fallback，避免连续请求。
- 创建或复用 workflow 规格，匹配 Skill，扫描相似页面，生成 `.harness/implementation/<id-feature>/codex-context.md` 和候选实现补丁。
- 默认不创建业务页面；只有加 `--apply` 或用户原话明确允许创建缺失页面时，才会创建不存在的建议目标文件。
- 运行 quick check，并输出前几个阻塞错误和警告。

如果用户原话包含 `HTWTable`、`htw-table`、表格组件或表格 API 核对，`azi task` 会运行 HTWTable 检查，并在包已安装时写入 `.harness/docs/htw-table-api.md`。这一步只收集当前项目已安装版本的公开 API 证据，不改业务代码。

如果用户原话包含自检、跑检查、质量检查、交付前检查等意图，`azi task` 会运行 quick check，输出 runtime doctor、规格、规则和项目命令跳过状态。

没有检测到 Figma URL 时，`azi task` 会退回到 `azi context "<用户原话>"` 的效果：输出项目画像、Skill 匹配、必读文件、规则和检查命令，不写业务文件。

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

低指令启动一个普通功能、修改或修复：

```bash
npm run azi -- task "请开发审计日志列表页面"
```

`task` 检测到开发、新增、修改、修复、页面、列表、表单等意图时，会自动派生稳定 slug，创建或复用 `specs/<id-feature>/`，写入 `.harness/workflows/<id-feature>.json` 和 `specs/<id-feature>/workflow.md`，并输出 Skill 匹配、必读文件、quick check 和下一步。它不写业务代码、不提交、不覆盖已有业务页面。

显式启动一个完整功能工作流：

```bash
npm run azi -- workflow start user-management . --task "根据 Figma 节点还原用户管理页面" --yes
```

如果手动使用 `workflow start` 且功能名是中文，请提供稳定英文 slug；自然语言 `azi task` 会自动派生：

```bash
npm run azi -- workflow start "用户管理列表改造" . --slug user-management-list --task "根据 Figma 节点完成用户管理列表改造" --yes
```

`workflow start` 会：

- 创建或复用 `specs/<id-feature>/`。
- 写入 `.harness/workflows/<id-feature>.json` 工作流状态。
- 写入 `specs/<id-feature>/workflow.md` 和 `specs/<id-feature>/evidence/`。
- 输出 Skill 匹配、必读文件、检查命令和下一步。
- 遇到已有同名 slug 的规格目录时不重复创建。
- 不写业务代码、不提交、不覆盖已有规格文件。
- `--json` 只改变输出格式，不会自动变成预览模式；如需只预览，请同时使用 `--dry-run`。

查看所有进行中的功能：

```bash
npm run azi -- workflow status .
```

推进阶段：

```bash
npm run azi -- workflow advance . --target specs/001-user-management-list --to plan
npm run azi -- workflow advance . --target specs/001-user-management-list --to prd
npm run azi -- workflow advance . --target specs/001-user-management-list --to issues
npm run azi -- workflow advance . --target specs/001-user-management-list --to coding
npm run azi -- workflow advance . --target specs/001-user-management-list --to test
npm run azi -- workflow advance . --target specs/001-user-management-list --to quality
npm run azi -- workflow advance . --target specs/001-user-management-list --to review
npm run azi -- workflow advance . --target specs/001-user-management-list --to commit
```

状态机为：

```text
clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit
```

默认不能跳过关键阶段。确需跳过时必须写明人工确认原因：

```bash
npm run azi -- workflow advance . --target specs/001-user-management-list --to coding --force --reason "人工确认 clarify/plan/prd/issues 已在会外完成"
```

进入 `coding/test/quality/review/commit` 前，规格不能仍是空模板。`requirements.md`、`design.md` 和 `screens.yaml` 的关键字段必须填入真实来源或人工确认结果；如果确实要绕过，必须使用 `--force --reason` 留下人工确认原因。

`workflow.md` 中 `<!-- azi-harness:workflow:start -->` 到 `<!-- azi-harness:workflow:end -->` 之间是工具生成块。可以在标记块外写人工备注，后续 `workflow advance` 会保留这些内容。

查看阶段日志：

```bash
npm run azi -- workflow log . --target specs/001-user-management-list
```

## SDD 规格驱动

检查当前规格是否具备实现条件：

```bash
npm run azi -- sdd status . --target specs/001-user-management-list
```

生成各阶段的结构化辅助内容：

```bash
npm run azi -- sdd clarify . --target specs/001-user-management-list --write
npm run azi -- sdd prd . --target specs/001-user-management-list --write
npm run azi -- sdd issues . --target specs/001-user-management-list --write
npm run azi -- sdd tasks . --target specs/001-user-management-list --write
npm run azi -- sdd acceptance . --target specs/001-user-management-list --write
npm run azi -- sdd retrospective . --target specs/001-user-management-list --write
```

- `clarify/prd/issues/tasks/acceptance/retrospective` 默认只在终端预览，加 `--write` 才会写入 `specs/<id-feature>/sdd/<phase>.md`。
- 辅助文档不会替代或自动修改五个主规格文件；确认后的事实仍需人工回填。
- 已有辅助文件内容不同会报告冲突并退出，不会静默覆盖人工记录。
- `status` 检查 `REQ-###`、`TASK-###`、`ACC-###` 的定义、引用、重复编号和未知引用。
- `TASK` 与 `ACC` 必须关联已定义的 `REQ`；`Status / 状态：draft` 的需求不能进入实现。
- CLI 不猜接口、权限、字典、字段或后端行为，未知事实必须来自项目证据、Figma、接口文档或人工确认。

## Figma 到规格

最简单的用法是直接丢 Figma 节点 URL：

```bash
npm run azi -- figma "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" . --yes
npm run azi -- figma "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" . --apply
```

这条命令会：

- 自动识别 Figma URL，并要求 URL 带 `node-id`。
- 从 Figma 文件名推导功能名和 slug；如果文件名不是英文 slug，则使用 `figma-node-<node-id>`。
- 自动执行 `workflow start`，创建或复用 `specs/<id-feature>/`。
- 写入 `.harness/figma-cache/<id-feature>/source.json`、`nodes.json`、`notes.md`。
- 生成 `.harness/proposals/<id-feature>-figma-source.patch`，建议如何更新 `screens.yaml` 和 `design.md`。
- 如果环境变量 `FIGMA_TOKEN` 存在，会先查本地缓存，缺失时调用 Figma REST API 批量导出 SVG icon，并写入 `.harness/figma-cache/<id-feature>/icons/` 和 `assets.json`。
- 如果没有 `FIGMA_TOKEN`，命令不会失败，只会把 SVG 下载记录为 skipped。
- 如果 Figma 返回 429，会记录 `retriedAt` 并停止继续请求，后续在重试时间前优先使用缓存或 fallback。
- 扫描 `src/views/**/*.vue` 找相似页面，优先识别若依权限、字典、分页、表格和请求封装。
- 生成 `.harness/implementation/<id-feature>/codex-context.md`，里面包含建议目标文件、相似页面、资源缓存、项目规则和 Codex 执行要求。
- 如果建议目标页面不存在，生成 `.harness/proposals/<id-feature>-implementation.patch` 候选业务补丁；如果目标页面已存在，则不生成整页补丁，避免覆盖已有业务代码。
- 如果使用 `--apply`，直接创建缺失的建议目标页面，并仍然保留 `.harness/proposals/<id-feature>-implementation.patch` 供审查；目标页面已存在时不会覆盖。
- 自动运行一遍 quick check，并在输出中汇总规格、规则和项目命令状态。
- 不直接覆盖主规格，也不直接写业务代码；所有规格和实现改动都先进入 `.harness/proposals/`。

如果自动推导的功能名不适合，可以显式指定：

```bash
npm run azi -- figma "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" . --feature "用户管理列表" --slug user-management-list --yes
```

已有规格时，也可以使用底层命令只记录来源：

记录节点级 Figma 来源：

```bash
npm run azi -- figma spec . --target specs/001-user-management-list --url "https://www.figma.com/design/<fileKey>/<name>?node-id=1-2" --write
```

- URL 必须包含 `node-id`，命令会解析并缓存 `fileKey` 和 `nodeId`。
- `--write` 会写入 `.harness/figma-cache/<id-feature>/source.json`、`nodes.json`、`notes.md`。
- 同时生成 `.harness/proposals/<id-feature>-figma-source.patch`，建议如何更新 `screens.yaml` 和 `design.md`。
- 命令不会直接覆盖主规格文件，补丁必须人工审查后再合并。

查看缓存状态：

```bash
npm run azi -- figma status . --target specs/001-user-management-list
npm run azi -- figma cache . --target specs/001-user-management-list --json
```

Figma MCP 429、无法访问或只有导出图/截图时记录降级来源：

```bash
npm run azi -- figma fallback . --target specs/001-user-management-list --source screenshot --reference specs/001-user-management-list/evidence/list.png --retried-at "2026-06-23T10:00:00.000Z" --notes "Figma MCP 429，使用截图继续规格化。" --write
```

降级来源支持 `figma-export`、`screenshot`、`legacy-page`。无论使用 Figma 还是降级来源，都不能从视觉材料推断接口、权限、字典或后端字段。

检查运行时和规格：

```bash
npm run azi -- check . --quick
```

其中 `azi spec validate` 当前会重点检查：

- 5 个规格文件是否齐全。
- `screens.yaml` 是否可解析、字段是否合法、Figma 429 / fallback 信息是否完整。
- `requirements.md`、`design.md`、`tasks.md`、`acceptance.md` 是否保留了团队约定的关键章节。
- `REQ -> TASK -> ACC` 是否可追踪，编号是否重复，引用是否指向已定义需求。
- 关键字段是否仍停留在空模板，例如接口、权限、路由、请求映射、HTWTable 评估。
- `screens.yaml` 是否仍是 `source.type: none` / `status: pending`，以及页面 `route/title` 是否为空。

生成建议补丁：

```bash
npm run azi -- doctor . --write-proposals
```

`doctor` 会检查运行时结构、项目事实、工具适配入口、`skill-map`、`skill-catalog`，并校验 manifest 中的 managed 文件摘要。若工具管理文件被人工改动，会提示运行 `sync` 并人工审查冲突。

检查目标项目安装的 HTWTable 公开 API 线索：

```bash
npm run azi -- htw inspect . --write-doc
```

根据任务描述生成 AI 启动上下文或匹配推荐 Skill：

```bash
npm run azi -- context "根据 Figma 节点还原页面，并完成视觉验收"
npm run azi -- context "普通后台 CRUD 页面，只做纯样式微调" --json
npm run azi -- skill match "根据 Figma 节点还原页面，并完成视觉验收"
npm run azi -- skill match "给列表页增加 ScrollTrigger 动效" --json
npm run azi -- skill match "普通后台 CRUD 页面，只做纯样式微调" --include-avoided
```

浏览和维护 Skill Hub：

```bash
npm run azi -- skill list
npm run azi -- skill list --category design --enabled-only
npm run azi -- skill search figma
npm run azi -- skill doctor
npm run azi -- skill sources --json
npm run azi -- skill install-guide obra/superpowers
```

`skill list/search` 读取 `.harness/skill-catalog.json`，展示来源、分类、启用状态、推荐与回避场景、适配工具和安装策略。
`skill doctor` 同时校验 `.harness/skill-map.json` 与 `.harness/skill-catalog.json`，并检查来源 ID、项目类型和启用状态是否一致。
`skill sources --json` 提供精简的机器可读来源列表；`skill install-guide` 只输出各工具的安装提示，不会修改全局环境。
项目运行时不能可靠读取 Codex、Cursor、Antigravity、OpenCode 或 Harness 的全局 Skill 安装目录，所以安装状态固定为“未验证”，不应把它解释为已安装或未安装。

`context` 会读取 `.harness/project.json`、`.harness/skill-map.json`，把 `.harness/skill-catalog.json` 和 `.harness/docs/skill-hub.md` 放入必读清单，并运行 runtime doctor，
输出给 AI 的启动上下文：项目画像、Skill 匹配结果、必读文件、当前规则、规格提醒、检查命令和 guardrails。
它适合放在一次编码任务开始前使用。

`skill match` 默认读取当前目录 `.harness/skill-map.json`。如需指定目标项目根目录，可使用位置参数或 `--root`：

```bash
npm run azi -- context "写 PRD 并做优先级排序" --root E:/repo
npm run azi -- skill match "写 PRD 并做优先级排序" E:/repo
npm run azi -- skill match "写 PRD 并做优先级排序" --root E:/repo
```

`skill match` 输出会包含匹配来源、推荐 Skill、匹配原因、约束和 fallback。没有命中时，命令会明确要求直接遵守 `.harness/rules/` 和 `specs/`，不在项目里临时发明 Skill。

## 交付 Review

交付前生成审查报告：

```bash
npm run azi -- review . --target specs/001-user-management --full --diff --evidence --write
```

Review v2 会：

- 同时采集 staged、unstaged、untracked 文件，不再只看未暂存 diff。
- 读取 `REQ/TASK/ACC`、tasks.md 的文件声明、HTWTable 决策、acceptance.md 和 evidence/。
- 对比规格声明范围与实际实现文件，标识普通超范围和敏感超范围变更。
- 检查 acceptance.md 是否把未执行的 lint/test/build 写成通过。
- 每条关键 finding 可包含文档意图、实现证据和处理建议。

默认情况下，`review` 使用 quick 模式，不执行项目 lint/test/build。`--evidence` 会诚实报告这些命令未在本次 Review 中执行；需要实际执行项目命令时使用：

```bash
npm run azi -- review . --target specs/001-user-management --full --diff --evidence --write
```

生成可审查建议补丁：

```bash
npm run azi -- review . --target specs/001-user-management --suggest-patch
```

建议补丁写入 `.harness/proposals/<timestamp>-<feature>-review.patch`，内容只建议向 acceptance.md 追加待处理项，不自动应用、不修改业务代码。相同报告重复执行会安全跳过；同名不同内容会报告冲突。

报告会写入 `.harness/reviews/`，用于人工复检和交接。它不会自动提交代码，也不会替代人工 Review。没有 `--target` 时会明确提示无法建立规格意图与实现证据的对应关系；存在 error 时 CLI 退出码为 2。

## 人工审查重点

- `detect --explain` 的证据是否来自当前项目。
- `init --dry-run` 是否会覆盖已有重要文件。
- `AGENTS.md` 是否保持短入口。
- `.harness/project.json` 是否准确描述项目类型、Vue 版本、若依能力和命令。
- `workflow start` 是否复用了正确规格目录，是否写入 `.harness/workflows/*.json` 和 `workflow.md`，输出的下一步是否适合当前任务。
- `workflow advance` 是否按顺序推进；如果使用 `--force`，日志中是否保留了可信的人工确认原因。
- `context` 输出的必读文件、规则和检查命令是否足以让 AI 开始任务。
- `skill match` 的推荐是否符合当前任务，尤其是 `avoidWhenAny` 回避项是否被正确触发。
- `skill doctor` 是否通过；目录中的来源、场景和安装提示是否仍与匹配表一致。
- `review --write` 生成的 `.harness/reviews/` 报告是否记录了真实检查结果和 Git 变更范围。
- `.harness/proposals/` 下的补丁是否需要人工合并。
- `htw inspect --write-doc` 生成的文档是否只来自已安装包公开入口。
