# ADR-001：作为项目开发依赖安装

状态：Accepted

## 决策

`azi-harness` 默认通过 `devDependency` 安装，CLI 使用 `npx azi`、`pnpm azi` 或项目脚本调用。

## 原因

- 版本进入 `package.json` 和 lockfile。
- 团队与 CI 使用一致版本。
- 包管理器负责下载、升级和完整性。
- Harness 不进入业务运行产物。

全局安装只作为个人快捷方式，不作为团队工作流前提。
