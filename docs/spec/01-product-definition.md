# 产品定义

## 定位

AZI Harness 是安装在软件项目中的 **AI 研发基础设施开发依赖**：

> 将项目知识、团队规则、角色权限、SDD 流程和质量门禁，编译为 Coding Agent
> 可以消费的项目协议。

它可以称为 AI Coding Harness 套件，因为它组合了 Profile、Skills、Adapters、
Validators 和项目知识；但它不得被描述为大模型、AI 编辑器或单纯 CLI。

## 目标用户

- 希望规范使用 Codex、Claude Code、Cursor 等工具的研发团队。
- 需要降低重复实现、协作偏差和新人理解成本的前端或全栈团队。
- 希望把隐性研发经验沉淀为可审查项目资产的平台工程团队。

## 核心问题

1. Agent 在需求模糊时直接写代码。
2. Agent 不理解项目架构、权限和历史约束。
3. 同类组件、接口和逻辑被重复实现。
4. 不同成员、不同 AI 工具产生不一致的交付物。
5. 测试、Review、Commit 和 PR 缺少稳定收尾方式。
6. 团队知识依赖口头传递，无法随代码一起演进。

## 核心能力

1. 将 `omz` Profile 接入现有项目。
2. 建立 `AGENTS.md + Agent Docs + Rules + Skills` 项目协议。
3. 支持需求澄清到 Commit/PR 的可组合 SDD 流程。
4. 用 Work Item 隔离并行需求及其交付证据。
5. 通过 Adapter 支持不同 Coding Agent。
6. 通过 Validator 检查安装、产物、权限声明和交付证据。
7. 安全同步依赖版本，不覆盖项目维护内容。

## 非目标

- 不训练、托管或微调大模型。
- 不代理用户与模型之间的对话。
- 不取代 IDE、Coding Agent、Git 平台或 CI。
- 首版不建设远程 Skill 市场、企业知识云或向量数据库。
- 不承诺宣传材料中的效率百分比。
- 不自动发布、部署、合并 PR 或执行不可逆外部操作。

## 成功标准

首版成功不以“生成了多少代码”衡量，而以以下结果衡量：

- 同一需求在同一项目中能稳定产生结构一致的 PRD、Plan、Issues 和验证证据。
- Agent 在编码前能引用真实项目文件和可复用资产。
- 项目已有文件不会在安装或升级时被静默覆盖。
- 高风险操作始终需要用户明确批准。
- 新成员可通过项目协议理解主要架构、命令、边界和交付流程。

## 名词

- **Core**：与编辑器无关的协议和生命周期规则。
- **Profile**：一组 Skills、种子文档、规则和校验器的版本化组合。
- **Skill**：有职责、输入、输出、权限和停止条件的工作单元。
- **Adapter**：将 Core 资产渲染到特定 Coding Agent 约定的位置和格式。
- **Work Item**：某个需求、缺陷、重构或研究任务的独立工作空间。
- **Artifact**：PRD、Plan、Issue、Test Report、Review 等可审查交付物。
- **Project Knowledge**：由项目团队维护并随项目演进的真实知识。
- **Managed Generated File**：可由 Harness 重新生成的适配器文件。
