# Adapter 模型

## 目标

Core 只维护一份规范化 Profile 和 Skill。Adapter 将它们转换为 Coding Agent 能发现的
文件格式和目录，不复制业务语义。

Profile 只声明必需能力，不依赖某个 Adapter 名称。Core 在初始化时比较
`adapterRequirements.requiredCapabilities` 与 Adapter 能力，不满足时按关键性拒绝或降级。

## 编译过程

```text
Canonical Skill
  skill.json + SKILL.md
          +
Project Config
          ↓
Adapter Transform
          ↓
Agent-specific files
          ↓
Lock Manifest
```

## Adapter 能力声明

Adapter 必须声明是否支持：

- 项目级总指令。
- 独立 Skills。
- Slash 或命名命令。
- 独立 Rules。
- MCP 或工具配置。
- Skill UI 元数据。
- 项目级自动发现。

不支持的能力必须选择：

- `error`：拒绝生成。
- `warn`：生成降级版本并说明影响。
- `ignore`：仅适用于非关键可选能力。

安全、权限和审批语义不得静默忽略。

## 首版 Adapter

首版只正式实现 `codex`。在第二阶段编码前，必须通过一个技术 Spike 确认当前 Codex
项目级 Skill 的发现路径、元数据格式和调用方式，并用集成测试固定结果。

`generic` 可以作为调试输出，但不算正式 Agent 支持：

```text
.azi/generated/generic/
├─ AGENTS.md
├─ rules/
└─ skills/
```

Claude Code、Cursor 等只在其项目级协议完成调研与验证后加入，不预先猜测目录格式。

## 输出所有权

- Adapter 输出全部属于 Harness 托管生成文件。
- 用户不应直接编辑；自定义应写入 Project Knowledge 或 Profile 扩展点。
- 若检测到人工修改，`sync` 必须停止并展示冲突。
- 每个输出文件必须进入 lock，并记录来源和 hash。

## 命名隔离

生成资产应使用 `azi-` 前缀或专属目录，避免覆盖项目已有 Skill。例如：

```text
.codex/skills/azi-to-prd/
.codex/skills/azi-to-plan/
```

面向用户显示名称可以仍为 `to-prd`，但磁盘归属必须明确。
