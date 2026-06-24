# 发布与 CI

当前阶段版本为 `0.1.1`，用于开发和试点，不代表正式稳定发布。

## 本地发布前检查

```bash
npm run typecheck
npm test
npm run pack:check
```

Windows 开发者也可以在 `npm run build` 后用 PowerShell 快速入口做本地验证：

```powershell
./scripts/azi.ps1 --help
./scripts/azi.ps1 check . --quick
```

检查目标：

- TypeScript 工程引用可以完整编译。
- 单元测试和集成测试通过。
- 每个 workspace 包具备可发布的 `package.json`、入口和构建产物。
- `@azi-harness/spec-kit` 发布时包含 `schemas/`。
- 内部依赖版本与当前包版本一致。

## 包职责

| 包 | 职责 |
| --- | --- |
| `@azi-harness/core` | 核心类型、扫描、文件计划、配置覆盖 |
| `@azi-harness/detectors` | 项目识别 |
| `@azi-harness/runtime-templates` | 运行时模板 |
| `@azi-harness/spec-kit` | 规格创建和校验 |
| `@azi-harness/checks` | 集成检查 |
| `azi` | CLI 入口 |

## GitLab CI 接入

目标项目初始化后会生成：

```text
.harness/docs/gitlab-ci.example.yml
```

该文件提供 `doctor`、`spec validate`、`check` 和可选 `review` 的示例 job。实际接入时需要根据企业内网 GitLab、Node 镜像和安装方式调整。

`review` 需要明确功能规格目标，示例 job 默认不会强制运行。需要在 CI 中生成交付前审查报告时，设置变量：

```text
AZI_REVIEW_TARGET=specs/<id-feature>
```

设置后 job 会执行：

```bash
npx azi review --target "$AZI_REVIEW_TARGET" --full --diff --evidence --write
```

报告会作为 `.harness/reviews/` artifact 保留，便于人工复核。

## Node 版本策略

用户已确认不强制 Node 20 作为最低版本。当前原则是：

- 不主动使用不必要的高版本 Node API。
- 先在试点项目中收集真实 Node/npm 版本。
- 以实际测试通过的最低版本作为后续正式声明。
- 如果目标项目版本低于 CLI 可支持范围，`doctor` 应明确报错。
