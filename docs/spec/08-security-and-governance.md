# 安全、权限与治理

## 默认安全策略

- npm 包不得包含 `postinstall`、`preinstall` 等自动执行脚本。
- `init`、`diff`、`sync` 不执行项目的 lint、test、build 或 git 命令。
- 默认不访问网络，不上传项目内容，不启用遥测。
- 首版只加载当前 npm 包内置 Profile，不执行远程 Profile。
- 所有写操作限制在用户明确指定的项目根目录中。
- 路径必须规范化并防止 `../` 越界和符号链接逃逸。

## 权限模型

Skill 权限分为：

```text
filesystem.read
filesystem.write
commands
git.read
git.write
network
externalSideEffects
```

权限声明是最大能力，不代表自动授权。宿主 Agent 和用户策略可以进一步收紧。

## 审批级别

- `none`：只读或无风险项目写入。
- `before-write`：写项目维护文件或业务代码前确认。
- `before-command`：执行未在项目允许清单中的命令前确认。
- `before-external`：commit、push、PR、发布、部署等外部操作前确认。
- `always`：Skill 每次执行都需批准。

## AFK 与 HITL 模式

- `hitl`：关键写入和命令逐步确认。
- `bounded`：在已批准 Work Item、Skill 权限和预算内连续执行。
- `afk`：允许更长自主执行，但仍受不可覆盖安全规则、Skill 最大权限和预算约束。

执行模式不是权限。即使使用 `afk`，Agent 也不得自动执行 commit、push、PR、发布、部署、
密钥操作或其他高风险外部副作用。

自主预算至少包括最大迭代数、单条命令时限和连续失败上限。触达任一上限时必须停止并
报告当前证据，不能自行重置预算。

以下操作始终需要明确批准：

- 删除或大范围迁移。
- 修改数据库 Schema 或数据。
- 安装、升级、删除依赖。
- 修改身份、权限、计费或安全策略。
- 写入密钥、环境变量或生产配置。
- commit、push、创建或合并 PR。
- 发布和部署。

## 规则优先级

从高到低：

1. 安全与数据保护不可覆盖规则。
2. 用户当前明确指令。
3. 项目 `AGENTS.md` 和 Project Rules。
4. Profile Rules。
5. Skill 默认行为。

低层规则与高层规则冲突时必须停止。用户普通功能指令不能解除安全和数据保护约束。

## 供应链

- npm lockfile 锁定依赖版本。
- `.azi/lock.json` 记录生成文件来源和 hash。
- Profile、Skill、Adapter 必须有版本。
- 未来远程 Registry 必须支持来源、签名、完整性和信任策略；不属于首版。

## 隐私与观测

首版不收集遥测。未来若加入效果指标，必须：

- 默认关闭或明确征得同意。
- 不采集源码、Prompt、密钥和个人数据。
- 提供本地查看、导出和删除。
- 明确每个指标的测量口径。

## 威胁模型最低覆盖

- 恶意 Profile 指导 Agent 执行危险命令。
- 路径遍历覆盖项目外文件。
- sync 删除不属于 Harness 的文件。
- Skill 读取或提交密钥。
- 伪造测试通过、Review 完成或人工批准。
- Adapter 降级时丢失安全语义。
