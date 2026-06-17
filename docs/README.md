# azi-harness 文档中心

这里存放 `azi-harness` 源码项目自身的中文文档，方便人工复检、阶段验收和后续交接。

注意区分两个文档层级：

- 根目录 `docs/`：记录 `azi-harness` 产品、架构、CLI、运行时协议和审查清单。
- 目标项目 `.harness/docs/`：由 `azi init` 或 `azi sync` 生成，服务某个业务项目内的 AI 协作。

## 阅读顺序

1. [产品范围](./product-scope.md)：确认目标、边界、已放弃方向和当前阶段。
2. [系统架构](./architecture.md)：理解 workspace、核心包和运行时产物之间的关系。
3. [CLI 使用说明](./cli.md)：查看当前已实现命令、常用参数和人工审查点。
4. [运行时协议](./runtime-protocol.md)：理解 `AGENTS.md`、`.harness/`、`.agents/skills/`、`specs/` 的职责。
5. [Skills 与规则](./skills-and-rules.md)：复核若依、HTWTable、Figma、`.harness/skill-map.json` 和外部 Skill 来源规则。
6. [Figma 工作流](./figma-workflow.md)：查看 Figma 到规格的流程，以及 429 限流处理。
7. [发布与 CI](./release-and-ci.md)：查看构建、测试、打包预检和 GitLab CI 接入方式。
8. [真实项目试点计划](./pilot-plan.md)：把本地开发版推进到真实项目试点。
9. [试点记录模板](./pilot-record-template.md)：记录每个真实项目的环境、结果和问题。
10. [人工复检清单](./review-checklist.md)：阶段完成后按清单做人工验收。

## 权威来源

- 当前完整产品规划仍以根目录 [PRD-azi-harness.md](../PRD-azi-harness.md) 为准。
- 本目录文档用于把 PRD 拆成更容易审查的实现说明。
- 如果文档与代码行为冲突，应以代码和测试结果为证据，随后修正文档。
