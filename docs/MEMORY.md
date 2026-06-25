# MEMORY

这份文件用于让新的模型或新的协作者快速接手 `azi-harness`。

## 项目目标

`azi-harness` 不是页面代码生成器，也不是单独一个 CLI。

它的目标是为前端团队建立一套统一的 AI Coding 运行时，让 Codex、Cursor、OpenCode、Antigravity IDE、Harness 在同一个项目里遵守同一套：

- 项目识别规则
- 若依约定
- HTWTable 使用规则
- Figma 转规格流程
- Skill 来源与匹配策略
- 自动检查与验收流程
- 工作流启动与交付 Review 记录

## 已确认的关键产品决策

- 套件名称：`azi-harness`
- 包管理器：`npm`
- 2026-06-23 用户明确校准：`azi-harness` 不能继续变成“很多 CLI 指令 + 很多文档”。它必须重新定位为团队级 AI 开发运行时，核心价值是团队规范、项目事实、Figma 缓存、Skill 匹配、若依约束和可复用上下文。
- 用户期望的主体验不是“记住很多命令”，而是自然语言触发。例如用户对 AI 说：“请依照我给的 Figma 页面进行开发”，AI 应该自动读取项目中的 `AGENTS.md` / `.harness/`，识别 Figma URL，优先读缓存，必要时缓存原型图和 SVG，匹配相似页面与合适 Skill，再按若依约束开发。
- 产品定义必须清晰：`azi-harness` 不是替代 Codex/Cursor/MCP/Skill 的智能体，而是给这些工具安装一套项目本地、团队共享、可审查、可缓存、可检查的开发约束和上下文运行时。
- 与“Codex + MCP + Skill + rules”的区别必须落到项目资产：`.harness/project.json`、`.harness/skill-map.json`、`.harness/figma-cache/`、`.harness/rules/`、`.harness/workflows/`、`.harness/reviews/`、`specs/`。这些资产让团队多人、多 AI、多轮开发读取同一套事实，而不是每个会话重新发明规则。
- 后续优先级从“继续加子命令”转为“降低触发成本”：少暴露命令，多让 `AGENTS.md` 和适配器指导 AI 自动调用最少入口。
- `AGENTS.md` 必须保持简短，只做入口
- 详细内容放在 `.harness/docs/`、`.harness/rules/`、`.agents/skills/`、`specs/`
- 完全忽略 `.windsurfrules`
- 不再在项目里生成自写业务 `SKILL.md`
- 优先复用外部 Skill / 插件 Skill / 官方 Skill
- 当前重点 Skill 来源：
  - `obra/superpowers`
  - `greensock/gsap-skills`
  - `phuryn/pm-skills`
  - `YuJunZhiXue/github-skill-forge`
  - `figma` 系列

## 技术边界

### 若依

必须保留目标项目已有约定：

- `v-hasPermi` / `hasPermi`
- `useDict`
- `DictTag`
- 请求封装
- 动态路由和菜单
- `pageNum`、`pageSize`、`rows`、`total`
- 项目已有弹窗、下载、消息能力
- Vue2 / Vue3 分开识别，不能混用

### HTWTable

- 普通 Vue3 后台列表优先评估 `htw-table`
- 不能复制或修改其源码
- 使用前必须以目标项目实际安装版本公开 API 为准
- 例外场景必须在 `design.md` 记录原因
- 当前内网文档入口：`http://192.168.30.4/chenzl2/htw-table-vue`

### Figma

- Figma 默认先进入缓存、规格建议、Codex 实现上下文和候选补丁；只有显式 `--apply` 才允许创建缺失的建议目标页面
- 任何模式都不能覆盖已有业务页面
- `screens.yaml` 必须记录真实来源
- Figma MCP 遇到 429 时必须记录 `retriedAt`、`fallback`、`notes`
- 下一步必须让 AI 在自然语言里自动识别 Figma 任务，而不是要求用户记住 `figma spec/cache/status/fallback` 子命令

## 当前仓库结构

- [README.md](../README.md)：总览和对外使用入口
- [PRD-azi-harness.md](./PRD-azi-harness.md)：完整产品规划
- [docs/README.md](./README.md)：文档中心
- `packages/core`：运行时文件计划、清单、配置与扫描基础能力
- `packages/detectors`：项目识别
- `packages/runtime-templates`：`.harness/`、`AGENTS.md`、`.agents/skills/` 模板
- `packages/spec-kit`：规格模板、`screens.yaml` 校验、规格检查
- `packages/checks`：`doctor/check` 聚合检查
- `packages/cli`：CLI 命令入口

