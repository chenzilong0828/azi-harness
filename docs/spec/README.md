# AZI Harness 规格索引

本目录是第二阶段实现的唯一产品基线。宣传材料只用于提取目标，不作为内部实现事实。

## 规格文档

1. [产品定义](./01-product-definition.md)
2. [总体架构](./02-architecture.md)
3. [项目文件与生命周期](./03-project-lifecycle.md)
4. [核心契约](./04-core-contracts.md)
5. [Skill 模型与目录](./05-skill-model.md)
6. [工作实例与 SDD 流程](./06-work-items-and-workflow.md)
7. [Adapter 模型](./07-adapter-model.md)
8. [安全、权限与治理](./08-security-and-governance.md)
9. [CLI 交互契约](./09-cli-contract.md)
10. [验收标准与路线](./10-acceptance-and-roadmap.md)
11. [扩展、配置与确定性](./11-extension-and-determinism.md)

## 规范性关键词

- **必须**：实现不可违反。
- **应该**：默认遵守，偏离时必须说明原因。
- **可以**：可选能力。
- **不得**：明确禁止。

## 第一阶段冻结范围

- 产品是项目开发依赖，CLI 只是管理入口。
- 首版不训练模型、不代理模型请求、不实现 Agent Runtime。
- 首版采用单 npm 包，内部保持可拆分模块边界。
- 首个 Profile 为 `omz`，首个 Adapter 为 `codex`。
- 工作流以工作实例和交付产物为中心，不使用单一全局状态机。
- 项目知识、生成文件和任务产物拥有不同的所有权与升级策略。
- 默认本地优先、无遥测、无 `postinstall`、无远程 Profile 执行。

## Schema 与示例

`schemas/` 定义机器可读契约，`examples/` 给出最小合法实例。Schema 与本文冲突时，
以本文明确写出的安全约束为准，并在实现前修正 Schema。
