# 系统架构

`azi-harness` 采用 npm workspace 拆分为多个小包。CLI 只是入口，真正的产品产物是写入目标项目的运行时文件。

## 分层

```text
azi-harness 源码项目
├── packages/core              # 类型、扫描、文件写入计划、配置覆盖
├── packages/detectors         # 项目识别与证据收集
├── packages/runtime-templates # 运行时文件模板
├── packages/spec-kit          # 功能规格创建、Schema、校验
├── packages/checks            # 集成检查
└── packages/cli               # 命令行入口和命令编排
```

目标业务项目被初始化后，会出现：

```text
target-project/
├── AGENTS.md
├── .harness/
│   ├── config.json
│   ├── manifest.json
│   ├── project.json
│   ├── proposals/
│   ├── reviews/
│   ├── workflows/
│   ├── docs/
│   └── rules/
├── .agents/
│   └── skills/
├── .cursor/
│   └── rules/
└── specs/
```

## 数据流

1. `detectors` 扫描目标项目，识别 Vue、UI 框架、若依能力、请求封装、权限、字典、HTWTable、命令等事实。
2. `core` 合并 `.harness/config.json` 中允许覆盖的配置，生成有效项目画像。
3. `runtime-templates` 根据项目画像生成运行时文件意图。
4. `core` 创建安全写入计划，避免静默覆盖已有用户文件。
5. `cli` 执行 `init`、`sync`、`doctor`、`check`、`task/go`、`workflow start/status/advance/log`、`review`、`context`、`skill list/search/match/doctor/sources/install-guide`、`spec` 和 `htw inspect`。
6. `workflow start` 把规格创建、Skill 匹配和下一步清单收束成任务启动入口，并写入 `.harness/workflows/*.json` 与 `specs/<id>/workflow.md`。
7. `workflow advance` 按 `clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit` 推进状态机，默认不允许跳阶段。
8. `review` 建立“规格意图 -> Git 实现 -> 验收证据”模型，同时采集 staged、unstaged、untracked 变更并生成分级报告。
9. `review --suggest-patch` 只把 acceptance.md 的统一 diff 建议写入 `.harness/proposals/`，不直接修改规格或业务代码。
10. `checks` 与 `spec-kit` 负责后续自动检查和规格校验。

## 设计原则

- 项目事实必须来自当前目标项目证据，不能凭记忆或旧项目迁移。
- `AGENTS.md` 只做短入口，详细规则分散在运行时目录。
- 运行时文件分为 `managed` 和 `seeded`，降低覆盖风险。
- 检查失败要给出可复核原因，而不是静默通过。
- `.windsurfrules` 和旧 Sanshu 规则不参与扫描、迁移或执行。
