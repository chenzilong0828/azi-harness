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

## 已确认的关键产品决策

- 套件名称：`azi-harness`
- 包管理器：`npm`
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

- Figma 只能先进入规格，不能直接写业务页面
- `screens.yaml` 必须记录真实来源
- Figma MCP 遇到 429 时必须记录 `retriedAt`、`fallback`、`notes`

## 当前仓库结构

- [README.md](../README.md)：总览和对外使用入口
- [PRD-azi-harness.md](../PRD-azi-harness.md)：完整产品规划
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

### 第二阶段

- 删除项目内自写业务 Skill
- 改为生成：
  - `.harness/skill-map.json`
  - `.harness/docs/skill-sources.md`
  - `.agents/skills/README.md`
- 已把外部 Skill 来源映射进运行时

### 第三阶段当前进度

- `spec create`
- `spec validate`
- 5 个规格文件模板
- `screens.yaml` 来源、状态、429、fallback 校验
- `requirements.md`、`design.md`、`tasks.md`、`acceptance.md` 关键章节校验

## 当前稳定入口

### 本地开发

```bash
npm install
npm run build
npm test
npm run azi -- setup . --yes
```

### 目标项目一条命令接入

计划中的稳定发布入口是：

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

- 还没有完成 npm 正式发布流程，所以团队成员暂时不能直接用 `npx azi-harness ...`
- 我做过 GitHub 仓库直跑实验，但在 Windows + npm 的 `npm exec` 清理阶段仍有不稳定问题，目前不建议把它写成正式安装入口
- 下一步最有价值的是：
  - 完成 npm 发布链路
  - 继续增强 Figma -> spec 的半自动流程
  - 补更强的规格追踪与验收报告能力

## 新模型接手建议

1. 先读本文件。
2. 再读 [docs/PRD-azi-harness.md](./PRD-azi-harness.md) 和 [../PRD-azi-harness.md](../PRD-azi-harness.md)。
3. 然后看：
   - [architecture.md](./architecture.md)
   - [cli.md](./cli.md)
   - [runtime-protocol.md](./runtime-protocol.md)
   - [skills-and-rules.md](./skills-and-rules.md)
4. 最后再进入 `packages/` 看具体实现。
