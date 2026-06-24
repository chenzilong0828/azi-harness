# 后续开发计划

本文记录 `azi-harness` 从“AI 约束安装器”继续演进为“团队级前端 AI Coding 工作流套件”的完整路线图。

上一版计划只覆盖了 `workflow start`、`review`、Skill Hub 和 Figma 的一部分，没有完整承接两张参考图中的核心能力。本文按参考图反推八条产品能力主线，并为每条主线定义命令、产物、阶段和验收标准。

## 总目标

让团队成员在目标项目中只需要完成一次接入：

```bash
npx azi-harness setup . --yes
```

之后每次开发任务都能进入统一闭环：

```bash
npx azi workflow start <feature-name> --task "<任务描述>" --yes
npx azi workflow status
npx azi check
npx azi review --target specs/<id-feature> --ci
npx azi commit prepare --target specs/<id-feature>
```

AI 工具应基于同一套项目事实、Skill 匹配、规格、规则、阶段状态、审查报告和交付证据工作。

## 八大核心能力差距

| 核心能力 | 当前状态 | 目标形态 | 计划命令与产物 | 优先级 |
| --- | --- | --- | --- | --- |
| 完整工作流 | 已完成 MVP，正在稳定门禁 | 需求澄清、计划、PRD、Issue 切分、编码、测试、质检、Review、Commit/MR 全流程可追踪 | `azi workflow start/status/advance/log`；`.harness/workflows/`；`specs/<id>/workflow.md` | P0 |
| Skill Hub | 已完成 MVP | 技能列表、安装状态、分类、匹配解释、更新提示、一键调用入口 | `azi skill list/doctor/sources/search/install-guide`；`.harness/skill-catalog.json` | P0 |
| SDD 驱动开发 | 阶段 3 MVP 已完成 | 从一句需求进入规格草案、任务拆分、验收和复盘记录 | `azi sdd clarify/prd/issues/tasks/acceptance/retrospective/status`；`REQ -> TASK -> ACC` | P1 |
| Review / 质量质检 | 有 `check` 和 `review` v1 | 基于 git diff + specs 的审查报告、风险项、建议补丁、交付证据 | `azi review --diff --evidence --write`；`.harness/reviews/` | P1 |
| Figma 流程 | 有规则文档和 `screens.yaml` 校验 | Figma 节点缓存、429 降级记录、规格生成向导 | `azi figma spec/cache/status/fallback`；`.harness/figma-cache/` | P1 |
| 团队协作 | 有文档和 `MEMORY.md` | memory 自动更新、阶段状态、谁做了什么、下一步是什么 | `azi memory update`；`azi handoff create`；`.harness/state/` | P2 |
| GitLab / Commit / PR | 暂无正式能力 | MR 模板、提交说明生成、Issue 切片、验收清单 | `azi commit prepare`；`azi gitlab mr-template/issues` | P2 |
| 多 AI 编辑器适配 | 有 AGENTS 和 Cursor 薄入口 | Cursor、OpenCode、Codex、Antigravity、Harness 的适配输出与差异化规则 | `azi adapters list/sync/doctor`；`.harness/adapters/` | P2 |

## 阶段 0：已完成的基础能力

状态：已完成，继续维护。

已完成：

- 项目识别：若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp、unknown。
- `setup/init/sync` 安全接入。
- `AGENTS.md`、`.harness/`、`.agents/skills/`、`specs/` 生成。
- `doctor/check/spec create/spec validate/htw inspect`。
- `.harness/proposals/` 建议补丁。
- 外部 Skill 来源索引：`obra/superpowers`、`greensock/gsap-skills`、`phuryn/pm-skills`、`github-skill-forge`、Figma 系列。
- `azi context <task-description>`。
- `azi skill match <task-description>`。
- `azi workflow start <feature-name> --task "<任务描述>" --yes` 第一版。
- `azi review --target specs/<id-feature> --write` 第一版。

验收：

- TypeScript 类型检查通过。
- 临时若依 Vue3 fixture 已验证 `setup -> workflow start -> workflow start 重复执行 -> review --write`。
- 生成内容保持中文。

