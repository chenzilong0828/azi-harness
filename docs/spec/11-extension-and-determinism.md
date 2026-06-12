# 扩展、配置与确定性

## 配置优先级

从低到高：

```text
Core 默认值
→ Profile 默认值
→ .azi/config.json
→ 当前 CLI 参数
```

高优先级配置可以选择功能或收紧行为，但不能绕过安全不可覆盖规则、扩大 Skill 声明的
最大权限，或改变托管文件归属。

## 项目 Skill Overlay

项目常常需要补充团队术语和局部约束，但直接编辑 Adapter 输出会破坏同步。首版允许：

```text
docs/agent/skills/
├─ to-coding.md
└─ to-review.md
```

`.azi/config.json` 通过 `skillOverlays` 显式关联 Skill。Overlay 可以：

- 增加项目上下文和必读文件。
- 增加更严格的完成条件。
- 增加停止条件。
- 禁用某个可选 Skill。

Overlay 不可以：

- 改变 Skill 角色。
- 移除 Profile 的完成或停止条件。
- 扩大文件、命令、Git、网络或外部副作用权限。
- 改变 Artifact 类型和默认目标。

需要改变机器契约时，应创建新的 Profile 或 Skill 版本。

## Profile 扩展

首版每个项目只激活一个 Profile，不实现多 Profile 继承。该限制避免规则优先级和 Skill
版本解析过早复杂化。团队 Profile 组合将在真实使用验证后设计。

## Monorepo

首版以一个 Git 仓库为 Harness 根，但允许配置多个项目 Scope：

```json
{
  "name": "admin-web",
  "root": "apps/admin",
  "agentDocs": ["docs/agent/admin.md"]
}
```

Work Item 可以声明 Scope。未声明时作用于仓库整体。Skill 的写入权限仍以仓库根为安全
边界，Scope 只是上下文和验证范围，不形成新的任意路径根。

## 确定性生成

给定相同的 Harness、Profile、Skill、Adapter、项目配置和 Overlay 版本或内容，Adapter
必须产生字节一致的输出。要求：

- 稳定排序。
- 明确 UTF-8 编码。
- 生成文件统一使用 LF。
- 不在生成内容中写入当前时间、绝对路径或随机 ID。
- 时间只写入 lock 元数据，不参与内容 hash。

## 可重复与幂等

- 连续两次 `sync` 在输入未变化时，第二次不得产生文件变化。
- `diff` 与紧接着的 `sync --dry-run` 必须给出相同变更集。
- 中途失败不得留下声称成功的新 lock。
- 写入多个生成文件时应先写临时目录，验证通过后再提交替换。

## 兼容与迁移

- Config、lock 和 Work Item Schema 迁移必须显式执行。
- 破坏性迁移必须先备份并支持 `--dry-run`。
- Core 不得静默猜测未知字段含义。
- 不支持的未来 Schema 主版本必须拒绝处理并给出升级提示。
