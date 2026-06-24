# 产品范围

`azi-harness` 是一套团队级前端 AI Coding 运行时体系。它的核心价值不是生成页面代码，而是让不同 AI 工具在同一个项目中读取相同的项目事实、开发规则、Skills、功能规格和验收要求。

## 当前目标

- 支持团队通过 npm 安装和执行 `azi` 命令。
- 识别若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp 和未知项目。
- 在目标项目中安全生成 `.harness/`、`.agents/skills/`、`AGENTS.md` 和 `specs/`。
- 让 AI 在开发前先读项目事实、规则、规格和 Skill 来源索引。
- 通过 `workflow start/status/advance/log` 启动功能规格、写入 `.harness/workflows/` 状态、推进阶段并查看日志。
- 通过 `doctor`、`check`、`spec validate`、`htw inspect`、`review` 提供自动检查和交付前证据汇总。
- 对已有文件保持谨慎，不静默覆盖用户内容。

## 必须保留的业务项目约定

若依项目必须保留目标项目已有能力：

- `v-hasPermi` / `hasPermi`
- `useDict`
- `DictTag`
- 请求封装
- 路由和动态菜单
- `pageNum`、`pageSize`、`rows`、`total`
- 项目已有弹窗、下载、消息和反馈能力
- Vue2 与 Vue3 API 边界

## 明确不做

当前版本不做这些方向：

- 不抽取历史项目公共样式。
- 不建立跨项目通用样式体系。
- 不建立 Design Token 包。
- 不做风格模板选择。
- 不让 AI 每次扫描旧项目寻找样式。
- 不检查或限制业务代码中的硬编码颜色。
- 不建立 `style-template-*` Skill。
- 不让官方 Figma Skill 或截图推断接口、权限、字典、后端字段。
- 不覆盖已有业务页面；Figma 入口默认只生成缓存、规格建议、实现上下文和候选补丁，显式允许时才创建缺失页面。

页面视觉优先以当前功能对应的 Figma 节点为准。没有 Figma 时，只能沿用目标项目内同类页面。

## 当前阶段

当前代码已经完成第一条主线：项目识别、运行时生成、规格骨架、基础检查、HTWTable 检查、建议补丁和 npm 打包预检。
当前已完成完整工作流引擎、Skill Hub、SDD 和 Review v2 MVP：项目内不生成自写业务 Skill，改为引用外部 Skill 来源，并通过 `context`、`skill list/search/match/doctor/sources/install-guide`、`workflow start/status/advance/log`、`sdd`、`review` 把任务启动、技能匹配、阶段推进、规格追踪和交付审查连成闭环。

仍需要继续推进的方向：

- 在真实若依 Vue2/Vue3 项目中试点接入。
- 验证 Cursor、Codex、OpenCode、Antigravity IDE 对入口文件、外部 Skill 来源和规则索引的真实读取方式。
- 在后续 GitLab 阶段增强 MR、commit message 和远端流水线证据支持。
- 根据试点项目 Node/npm 版本决定正式兼容基线。
- 根据真实 HTWTable 版本沉淀更明确的公开 API 使用说明。

试点执行步骤见 [真实项目试点计划](./pilot-plan.md)，单项目记录可复制 [试点记录模板](./pilot-record-template.md)。
