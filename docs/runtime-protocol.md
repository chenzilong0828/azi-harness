# 运行时协议

运行时协议定义 AI 工具进入目标项目后应该读取什么、相信什么、禁止什么。

## 文件职责

| 文件或目录 | 职责 |
| --- | --- |
| `AGENTS.md` | AI 协作短入口，只写读取顺序、硬性禁令和检查命令 |
| `.harness/project.json` | 当前项目机器可读事实 |
| `.harness/config.json` | 允许人工配置的命令和安全覆盖 |
| `.harness/manifest.json` | 运行时文件清单、模板版本和哈希 |
| `.harness/docs/` | 目标项目内的人类可读说明，其中 harness 生成的基础说明由运行时管理 |
| `.harness/rules/` | 项目约定、若依、HTWTable、Figma、质量规则 |
| `.agents/skills/` | Skill 索引和团队补充说明；默认不复制外部 Skill 正文 |
| `.cursor/rules/azi-harness.mdc` | Cursor 薄入口，指回 `AGENTS.md` 和运行时 |
| `specs/` | 功能级需求、设计、页面、任务和验收 |

## 读取顺序

AI 开始修改代码前，应按顺序读取：

1. `AGENTS.md`
2. `.harness/project.json`
3. `.harness/skill-map.json`
4. `.harness/rules/` 和 `.harness/docs/skill-sources.md`
5. 当前功能目录 `specs/xxx/`
6. `.agents/skills/README.md`

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
