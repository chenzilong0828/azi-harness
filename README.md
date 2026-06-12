# AZI Harness

一个不绑定具体 AI 编辑器的 Coding Harness MVP。它负责把团队的 Agent 文档、规则、
技能和交付流程安装到项目中，并通过状态机约束工作阶段。

## 快速体验

```powershell
node .\bin\azi-harness.js init .\demo-project
node .\bin\azi-harness.js doctor .\demo-project
node .\bin\azi-harness.js status .\demo-project
node .\bin\azi-harness.js advance planning .\demo-project
```

全局链接后：

```powershell
npm link
azi-harness init .
```

发布到 npm 后，用户可以直接安装：

```powershell
npm install -g azi-harness
azi-harness init .
```

## MVP 命令

- `azi-harness init [directory]`：初始化核心 Harness 文件。
- `azi-harness setup [directory]`：补齐缺失文件；默认不覆盖已有内容。
- `azi-harness doctor [directory]`：检查目录结构和工作流状态。
- `azi-harness status [directory]`：显示当前阶段。
- `azi-harness advance <stage> [directory]`：按顺序推进工作流。
- `azi-harness skills [directory]`：显示核心 Skill 安装状态。

## 设计原则

- 编辑器无关：核心协议使用 Markdown 和 JSON。
- 职责内聚：规则、文档、技能和状态各自独立。
- 人机边界明确：破坏性操作和外部副作用需要人工确认。
- 默认不覆盖：团队已有文件优先。
- 流程可追溯：每次阶段转换写入 `.harness/state.json`。

## 后续版本

1. Codex、Claude Code、Cursor 等适配器。
2. 可组合 Skill 包和远程 Registry。
3. PRD/Issue/Test/Review 产物校验器。
4. Git diff、commit 和 PR 门禁。
5. 团队配置签名、版本锁定和安全审计。

## 深入阅读

- [Zerone-AI-Coding 原理、架构与复刻路线](./docs/zerone-architecture-guide.zh-CN.md)
- [产品构想](./docs/product-blueprint.md)