## 阶段 1：完整工作流引擎

状态：已完成 MVP，并在 2026-06-22 完成第一轮稳定化补丁。

目标：

- 把图中的“需求澄清 -> 建立计划 -> PRD 沉淀 -> Issue 切片 -> 编码实现 -> 测试回收 -> 质量质检 -> Review 审查 -> Commit/PR 收尾”变成可追踪流程。
- `workflow start` 不只是创建规格目录，而是创建一个可推进、可审查的工作流状态。

计划命令：

```bash
npx azi workflow start <feature-name> --task "<任务描述>" --yes
npx azi workflow status
npx azi workflow advance --target specs/<id-feature> --to clarify
npx azi workflow advance --target specs/<id-feature> --to prd
npx azi workflow advance --target specs/<id-feature> --to issues
npx azi workflow advance --target specs/<id-feature> --to coding
npx azi workflow advance --target specs/<id-feature> --to test
npx azi workflow advance --target specs/<id-feature> --to quality
npx azi workflow advance --target specs/<id-feature> --to review
npx azi workflow advance --target specs/<id-feature> --to commit
npx azi workflow log --target specs/<id-feature>
```

计划产物：

```text
.harness/workflows/
└── 001-feature-name.json

specs/001-feature-name/
├── requirements.md
├── design.md
├── screens.yaml
├── tasks.md
├── acceptance.md
├── workflow.md
└── evidence/
```

状态机：

```text
clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit
```

每个阶段必须记录：

- 当前阶段。
- 阶段目标。
- 必读文件。
- 推荐 Skill。
- 进入条件。
- 完成条件。
- 未知项。
- 人工确认点。

验收标准：

- `workflow status` 能显示当前项目所有进行中的功能。
- `workflow advance` 不能跳过关键阶段，除非加 `--force` 并记录原因。
- 每个阶段推进都会更新 `workflow.md` 和 `.harness/workflows/*.json`。
- 阶段状态不能和 `tasks.md` 完全脱节。
- 进入 `coding/test/quality/review/commit` 前，规格不能仍是空模板；如确需绕过，必须使用 `--force --reason` 留痕。
- `workflow.md` 使用 `azi-harness` 标记块更新生成内容，标记块外的人工备注必须保留。
- `workflow start --json --yes` 必须实际落盘，`--json` 只改变输出格式；预览必须显式使用 `--dry-run`。

自审要求：

- 不能把工作流做成单纯文档清单。
- 不能让 AI 在需求未知时直接进入编码。
- 每完成一个阶段必须输出下一步和阻塞项。

## 阶段 2：Skill Hub MVP

状态：已完成（2026-06-18）。

目标：

- 对齐“Skill Hub 技能调用”图里的技能中枢能力。
- 让 `.harness/skill-map.json` 从静态匹配表升级为可审查、可搜索、可解释的技能目录。

已实现命令：

```bash
npx azi skill list
npx azi skill search figma
npx azi skill match "<任务描述>"
npx azi skill doctor
npx azi skill sources --json
npx azi skill install-guide obra/superpowers
```

已实现产物：

```text
.harness/
├── skill-map.json
├── skill-catalog.json
└── docs/
    └── skill-hub.md
```

功能点：

- 展示 Skill 来源、分类、启用状态、推荐场景、回避场景。
- 标识适配工具：Codex、Cursor、Antigravity、OpenCode、Harness。
- 标识是否需要人工安装、是否全局可用、是否只是来源索引。
- 对每次匹配给出原因和回避原因。
- 不复制外部 Skill 正文，只保存来源、用途、安装提示和项目约束。

验收标准：

- 普通 CRUD 不误匹配 GSAP / PM / GitHub skill-forge。
- Figma 任务必须匹配 Figma 系列，并保留“先进入规格”的约束。
- 长链路任务必须优先提示 `obra/superpowers`。
- 未命中 Skill 时明确回退到 `.harness/rules/` 和 `specs/`。

阶段自审：

