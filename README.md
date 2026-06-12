# AZI Harness

AZI Harness 是安装在软件项目中的开发期依赖。它把团队知识、研发规则、职责边界和
SDD 工作流转化为 Coding Agent 可以读取、执行和验证的项目级协议。

当前仓库处于 **阶段 1：规格设计**。旧 CLI 原型已经移除，尚未提供可安装的运行时。

## 产品结构

```text
AZI Harness
├─ Core               协议、配置和生命周期
├─ Profiles           可版本化的团队工作流组合
├─ Skills             有输入输出契约的工作单元
├─ Adapters           不同 Coding Agent 的格式适配
├─ Validators         项目和交付产物检查
├─ Project Knowledge  项目维护的真实知识
└─ CLI                上述能力的管理界面
```

CLI 不是产品本体。未来推荐的安装方式是：

```bash
npm install --save-dev azi-harness
npx azi init --profile omz --adapter codex
```

## 第一阶段成果

- [规格索引](./docs/spec/README.md)
- [架构决策](./docs/adr/README.md)
- [JSON Schema](./schemas/)
- [契约示例](./examples/)
- [验收与追踪矩阵](./docs/spec/10-acceptance-and-roadmap.md)

检查规格文件：

```bash
npm run spec:check
```

运行时代码将在规格审核通过后进入第二阶段开发。
