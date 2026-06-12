# Skill 模型与目录

## 设计原则

- 一个 Skill 只承担一个主要职责。
- 输入、输出和完成标准必须可观察。
- Skill 不能通过模糊描述扩大权限。
- Skill 发现新事实导致范围变化时必须停止并回到决策阶段。
- 同一个 Agent 可以切换角色，但角色边界仍然有效。

## 角色

| 角色 | 可以做什么 | 不应该做什么 |
|---|---|---|
| Discovery | 搜索、澄清、建立事实 | 修改产品代码 |
| Product | 定义问题、范围和验收 | 决定具体代码结构 |
| Planning | 设计实现路径和风险 | 未批准就编码 |
| Coding | 实现一个批准任务 | 擅自修改 PRD |
| Testing | 验证和记录证据 | 把失败说成通过 |
| Review | 查找缺陷和越界 | 顺手大规模重写 |
| Delivery | 整理提交与 PR | 未授权执行外部操作 |

## `omz` 首版 Skill 目录

| Skill | 角色 | 主要输入 | 主要输出 | 默认审批 |
|---|---|---|---|---|
| `setup-omz` | Discovery | 项目代码与文档 | 完善后的 Agent Docs | 写文档前 |
| `grill-with-docs` | Discovery | 模糊需求、项目事实 | 问题与推荐解释 | 无 |
| `grill-me-ui` | Discovery | UI 想法或设计稿 | UI 行为契约 | 无 |
| `to-locate` | Discovery | 需求或问题 | 相关代码与复用地图 | 无 |
| `to-prd` | Product | 已澄清需求 | PRD | 定稿前 |
| `to-plan` | Planning | 已批准 PRD | 实施计划 | 架构决策前 |
| `to-issues` | Planning | 已批准计划 | 可验证 Issue 切片 | 执行前 |
| `to-coding` | Coding | 一个批准 Issue | 代码、测试、实现说明 | 高风险写入前 |
| `to-test` | Testing | 验收标准和改动 | 测试证据 | 高风险命令前 |
| `to-quality-review` | Review | 实现与测试证据 | 质量门禁结果 | 无 |
| `to-review` | Review | diff 与上下文 | 分级 Review Findings | 无 |
| `to-commit` | Delivery | 已通过的交付内容 | Commit/PR 草稿 | 外部操作前 |

## 关键边界

- `to-prd` 定义“做什么”，`to-plan` 定义“怎么改”。
- `to-plan` 设计完整路径，`to-issues` 划分执行单元。
- `to-test` 证明行为，`to-quality-review` 做多维门禁，`to-review` 查具体代码缺陷。
- `to-commit` 默认只准备材料，不自动提交、推送或创建 PR。
- `to-locate` 可以被其他 Skill 内部采用，但不得借此进入编码。

## Skill 完成条件

每个 Skill 必须在契约中声明：

- 进入条件。
- 允许读取和写入的路径。
- 允许执行的工具类别。
- 需要的 Artifact。
- 产生的 Artifact。
- 人工批准点。
- 完成标准。
- 停止条件。
- 推荐后续 Skill。

只有写出一段 Prompt 而没有上述契约的内容，不属于 AZI Skill。