- 类型检查通过：`npm run typecheck`。
- 完整测试通过：21 个测试文件、107 个测试用例。
- 临时若依 Vue3 fixture 已验证 `setup -> skill list/search/match/doctor/sources/install-guide`。
- 普通 CRUD 会回避 GSAP、PM 和 GitHub Skill Forge；Figma 输出“先生成缓存、规格建议、实现上下文和候选补丁，禁止猜业务事实”约束；长链路任务首选 `obra/superpowers`。
- `skill doctor` 能校验目录与匹配表的一致性，且不会把无法验证的全局安装状态伪装成已安装。

## 阶段 3：SDD 驱动开发增强

状态：已完成 MVP（2026-06-22）。

目标：

- 对齐图中的“基于 SDD 的前端 AI Coding Harness Engineering”。
- 从一句需求进入结构化规格、任务拆分、验收清单和复盘记录。

计划命令：

```bash
npx azi sdd clarify --target specs/<id-feature>
npx azi sdd prd --target specs/<id-feature>
npx azi sdd issues --target specs/<id-feature>
npx azi sdd tasks --target specs/<id-feature>
npx azi sdd acceptance --target specs/<id-feature>
npx azi sdd retrospective --target specs/<id-feature>
npx azi sdd status --target specs/<id-feature>
```

定位说明：

- CLI 不凭空编造业务事实。
- CLI 可以生成结构化提示、模板、检查项和待确认问题。
- 真正的 PRD 内容、接口、权限、字段必须来自用户、接口文档、Figma、目标项目证据或人工确认。

已实现：

- `requirements.md`、`tasks.md`、`acceptance.md` 使用 `REQ-###`、`TASK-###`、`ACC-###` 建立追踪。
- `spec validate` 和 `sdd status` 检查缺失编号、重复编号、未知 REQ 引用和未关联需求。
- 仍标记 `Status / 状态：draft` 的需求会阻止规格进入实现就绪状态。
- `clarify/prd/issues/tasks/acceptance/retrospective` 生成结构化辅助文档，默认预览，`--write` 后写入 `specs/<id>/sdd/`。
- 辅助文档使用安全写入计划：相同内容重复执行会跳过，不同内容会冲突退出，不覆盖人工修改。
- CLI 只提供问题、结构、映射和检查项，不自动改写主规格，也不编造接口、权限、字典或后端事实。
- 工作流进入 `coding/test/quality/review/commit` 前会复用增强后的规格与追踪校验。

验收标准：

- 一句需求可以生成待填写的澄清问题和规格草案。
- 规格草案会明确标出未知项，不会伪装成已确认事实。
- Issue 切片能映射到任务、文件范围和验收项。
- 复盘模板能引用规格、工作流和 evidence，且明确区分真实结果与计划。

2026-06-22 自审结果：

- `npm run typecheck` 通过。
- `npm test` 通过：22 个测试文件、116 个测试用例。
- `npm run pack:check` 通过：6 个 workspace 包。
- `npm run bundle` 通过，生成 `dist/azi.js`。
- 临时若依 Vue3 fixture 已验证 `setup -> workflow start -> sdd preview -> sdd write -> 重复写入跳过 -> retrospective -> status`。
- 自动测试覆盖用户修改后的辅助文件冲突保护、路径越界拒绝、重复编号、未知 REQ 引用和 draft REQ 门禁。

## 阶段 4：Review / 质量质检增强

状态：已完成 Review v2 MVP（2026-06-22）。

目标：

- 对齐图中的“质量质检”和“Review 审查”。
- 从简单 `check` 升级到基于 git diff、规格、规则、检查命令和验收证据的交付报告。

计划命令：

```bash
npx azi review --target specs/<id-feature> --write
npx azi review --target specs/<id-feature> --diff --evidence --write
npx azi review --target specs/<id-feature> --suggest-patch
npx azi review --target specs/<id-feature> --json
```

功能点：

- 汇总 git diff 文件列表和 diff stat。
- 检查变更是否超出当前规格范围。
- 检查 `acceptance.md` 是否记录真实执行结果。
- 检查 HTWTable 评估是否缺失。
- 检查 Vue2/Vue3 API 边界。
- 对风险项分级：error、warning、info。
- 生成建议补丁，但不自动改业务代码。

