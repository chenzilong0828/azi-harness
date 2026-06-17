# 人工复检清单

每完成一个阶段，可以用这份清单做人工复核。

## 产品方向

- [ ] `azi-harness` 仍然是运行时体系，不退化成单一 CLI 或页面生成器。
- [ ] 没有引入跨项目样式体系、Design Token 包或风格模板选择。
- [ ] Figma 仍然只进入规格，不直接写业务页面。
- [ ] 历史项目只用于确认技术接入方式或业务惯例。

## 项目识别

- [ ] 能识别若依 Vue2、若依 Vue3、普通 Vue2、普通 Vue3、uniapp、unknown。
- [ ] 能区分 Vue2 和 Vue3 API 边界。
- [ ] 能记录请求封装、权限、字典、路由、命令等证据。
- [ ] 不扫描、不迁移、不执行 `.windsurfrules`。

## 运行时生成

- [ ] `AGENTS.md` 简短，只作为入口。
- [ ] 生成到目标项目的 `.harness/docs/`、`.harness/rules/`、`.agents/skills/` 和 `specs/README.md` 默认为中文。
- [ ] `.harness/project.json` 记录机器可读项目事实。
- [ ] `.harness/rules/` 包含项目、若依、HTWTable、Figma、质量规则。
- [ ] `.agents/skills/` 只包含 Skill 索引或项目补充说明。
- [ ] 项目内没有复制自写业务 Skill 正文。
- [ ] 已有用户文件不会被静默覆盖。
- [ ] 建议补丁写入 `.harness/proposals/`。

## 功能规格

- [ ] 每个功能规格包含五个文件。
- [ ] `screens.yaml` 记录真实来源和 Figma 限流状态。
- [ ] `design.md` 记录 HTWTable 使用或例外原因。
- [ ] `acceptance.md` 能对应实际验收结果。
- [ ] 规格中没有虚构接口、权限、字典或后端字段。

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
- [ ] README 和 `docs/` 文档为中文，并与当前实现一致。
