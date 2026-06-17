# 真实项目试点计划

本计划用于把 `azi-harness` 从本地开发版推进到可在团队项目中使用的试点版。试点目标不是验证页面能不能生成，而是验证运行时、规格、规则和检查能不能稳定约束 AI Coding。

## 试点目标

- 验证项目识别结果是否来自当前项目证据。
- 验证 `init` 和 `sync` 不会静默覆盖用户文件。
- 验证 AI 能按 `AGENTS.md`、`.harness/`、Skill 来源索引和 `specs/` 的顺序工作。
- 验证若依 Vue2 和 Vue3 不混用 API。
- 验证若依公共能力能被复用，而不是重复实现。
- 验证 HTWTable 的选择有本地安装证据和规格记录。
- 验证 `doctor`、`spec validate`、`check` 能在本地和 CI 中非交互运行。

## 试点顺序

1. 若依 Vue3 + Element Plus 项目。
2. 若依 Vue2 + Element UI 项目。
3. uniapp 项目，只验证识别和基础接入。

每个 Web 项目选择一个真实但范围小的 CRUD 功能。优先选择字段、权限、字典和接口都容易确认的功能，避免第一轮试点被业务复杂度拖住。

## 进入条件

- 试点项目负责人确认可以生成 `AGENTS.md`、`.harness/`、`.agents/skills/`、`.cursor/rules/` 和 `specs/`。
- 当前业务分支没有未提交的重要变更，或者已经明确哪些文件不能被修改。
- 已记录 Node、npm、包管理器和操作系统版本。
- 已明确一个小范围试点功能及其接口、权限、字典来源。
- Figma 节点、导出图、截图或同项目参考页至少有一种可用来源。

## 标准流程

### 1. 环境记录

在试点记录中填写：

- 操作系统和终端。
- Node 版本。
- npm、pnpm、yarn 或 bun 版本。
- 项目包管理器。
- Git 分支。
- CI Runner 或本地构建环境。

### 2. 项目识别

运行：

```bash
npx azi detect . --explain
```

检查：

- 项目类型是否正确。
- Vue 主版本是否正确。
- UI 框架是否正确。
- 若依能力证据是否来自当前项目。
- `.windsurfrules` 没有被当作证据。
- 命令识别是否符合项目实际情况。

### 3. 初始化预览

运行：

```bash
npx azi init . --dry-run
```

检查：

- 计划写入的文件是否符合预期。
- 已有 `AGENTS.md` 时是否生成建议补丁，而不是覆盖。
- 是否存在冲突。

确认后运行：

```bash
npx azi init . --yes
```

### 4. 初始化后检查

运行：

```bash
npx azi doctor . --json
npx azi check . --quick --json
```

检查：

- `.harness/project.json` 与 `detect --explain` 一致。
- `.harness/manifest.json` 包含 managed 和 seeded 文件记录。
- `.harness/rules/` 与项目类型匹配。
- `.agents/skills/` 只包含 Skill 索引或项目补充说明，不复制自写业务 Skill 正文。

### 5. 创建功能规格

运行：

```bash
npx azi spec create <feature-name> . --yes
```

补齐五个规格文件：

- `requirements.md`
- `design.md`
- `screens.yaml`
- `tasks.md`
- `acceptance.md`

检查：

- 接口、权限、字典、后端字段都有真实来源。
- Figma 或截图只记录页面事实，不推断后端事实。
- HTWTable 使用或例外原因写入 `design.md`。

### 6. HTWTable 检查

若项目是普通 Vue3 后台列表，先运行：

```bash
npx azi htw inspect . --write-doc
```

检查：

- 已安装包、版本和入口文件是否明确。
- 公开 signals 是否足够支撑当前功能。
- 例外原因是否写入规格。

### 7. AI 实现与人工 Review

让 AI 在实现前读取：

1. `AGENTS.md`
2. `.harness/project.json`
3. `.harness/rules/`
4. `.harness/skill-map.json`、`.harness/docs/skill-sources.md` 和 `.agents/skills/README.md`
5. 当前 `specs/<feature>/`
6. 适用的外部 Skill、插件 Skill 或官方 Skill

Review 重点：

- 是否复用若依请求、权限、字典、分页、下载、消息能力。
- 是否混用了 Vue2/Vue3 API。
- 是否猜测接口、权限、字典或后端字段。
- 是否优先使用匹配的外部 Skill，而不是在项目里重写一份 Skill。
- 是否引入了跨项目视觉体系或 Design Token。
- 是否遵守 HTWTable 决策。

### 8. 验收检查

运行：

```bash
npx azi spec validate specs --json
npx azi check . --json
```

记录：

- 实际执行的 lint/test/build 命令。
- 失败项和修复方式。
- 误报、漏报和需要新增的规则。
- AI 偏差和对应的运行时改进建议。

## 退出条件

若依 Vue3 试点满足：

- 项目类型和 Vue3 证据正确。
- 没有 Vue2 API 混用。
- HTWTable 使用或例外有证据。
- 规格能支撑人工 Review。
- `check` 可非交互运行。

若依 Vue2 试点满足：

- 项目类型和 Vue2 证据正确。
- 没有 Vue3 API 混用。
- 没有误用 Vue3 HTWTable。
- 若依公共能力得到复用。
- `check` 可非交互运行。

uniapp 试点满足：

- 项目识别为 uniapp。
- 基础运行时生成正常。
- 不生成若依专用 Skill。
- `doctor` 和 `check --quick` 能运行。

## 试点后处理

- 把每个项目的试点记录保存为 `docs/pilot-record-<project>.md` 或团队内部文档。
- 将通用问题转化为运行时模板、检查规则或文档更新。
- 将单项目问题留在该项目的 `.harness/config.json` 或规格中，不提升为通用规则。
- 根据实际通过的 Node/npm 版本更新兼容基线。
- 根据试点结果收敛外部 Skill 推荐清单和使用边界。
- 完成交叉 Review 后再考虑发布内部 alpha 版本。