## 当前已完成能力

### 第一阶段

- 项目识别：`ruoyi-vue2-element-ui`、`ruoyi-vue3-element-plus`、`vue2-element-ui`、`vue3-element-plus`、`uniapp`、`unknown`
- `init` / `sync` 安全接入
- `AGENTS.md`、`.harness/`、`.agents/skills/`、`specs/` 生成
- `doctor` / `check`
- `htw inspect`
- 建议补丁写入 `.harness/proposals/`

### 完整工作流引擎

- `workflow start/status/advance/log`
- 状态机：`clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit`
- 状态写入 `.harness/workflows/*.json` 和规格目录的 `workflow.md`
- 默认禁止跳阶段；`--force` 必须同时提供人工确认原因
- 规格证据目录：`specs/<id-feature>/evidence/`
- `workflow.md` 使用 `azi-harness` 标记块更新生成内容，标记块外的人工备注会保留
- 进入 `coding/test/quality/review/commit` 前会检查规格是否仍为空模板；确需绕过必须 `--force --reason`
- `workflow start --json --yes` 会真实落盘，`--json` 只改变输出格式；预览使用 `--dry-run`

### Skill Hub MVP

- 项目内不复制外部 Skill 正文
- 生成 `.harness/skill-map.json`、`.harness/skill-catalog.json`、`.harness/docs/skill-hub.md`
- `skill list/search/match/doctor/sources/install-guide`
- 目录覆盖来源、分类、启用状态、推荐与回避场景、工具适配和安装提示
- 安装状态统一标为“未验证”，不扫描或修改 AI 工具的全局 Skill 环境
- 普通 CRUD 回避 GSAP、PM 和 GitHub Skill Forge；Figma 保留“先规格”约束；长链路优先 Superpowers

### SDD 与交付能力当前进度

- `spec create`
- `spec validate`
- `sdd clarify/prd/issues/tasks/acceptance/retrospective/status`
- 5 个规格文件模板
- `REQ-### -> TASK-### / ACC-###` 追踪关系，检查缺失、重复和未知引用
- 仍标记为 `draft` 的 REQ 会阻止进入实现就绪状态
- SDD 辅助文档默认预览，`--write` 写入 `specs/<id-feature>/sdd/`；相同内容跳过，不同内容冲突，不覆盖人工记录
- SDD 只生成结构化问题和辅助文档，不自动改主规格，不猜接口、权限、字典、字段或后端事实
- `screens.yaml` 来源、状态、429、fallback 校验
- `requirements.md`、`design.md`、`tasks.md`、`acceptance.md` 关键章节和空模板字段校验
- `doctor` 会校验 manifest 中 managed 文件摘要，并把 `.harness/skill-catalog.json` 纳入顶层运行时体检
- `context`：生成 AI 启动上下文
- `skill match`：根据 `.harness/skill-map.json` 匹配外部 Skill 来源
- `workflow start/status/advance/log`：创建、跟踪和审计功能开发阶段
- Review v2：采集 staged/unstaged/untracked，消费规格追踪、任务文件范围、HTWTable 决策和验收证据
- `review --diff --evidence`：检查超范围文件、证据引用和命令结果声明
- `review --ci`：CI/MR 守门员模式，隐含 diff/evidence，error 和 warning 都阻塞；若依项目会检查未经证据确认的 API 路径、权限标识、字典类型、绕过请求封装和缺少 HTWTable 证据的改动
- `review --suggest-patch`：只生成 `.harness/proposals/*-review.patch`，不直接修改 acceptance.md 或业务代码
- Figma 缓存索引：`azi figma` / `azi task` 成功写入节点来源后，会更新 `.harness/figma-cache/index.json`，按 `cacheKey = fileKey:nodeId` 记录所有本地缓存位置，方便团队和 AI 在第二次遇到同一页面时直接命中缓存。

## 当前稳定入口

### 本地开发

```bash
npm install
npm run build
npm test
npm run azi -- setup . --yes
npm run azi -- workflow start user-management . --task "用户管理列表改造" --yes
npm run azi -- sdd clarify . --target specs/001-user-management --write
npm run azi -- sdd status . --target specs/001-user-management
npm run azi -- review . --target specs/001-user-management --full --diff --evidence --write
```

