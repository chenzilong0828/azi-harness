# 验收标准与路线

## 宣传能力追踪

| 图片目标 | AZI 设计对应 | 首版验收 |
|---|---|---|
| 不限 AI 编辑器 | Core 与 Adapter 分离 | Codex 实现，其他 Adapter 可插拔 |
| 职责内聚 | Skill 角色与权限边界 | 12 个 Skill 无主要职责重叠 |
| 高自由度、低耦合 | 可组合 Skill 契约 | 可按任务裁剪流程 |
| SDD 优先 | Work Item 与 Artifacts | 功能需求可产出 PRD、Plan、Issues |
| AFK/HITL | 权限与审批级别 | 高风险、外部操作必须人工批准 |
| 需求不直接跳代码 | 进入条件与 Validator | 缺少最低验收证据时给出阻塞 |
| TODO 与验收可追踪 | Work Item | 每个任务独立记录产物与状态 |
| 稳定 Review/Commit/PR | Review 与 Delivery Skills | 测试、风险、Review 可形成交付摘要 |
| AGENTS + Docs + Rules + Skills | 项目协议四构件 | init 后结构完整且所有权清晰 |

## 阶段 1：规格设计

完成条件：

- 产品边界、架构、生命周期和安全默认值明确。
- 七类核心契约有 JSON Schema。
- `omz` Profile 和 12 个 Skills 有职责矩阵。
- CLI 命令、退出码和冲突策略明确。
- 示例覆盖 Profile、Skill、Adapter、Config、Manifest 和 Work Item。
- 项目 Skill Overlay 只能增加说明或收紧行为，不能扩大机器权限。
- 规格检查通过。

## 阶段 2：Core 与 CLI

范围：

- TypeScript 项目骨架。
- Config/Profile/Skill/Adapter Schema 校验。
- `init/setup/diff/sync/doctor/status/eject`。
- 安全路径处理、hash lock、冲突检测。
- 单元测试和跨平台路径测试。

不包含完整 Skills 内容和 Codex 集成。

## 阶段 3：OMZ Profile

范围：

- `AGENTS.md` Seed。
- 六类 Agent Docs Seed。
- Coding Rules。
- 12 个规范化 Skills。
- Work Item 模板和 Artifact Validators。

## 阶段 4：Codex Adapter

范围：

- 验证当前 Codex 项目级协议。
- 实现生成器和能力降级。
- 在真实前端项目中完成端到端流程。

## 阶段 5：工程门禁与资产复用

范围：

- lint/test/build 执行证据。
- Git diff 与交付 Validator。
- 组件、API、模板和 Owner 元数据。
- 本地全文检索。

## 第一版总体验收

1. 作为 `devDependency` 安装并由 lockfile 锁定版本。
2. 初始化不会覆盖项目已有文件。
3. 同步只修改 lock 中登记的生成文件。
4. Profile、Skills 和 Adapter 都通过 Schema 校验。
5. 12 个 Skills 可组合完成一条真实前端需求。
6. Work Item 支持至少两个并行需求。
7. 测试失败、缺少证据或存在高优先级 Review 问题时不能伪装完成。
8. commit、push、PR、发布和部署不会在未批准时执行。
9. 不需要模型 API Key，不上传项目源码。
10. Windows、macOS 和 Linux 的核心文件生命周期测试通过。

## 暂缓决策

以下内容必须在对应阶段通过 Spike 决定，不在第一阶段猜测：

- Codex 最新项目 Skill 发现路径和元数据细节。
- Claude Code、Cursor 的准确 Adapter 格式。
- Work Item 与 GitHub/Jira Issue 的双向同步。
- 远程 Registry、签名和组织权限模型。
- 遥测或效能指标产品化。