已实现：

- 同时采集 staged、unstaged、untracked 文件，并在 `--diff` 下附带受长度限制的 tracked diff。
- 从 `REQ/TASK/ACC`、tasks.md 文件字段、design.md HTWTable 决策、acceptance.md 和 evidence/ 建立规格意图。
- 对比实际实现文件与任务声明范围，普通超范围变更产生 warning，路由、权限、store、请求封装、共享组件和包配置等敏感超范围变更产生 error。
- 检查 ACC 完成状态、证据文件引用以及 lint/test/build 的记录与本次真实执行结果。
- Vue2/Vue3 API 混用在 Review 中升级为 error。
- Finding 支持 error/warning/info，并可包含意图、实现证据和具体处理建议。
- `--suggest-patch` 只向 `.harness/proposals/` 写入 acceptance.md 的统一 diff 建议，相同内容重复执行安全跳过。
- 没有 `--target` 时明确提示无法审查意图差距；error 级 finding 保持退出码 2。

验收标准：

- 没有规格目标时，报告必须提示风险。
- 有 error 时退出码为非 0。
- 未执行 lint/test/build 不能写成已通过。
- 建议补丁必须写入可审查目录，不直接覆盖业务文件。

2026-06-22 自审结果：

- `npm run typecheck` 通过。
- `npm test` 通过：22 个测试文件、120 个测试用例。
- `npm run pack:check` 通过：6 个 workspace 包。
- `npm run bundle` 通过，生成 `dist/azi.js`。
- 真实临时 Git 仓库已验证 staged、unstaged、untracked、敏感超范围 error、退出码 2、报告和建议补丁落盘。
- 冒烟前后 acceptance.md SHA-256 一致，证明 `--suggest-patch` 没有改写原规格。
- 自动测试覆盖无 target 风险、虚假命令通过声明、缺失证据文件、Vue2/Vue3 API 混用和建议补丁幂等。

## 阶段 5：Figma 到规格半自动流程

状态：MVP 进行中，已完成本地来源缓存与降级记录入口。

目标：

- 对齐图中的 Figma 页面还原流程。
- 解决 Figma MCP 429 后反复请求、上下文丢失、来源不清的问题。

计划命令：

```bash
npx azi figma spec --target specs/<id-feature> --url "<figma-node-url>"
npx azi figma cache --target specs/<id-feature>
npx azi figma status --target specs/<id-feature>
npx azi figma fallback --target specs/<id-feature> --source screenshot --reference "<path>"
```

计划产物：

```text
.harness/figma-cache/
└── 001-feature-name/
    ├── source.json
    ├── nodes.json
    └── notes.md
```

功能点：

- 已实现：只接受带 `node-id` 的节点级 Figma URL，并解析 `fileKey` 与 `nodeId`。
- 已实现：将来源、节点、降级和重试信息写入 `.harness/figma-cache/<id-feature>/`。
- 已实现：生成 `.harness/proposals/<id-feature>-figma-source.patch`，建议更新 `screens.yaml` 和 `design.md`，不直接覆盖主规格。
- 已实现：`fallback` 支持 `figma-export`、`screenshot`、`legacy-page`，可记录 `retriedAt` 和 `notes`。
- 已实现：明确禁止从 Figma 推断接口、权限、字典、后端字段。
- 待实现：接入真实 Figma MCP 响应，把组件、文案、区域、交互等设计事实转成更细的 `screens.yaml` 内容。
- 待实现：自动识别 429 响应并计算/记录建议重试时间。

验收标准：

- 模拟 429 时不会连续调用。
- 降级来源必须写入规格。
- 没有 Figma 时能明确提示使用同项目同类页面。

## 阶段 6：团队协作与 Memory 自动更新

状态：规划中。

目标：

- 对齐图中的“职责内聚”“人机协作边界明确”。
- 让任意 AI 模型接手时知道当前阶段、已完成内容、下一步和阻塞项。

计划命令：

```bash
npx azi memory update
npx azi handoff create --target specs/<id-feature>
npx azi workflow status --json
```

计划产物：