### 目标项目一条命令接入

用户已反馈当前包已发布到 npm。目标项目稳定接入入口是：

```bash
npx azi-harness setup . --yes
```

`setup` 会自动判断当前项目是首次接入还是已接入项目，然后自动执行 `init` 或 `sync`，最后补跑一次 `doctor`。

## GitHub 状态

- 远端仓库：`https://github.com/chenzilong0828/azi-harness`
- 当前主分支：`main`
- 旧代码已经按用户要求舍弃，现已用当前实现覆盖

## 真实试点

已在 `E:\htw-work\mall_platform` 做过试点，完成过：

- 中文运行时同步
- HTWTable API 复核
- 一个真实列表页的 HTWTable 改造试点

## 当前遗留与下一步

- 阶段 1“完整工作流引擎”已经完成。
- 阶段 2“Skill Hub MVP”已经完成代码、中文文档和 CLI 冒烟；2026-06-18 自审时 `npm run typecheck` 通过，21 个测试文件、107 个测试用例通过。
- 阶段 3“SDD 驱动开发增强”已于 2026-06-22 完成代码和中文文档；自审结果为类型检查通过、22 个测试文件与 116 个测试用例通过、6 包打包检查通过、bundle 和临时若依 Vue3 CLI 冒烟通过。
- 阶段 4“Review / 质量质检增强”已于 2026-06-22 完成 Review v2 代码与中文文档；类型检查、22 个测试文件与 120 个测试用例、6 包打包、bundle 和真实临时 Git CLI 冒烟均通过。
- 阶段 5 已经从“Figma 到规格”转向“Figma 到团队实现上下文”：直接 Figma URL 入口可以创建或复用 workflow 规格、缓存来源、下载/跳过 SVG、扫描相似页面、生成 `.harness/implementation/<id-feature>/codex-context.md`、生成候选实现补丁、`--apply` 创建缺失目标页并运行 quick check。2026-06-23 自审时类型检查、24 个测试文件 129 个用例、6 包打包、bundle、临时若依 Vue3 `--apply` 冒烟通过。
- 低指令触发层已经进入 MVP：`azi task "<用户原话>"` / `azi go "<用户原话>"` 能自动路由 Figma URL、HTWTable API 核对、quick check、自然而普通的开发/新增/修改/修复任务。普通开发任务会自动派生稳定 slug，创建或复用 workflow/spec，输出 Skill 匹配、必读文件、quick check 和下一步；不再要求团队一开始就记住 `workflow start` 和英文 slug。
- 我做过 GitHub 仓库直跑实验，但在 Windows + npm 的 `npm exec` 清理阶段仍有不稳定问题，目前不建议把它写成正式安装入口。
- 完整路线图见 [development-plan.md](./development-plan.md)，必须覆盖两张参考图对应的八条能力主线：
  - 完整工作流
  - Skill Hub
  - SDD 驱动开发
  - Review / 质量质检
  - Figma 流程
  - 团队协作与 Memory
  - GitLab / Commit / MR
  - 多 AI 编辑器适配
- 下一步最高优先级仍然不是再加复杂命令，而是继续强化“低指令触发层”：
  - 把真实 Figma MCP / REST 返回的节点、组件、文本、布局事实解析得更细，而不是只靠当前缓存骨架和候选上下文。
  - 把若依权限、字典、请求封装、分页、路由、菜单、HTWTable 从规则提示进一步变成可检查的 blocker。
  - 继续做真实若依项目 pilot，验证 `azi task -> Figma/Workflow -> 最小补丁 -> review` 是否真的减少团队提示词。
  - 完成多 AI 编辑器适配、Memory/交接、GitLab/Commit/MR 等后续主线。

## 新模型接手建议

1. 先读本文件。
2. 再读 [docs/PRD-azi-harness.md](./PRD-azi-harness.md)。
3. 然后看：
   - [architecture.md](./architecture.md)
   - [development-plan.md](./development-plan.md)
   - [cli.md](./cli.md)
   - [runtime-protocol.md](./runtime-protocol.md)
   - [skills-and-rules.md](./skills-and-rules.md)
4. 最后再进入 `packages/` 看具体实现。
