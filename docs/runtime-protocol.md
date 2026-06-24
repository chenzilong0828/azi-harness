# 运行时协议

运行时协议定义 AI 工具进入目标项目后应该读取什么、相信什么、禁止什么。

## 文件职责

| 文件或目录 | 职责 |
| --- | --- |
| `AGENTS.md` | AI 协作短入口，只写读取顺序、硬性禁令和检查命令 |
| `.harness/project.json` | 当前项目机器可读事实 |
| `.harness/config.json` | 允许人工配置的命令和安全覆盖 |
| `.harness/manifest.json` | 运行时文件清单、模板版本和哈希 |
| `.harness/skill-map.json` | 任务到外部 Skill 来源的机器可读匹配规则 |
| `.harness/skill-catalog.json` | Skill 来源、分类、场景、工具适配和安装策略目录 |
| `.harness/docs/` | 目标项目内的人类可读说明，其中 harness 生成的基础说明由运行时管理 |
| `.harness/rules/` | 项目约定、若依、HTWTable、Figma、质量规则 |
| `.harness/reviews/` | `azi review --write` 生成的交付前审查报告 |
| `.harness/proposals/*-review.patch` | Review 建议补丁，只供人工审查，不自动应用 |
| `.harness/proposals/*-figma-source.patch` | Figma 来源建议补丁，只供人工审查，不自动应用 |
| `.harness/proposals/*-implementation.patch` | Figma/自然语言入口生成的候选业务补丁，只供人工审查；`--apply` 时仍保留 |
| `.harness/workflows/` | `azi workflow start/advance` 写入的功能工作流状态 |
| `.harness/figma-cache/` | `azi task` / `azi figma` 写入的节点来源、SVG、降级和重试记录 |
| `.agents/skills/` | Skill 索引和团队补充说明；默认不复制外部 Skill 正文 |
| `.cursor/rules/azi-harness.mdc` | Cursor 薄入口，指回 `AGENTS.md` 和运行时 |
| `specs/` | 功能级需求、设计、页面、任务和验收 |
| `specs/<id-feature>/sdd/` | `azi sdd --write` 生成的阶段辅助文档；不同内容不覆盖 |

## 读取顺序

AI 开始修改代码前，应按顺序读取：

1. `AGENTS.md`
2. `.harness/project.json`
3. `.harness/skill-map.json` 和 `.harness/skill-catalog.json`
4. `.harness/rules/` 和 `.harness/docs/skill-hub.md`
5. 当前功能目录 `specs/xxx/`
6. `.agents/skills/README.md`

如果目标项目已经完成 `azi setup`，用户可以直接对 AI 说“请依照这个 Figma 页面开发：<url>”。AI 看到 Figma URL、按 Figma 开发、还原设计稿等意图时，应优先执行：

```bash
npx azi task "<用户原话>"
```

`azi task` 会自动判断 Figma URL、HTWTable、质量检查、普通功能开发、workflow、Skill match、figma cache、similar pages、implementation context 和 quick check。默认不创建业务页面；只有用户明确允许 `--apply` 或原话明确允许创建缺失页面时，才可创建不存在的建议目标文件。

如果用户原话包含 `HTWTable`、`htw-table`、表格组件或表格 API 核对，`azi task` 会检查目标项目已安装的 HTWTable 公开 API，并在包存在时写入 `.harness/docs/htw-table-api.md`。如果用户原话包含自检、跑检查、质量检查或交付前检查，`azi task` 会运行 quick check，输出 runtime doctor、规格、规则和命令状态。

如果用户原话包含开发、新增、修改、修复、优化、页面、列表、表单等普通功能意图，`azi task` 会自动派生稳定 slug，创建或复用 `specs/<id-feature>/`，写入 `.harness/workflows/<id-feature>.json` 和 `specs/<id-feature>/workflow.md`，输出 Skill 匹配、必读文件、quick check 和下一步。

