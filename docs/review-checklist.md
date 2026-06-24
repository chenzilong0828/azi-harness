# 人工复检清单

每完成一个阶段，可以用这份清单做人工复核。

## 产品方向

- [ ] `azi-harness` 仍然是运行时体系，不退化成单一 CLI 或页面生成器。
- [ ] 没有引入跨项目样式体系、Design Token 包或风格模板选择。
- [ ] 用户触发成本没有增加；自然语言 Figma 任务优先走 `azi task "<用户原话>"` 或 AGENTS 引导。
- [ ] Figma 默认进入缓存、规格建议、实现上下文和候选补丁；只有明确允许 `--apply` 时才创建缺失页面。
- [ ] 已有业务页面不会被覆盖。
- [ ] 历史项目只用于确认技术接入方式或业务惯例。

## 项目识别

- [ ] 能识别若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp、unknown。
- [ ] 能区分 Vue2 和 Vue3 API 边界。
- [ ] 能记录请求封装、权限、字典、路由、命令等证据。
- [ ] 不扫描、不迁移、不执行 `.windsurfrules`。

## 运行时生成

- [ ] `AGENTS.md` 简短，只作为入口。
- [ ] `AGENTS.md` 明确要求 AI 在看到 Figma URL、按 Figma 开发、还原设计稿时优先运行 `npx azi task "<用户原话>"`。
- [ ] 生成到目标项目的 `.harness/docs/`、`.harness/rules/`、`.agents/skills/` 和 `specs/README.md` 默认为中文。
- [ ] `.harness/project.json` 记录机器可读项目事实。
- [ ] `.harness/rules/` 包含项目、若依、HTWTable、Figma、质量规则。
- [ ] `.agents/skills/` 只包含 Skill 索引或项目补充说明。
- [ ] 项目内没有复制自写业务 Skill 正文。
- [ ] 已有用户文件不会被静默覆盖。
- [ ] 建议补丁写入 `.harness/proposals/`。
- [ ] Review 报告写入 `.harness/reviews/`，不覆盖已有报告。

## 功能规格

- [ ] 每个功能规格包含五个文件。
- [ ] 新功能可以通过 `azi workflow start` 创建或复用规格目录。
- [ ] `workflow start` 输出的 Skill 匹配、必读文件和下一步适合当前任务。
- [ ] `screens.yaml` 记录真实来源和 Figma 限流状态。
- [ ] 相同 fileKey + nodeId 优先读取 `.harness/figma-cache/`，没有重复请求 Figma API/MCP。
- [ ] `design.md` 记录 HTWTable 使用或例外原因。
- [ ] `acceptance.md` 能对应实际验收结果。
- [ ] `REQ-###`、`TASK-###`、`ACC-###` 编号唯一，TASK 和 ACC 均引用已定义 REQ。
- [ ] `azi sdd status --target specs/<id-feature>` 没有阻塞项，需求不再是 `draft`。
- [ ] `specs/<id-feature>/sdd/` 只保存辅助和复盘文档，没有覆盖五个主规格文件。
- [ ] 规格中没有虚构接口、权限、字典或后端字段。

## Skill Hub

- [ ] `.harness/skill-map.json` 与 `.harness/skill-catalog.json` 来源和启用状态一致。
- [ ] `azi skill doctor` 通过。
- [ ] 普通 CRUD 不误匹配 GSAP、PM 或 GitHub Skill Forge。
- [ ] Figma 匹配保留“禁止推断接口/权限/字典/后端字段”的约束，长链路任务首选 Superpowers。
- [ ] 安装状态仍标为“未验证”，项目内没有复制外部 Skill 正文。

## HTWTable

- [ ] Vue3 普通后台列表优先评估 HTWTable。
- [ ] 使用前核对目标项目已安装版本的公开 API。
- [ ] 搜索下拉使用字典时，已验证 `dictType`、`setDictData` 或显式 `options` 的实际可用性。
- [ ] 查询、重置、分页、选择、批量操作、导出和 CRUD 后刷新都已验收。
- [ ] Vue2 项目没有误用 Vue3 HTWTable。
- [ ] 例外场景写明原因。
- [ ] 没有复制或修改 HTWTable 源码。

## 质量检查

- [ ] `npm run typecheck` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run pack:check` 通过。
- [ ] CLI 关键命令有测试覆盖。
- [ ] `azi review --target specs/<id-feature> --full --diff --evidence --write` 能生成交付前审查报告。
- [ ] Review 同时识别 staged、unstaged 和 untracked 文件。
- [ ] tasks.md 声明文件与实际变更范围一致，敏感超范围变更已人工处理。
- [ ] acceptance.md 没有把未执行的 lint/test/build 写成通过。
- [ ] `--suggest-patch` 只写入 `.harness/proposals/`，没有直接修改业务或规格文件。
- [ ] README 和 `docs/` 文档为中文，并与当前实现一致。