```text
.harness/state/
├── current.json
├── handoff.md
└── decisions.md
```

功能点：

- 自动汇总当前运行时版本、最近规格、最近 Review、阻塞项。
- 生成交接说明，方便 Codex、Cursor、Antigravity、OpenCode 接手。
- 记录人工确认项和未解决问题。

验收标准：

- `memory update` 不覆盖用户手写记忆，优先生成建议补丁或独立文件。
- handoff 能说清“谁做了什么、做到哪、下一步是什么”。
- 不把未执行的检查写成已通过。

## 阶段 7：GitLab / Commit / MR 交付辅助

状态：规划中。

目标：

- 对齐图中的“Commit / PR 收尾”。
- 支持企业内网 GitLab，但默认不自动提交、不自动推送、不自动建 MR。

计划命令：

```bash
npx azi commit prepare --target specs/<id-feature>
npx azi gitlab mr-template --target specs/<id-feature>
npx azi gitlab issues --target specs/<id-feature> --dry-run
```

功能点：

- 生成 commit message 建议。
- 生成 GitLab MR 描述模板。
- 从规格生成 issue 切片建议。
- 汇总检查结果、Review 报告、验收清单和风险项。

验收标准：

- 默认只生成文本和模板，不执行提交。
- 涉及 GitLab API 的动作必须显式参数和人工确认。
- 输出能直接复制进企业 GitLab MR。

## 阶段 8：多 AI 编辑器适配

状态：规划中。

目标：

- 对齐“不绑定单一 AI 编辑器”和“高自由度 / 低耦合”。
- 为 Cursor、OpenCode、Codex、Antigravity、Harness 提供薄入口和差异化适配。

计划命令：

```bash
npx azi adapters list
npx azi adapters sync
npx azi adapters doctor
```

计划产物：

```text
.harness/adapters/
├── codex.md
├── cursor.md
├── opencode.md
├── antigravity.md
└── harness.md
```

功能点：

- Codex：使用 `AGENTS.md` 和 skills。
- Cursor：使用 `.cursor/rules/azi-harness.mdc`。
- OpenCode：生成可读入口说明。
- Antigravity：说明如何读取 AGENTS 和外部 Skill。
- Harness：说明如何读取 `.harness/` 与 `specs/`。

验收标准：

- 适配文件保持薄入口，不复制大段规则。
- `adapters doctor` 能发现适配入口缺失或过期。
- 所有适配仍指向同一套 `.harness/` 和 `specs/`，避免规则分裂。

## 阶段 9：真实项目试点与发布节奏

状态：持续进行。

目标：

- 在真实若依 Vue2、若依 Vue3、uniapp 项目中验证每条能力主线。
- 每个阶段完成后先自审，再决定是否发布 npm 新版本。

试点动作：

- 在 `E:\htw-work\mall_platform` 继续验证 `workflow start`、`review`、后续 Skill Hub。
- 再选一个 Vue2 若依项目，验证 Vue2/Vue3 API 边界和适配文件。
- 再选一个 uniapp 项目，确认当前规则不会误套若依和 HTWTable。

每阶段固定自审：

```bash
npm run typecheck
npm test
npm run pack:check
npx azi-harness setup . --yes
npx azi workflow start smoke-test --task "冒烟测试" --yes
npx azi review --target specs/001-smoke-test --full --diff --evidence --write
```

如果当前环境缺少 npm 或测试依赖，必须记录原因，并至少执行：

- TypeScript 编译检查。
- CLI 帮助和版本输出。
- 临时 fixture 冒烟流程。

## 当前下一步

阶段 1 到阶段 4 已进入可用 MVP。下一步进入阶段 5“Figma 到规格半自动流程”：

1. 接受节点级 Figma URL 并缓存设计事实，降低重复请求和 429 风险。
2. 把来源、节点、降级和重试记录结构化写入规格与缓存目录。
3. 明确禁止从 Figma 推断接口、权限、字典或后端字段。
4. 在真实若依 Vue3 项目试点完整 `workflow -> sdd -> coding -> review` 流程。
5. 根据试点结果再决定 npm 版本发布。