需要人工明确指定 feature name 或 slug 时，才使用底层入口：

```bash
npx azi workflow start <feature-name> --task "<任务描述>" --yes
```

该命令会创建或复用 `specs/<id-feature>/`，并输出 Skill 匹配、必读文件、下一步和检查命令。
同时会写入：

- `.harness/workflows/<id-feature>.json`
- `specs/<id-feature>/workflow.md`
- `specs/<id-feature>/evidence/`

手动使用 `workflow start` 且功能名为中文时，建议提供稳定英文 slug，例如：

```bash
npx azi workflow start "用户管理列表改造" --slug user-management-list --task "用户管理列表改造" --yes
```

已有规格目录时，也可以只生成上下文：

```bash
npx azi context "<任务描述>"
```

该命令会读取 `.harness/project.json` 和 `.harness/skill-map.json`，并运行 runtime doctor，
返回项目画像、Skill 匹配、必读文件、当前规则、规格提醒、检查命令和 guardrails。
没有命中 Skill 时，按 `.harness/rules/` 与当前规格工作。

工作流状态查看和推进：

```bash
npx azi workflow status
npx azi workflow advance --target specs/<id-feature> --to plan
npx azi workflow log --target specs/<id-feature>
```

阶段状态机固定为：

```text
clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit
```

`workflow advance` 默认不能跳过关键阶段。确需跳过时必须使用 `--force --reason "<人工确认原因>"`，
并把原因写入 `.harness/workflows/*.json` 和 `specs/<id-feature>/workflow.md`。

进入 `coding/test/quality/review/commit` 前，运行时会检查规格是否仍停留在空模板状态。`screens.yaml` 必须记录真实页面来源，`requirements.md` 和 `design.md` 的关键字段必须有明确事实、无此项说明或人工确认结果。确需绕过时只能使用 `--force --reason`。

`workflow.md` 中 `<!-- azi-harness:workflow:start -->` 到 `<!-- azi-harness:workflow:end -->` 是工具生成块。人工备注应写在标记块外，后续阶段推进会保留。

规格驱动检查和辅助生成：

```bash
npx azi sdd status --target specs/<id-feature>
npx azi sdd clarify --target specs/<id-feature> --write
npx azi sdd acceptance --target specs/<id-feature> --write
npx azi sdd retrospective --target specs/<id-feature> --write
```

`requirements.md`、`tasks.md`、`acceptance.md` 分别使用 `REQ-###`、`TASK-###`、`ACC-###`。每个 TASK 和 ACC 必须引用已定义 REQ，重复编号、未知引用和仍为 `draft` 的需求会成为实现前阻塞。

SDD 阶段命令默认只预览，加 `--write` 后写入 `specs/<id-feature>/sdd/`。这些文件只提供澄清、PRD、Issue、任务、验收和复盘结构，不会编造事实或自动改写主规格；已有不同内容时必须人工处理冲突。

Figma 来源记录：

```bash
npx azi task "<包含 Figma URL 的用户原话>"
npx azi figma "<figma-node-url>" --yes
npx azi figma spec --target specs/<id-feature> --url "<figma-node-url>" --write
npx azi figma status --target specs/<id-feature>
npx azi figma fallback --target specs/<id-feature> --source screenshot --reference "<path>" --retried-at "<time>" --write
```

最少指令入口是 `azi task "<用户原话>"`。当原话中包含 Figma URL 时，该命令会自动识别 URL，创建或复用 `workflow start` 规格目录，优先读取 `.harness/figma-cache/` 中相同 fileKey + nodeId 的缓存，缺失时写入 Figma 来源缓存和规格建议补丁，扫描相似页面，生成 `.harness/implementation/<id-feature>/codex-context.md`，并在目标页不存在时生成 `.harness/proposals/<id-feature>-implementation.patch` 候选实现补丁。命令结束前会跑 quick check 并输出结果摘要。

