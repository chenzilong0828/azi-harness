# 核心契约

## 契约清单

| 契约 | Schema | 所有者 | 作用 |
|---|---|---|---|
| Project Config | `project-config.schema.json` | 项目 | 选择 Profile、Adapters 和策略 |
| Lock Manifest | `manifest.schema.json` | Harness | 记录版本、来源、hash 和生成归属 |
| Profile | `profile.schema.json` | 套件作者 | 组合 Seeds、Skills、Adapters、Validators |
| Skill | `skill.schema.json` | Skill 作者 | 定义职责、输入、输出、权限和停止条件 |
| Adapter | `adapter.schema.json` | Adapter 作者 | 定义能力与渲染目标 |
| Validator | `validator.schema.json` | 套件作者 | 定义检查范围、严重性和修复提示 |
| Work Item | `work-item.schema.json` | 项目/Agent | 隔离任务状态、产物和批准记录 |

## 版本规则

- 所有契约必须包含 `schemaVersion`。
- Profile、Skill 和 Adapter 必须有独立 SemVer。
- Core 必须声明支持的 Schema 主版本。
- 未识别的 Schema 主版本必须拒绝处理。
- 新增可选字段属于兼容变更；删除字段或改变语义属于破坏性变更。

## Profile

Profile 负责组合，不负责执行。它必须声明：

- 名称、版本和 Core 兼容范围。
- 入口 Skill。
- Skills 列表及版本。
- Artifact 类型、格式和默认目标。
- 项目 Seed 文件。
- 默认规则和 Validator。
- 必需 Adapter 能力和推荐 Adapter。

Profile 不得包含安装时执行的 shell 命令。
Profile 不得要求某个特定 Adapter ID；它只声明能力要求。

## Skill

每个 Skill 由两部分组成：

```text
skills/<skill-id>/
├─ skill.json     # 机器契约
└─ SKILL.md       # Agent 执行说明
```

`skill.json` 用于校验和治理，`SKILL.md` 用于实际执行。两者职责或权限冲突时，执行必须
停止并由 Doctor 报错。

## Adapter

Adapter 输入是规范化 Core 资产，输出是某个 Agent 可发现的文件。它必须声明：

- 支持哪些 Core 能力。
- 目标路径规则。
- 渲染方式。
- 冲突处理方式。
- 生成文件所有权。
- 当前不支持能力的降级方式。

## Validator

Validator 把“建议遵守”变成机器可检查条件。它必须声明：

- 检查发生在哪个生命周期阶段。
- 检查对象和所需输入。
- 失败严重性。
- 稳定错误码和修复提示。
- 包内受信任实现入口。

首版 Validator 只能引用当前 npm 包中的内置实现，不加载项目外脚本。

## Lock Manifest

Lock 是安全同步的依据，不是用户配置。每个生成文件至少记录：

- 相对路径。
- 内容 hash。
- 来源 Profile、Skill 或 Adapter。
- 生成器版本。
- 上次写入时间。

不得仅凭目录名称判断文件可删除。

## Work Item

Work Item 是一个需求的最小治理边界。它包含：

- 稳定 ID、标题、类型和状态。
- 关联分支或 Issue。
- 当前产物及其状态。
- 当前阻塞项。
- 人工批准记录。
- 最后活动 Skill。

它不强制所有项目使用同一线性流程。
