# Skills 与规则

第二阶段开始，`azi-harness` 不再在项目里生成自写业务 `SKILL.md`。
项目运行时负责提供项目事实、规则、规格、`.harness/skill-map.json` 和 Skill 来源索引；通用能力优先交给外部 Skill、插件 Skill 或官方 Skill。

## Skill 来源策略

- 项目内 `.agents/skills/README.md` 只做索引，不复制外部 Skill 正文。
- 大功能与长链路开发优先考虑 `obra/superpowers`。
- 设计与页面实现优先考虑 `figma`、`figma-use`、`figma-implement-design`、`playwright`、`screenshot`。
- 动效任务优先考虑 `greensock/gsap-skills`。
- PRD、产品发现、优先级和发布类任务优先考虑 `phuryn/pm-skills`。
- 引入外部 GitHub 仓库知识时，可考虑 `YuJunZhiXue/github-skill-forge`。
- 如果当前 AI 环境没有适用 Skill，直接按 `.harness/rules/` 和 `specs/` 工作，不在项目里临时发明 Skill。
- 若依约束来自项目规则和功能规格，不依赖项目自写 `ruoyi-*` Skill。

## 若依规则

AI 必须复用目标项目已有能力，包括：

- 权限：`v-hasPermi` / `hasPermi`
- 字典：`useDict`、`DictTag`
- 请求封装
- 路由和动态菜单
- 分页字段：`pageNum`、`pageSize`、`rows`、`total`
- 弹窗、下载、消息和反馈能力

Vue2 与 Vue3 必须先识别再实现，不能混用组合式 API、Element UI、Element Plus 等边界。

## HTWTable 规则

- 普通 Vue3 后台列表优先评估 `htw-table`。
- 使用前必须运行 `azi htw inspect --write-doc` 或等价流程，核对目标项目实际安装版本的公开 API。
- 搜索项使用若依字典时，必须确认当前 HTWTable 版本的字典加载方式；如果内部 `dictType` 对异步字典是快照式读取，应通过 `setDictData` 或显式 `options` 同步字典，避免搜索下拉为空。
- 改造后必须验证查询、重置、分页、选择、批量操作、导出和新增/编辑/删除后的刷新行为。
- Vue2 项目不能错误使用 Vue3 HTWTable。
- 树表、虚拟滚动、复杂合并单元格等场景可以例外。
- 例外必须写入功能规格的 `design.md`。
- 不复制、不修改 HTWTable 源码。

HTWTable 权威资料入口：

```text
http://192.168.30.4/chenzl2/htw-table-vue
```

当前工具不联网抓取该仓库，只记录入口并检查目标项目本地安装包。

## Figma 规则

- Figma 只能先进入规格，不能直接进入页面代码。
- Figma 类 Skill 只能帮助提取设计事实，真正的页面约束仍要落到 `requirements.md`、`design.md`、`screens.yaml`、`tasks.md`、`acceptance.md`。
- Figma 图像不能推断接口、权限、字典或后端字段。
- Figma MCP 限流时要记录真实状态和降级来源。