底层入口是 `azi figma "<figma-node-url>" --yes`。若人工明确要直接创建缺失页面，可以使用 `azi task "<用户原话>" --apply` 或 `azi figma "<figma-node-url>" --apply`；它会创建建议目标文件并保留候选补丁，但仍不会覆盖已有页面。

`figma spec` 只接受带 `node-id` 的节点级 URL。`--write` 会写入 `.harness/figma-cache/<id-feature>/source.json`、`nodes.json`、`notes.md`，并生成 `.harness/proposals/<id-feature>-figma-source.patch`。补丁建议更新 `screens.yaml` 和 `design.md`，但不会自动覆盖主规格。

Figma MCP 429、无权限或上下文不足时，使用 `figma fallback` 记录导出图、截图或同项目页面。`retriedAt`、`fallback` 和 `notes` 必须能说明为什么降级以及何时可重试。Figma 和降级来源都只能作为视觉、布局、文案和交互来源，不能推断接口、权限、字典或后端字段。

如果只想查看 Skill 推荐，可执行：

```bash
npx azi skill match "<任务描述>"
```

`skill match` 会返回推荐 Skill 来源、推荐 Skill 名称、匹配原因、约束、回避项和 fallback。
Skill Hub 的完整入口为：

```bash
npx azi skill list
npx azi skill search figma
npx azi skill doctor
npx azi skill sources --json
npx azi skill install-guide obra/superpowers
```

目录中的安装状态采用 `not-verified`：项目运行时不越权扫描各 AI 工具的全局安装目录，也不会自动安装或复制外部 Skill 正文。

交付前执行：

```bash
npx azi review --target specs/<id-feature> --full --diff --evidence --write
npx azi review --target specs/<id-feature> --ci
```

普通审查命令会聚合 runtime doctor、规格追踪、规则检查、staged/unstaged/untracked 变更、任务文件范围、验收证据和检查摘要，并可把报告写入 `.harness/reviews/`。

- `--diff`：附带受长度限制的 tracked diff；untracked 文件只列路径，不伪造 diff。
- `--evidence`：严格检查 ACC 完成状态、证据文件引用和 lint/test/build 真实执行结果。
- `--ci`：隐含 `--diff` 和 `--evidence`；error 或 warning 都会非 0 退出。若依项目会阻断未经证据确认的 API 路径、权限标识、字典类型、绕过请求封装和缺少 HTWTable 证据的改动。
- `--suggest-patch`：只在 `.harness/proposals/` 生成 acceptance.md 的统一 diff 建议，不直接修改任何规格或业务文件。
- 未指定 `--target` 时必须产生风险提示；error 级 finding 必须返回非零退出码。
- 规格沉默时不能虚构意图；只能提示缺少声明，等待人工补充。

## 覆盖策略

- 已存在的用户文件不能被静默覆盖。
- `managed` 文件由运行时维护，`sync` 可以刷新。
- `seeded` 文件首次生成后允许项目补充，后续应谨慎处理。
- 如果需要补充项目特有说明，优先在 `.harness/docs/` 下新增单独文件，避免直接改动 harness 管理的基础说明。
- 已有 `AGENTS.md` 时生成 `.harness/proposals/AGENTS.md.patch`，等待人工合并。
- `doctor --write-proposals` 可以生成 `.harness/proposals/runtime-sync.patch`。
- 项目内默认不生成自写业务 `SKILL.md`；优先使用全局安装的外部 Skill、插件 Skill 或官方 Skill。

## 禁止规则

- 禁止读取、迁移或执行 `.windsurfrules`。
- 禁止从旧项目迁移通用视觉样式。
- 禁止猜接口、权限、字典、后端字段。
- 禁止混用 Vue2 和 Vue3 API。
- 禁止复制或修改 HTWTable 源码。
- 禁止在项目里复制一份外部 Skill 正文，造成多处规则漂移。
