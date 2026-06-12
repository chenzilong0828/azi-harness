# 项目文件与生命周期

## 推荐安装方式

```bash
npm install --save-dev azi-harness
npx azi init --profile omz --adapter codex
```

开发依赖是推荐方式，因为版本会进入 `package.json` 和 lockfile。全局安装仅作为个人
快捷方式，不得成为团队一致性的前提。

## 项目目录

```text
my-project/
├─ package.json
├─ AGENTS.md
├─ .azi/
│  ├─ config.json
│  ├─ lock.json
│  └─ cache/                  # 默认忽略
├─ docs/agent/
│  ├─ instruction.md
│  ├─ architecture.md
│  ├─ workflow.md
│  ├─ permission.md
│  ├─ review.md
│  ├─ evolution.md
│  └─ work/<work-id>/
├─ rules/
│  └─ coding.mdc
└─ .codex/skills/azi-*/       # Codex Adapter 托管生成
```

## 三类文件所有权

| 类型 | 示例 | 可自动覆盖 | 是否提交 Git |
|---|---|---:|---:|
| 项目维护 | `AGENTS.md`、`docs/agent/*`、`rules/*`、`.azi/config.json` | 否 | 是 |
| Harness 托管生成 | `.codex/skills/azi-*`、`.azi/lock.json` | 是 | 团队配置决定 |
| Work Item 产物 | `docs/agent/work/<id>/*` | 否 | 通常是 |

## Seed 规则

Profile 可以提供项目维护文件的初始模板，但只允许：

1. 目标不存在时创建。
2. 目标存在时跳过并报告。
3. 用户明确要求时生成建议 diff。
4. `sync` 和依赖升级不得直接覆盖。

`AGENTS.md` 已存在时，首版不得自动插入内容。CLI 应输出建议片段，由用户确认后处理。

## 生命周期

### Init

- 验证项目目录和依赖版本。
- 写入 `.azi/config.json`。
- 创建缺失的 Seed 文件。
- 编译 Adapter 生成文件。
- 写入 `.azi/lock.json`。
- 不执行项目命令，不修改业务源码。

### Diff

- 计算当前依赖版本下的期望输出。
- 区分新增、更新、删除、冲突和项目维护文件建议。
- 不写文件。

### Sync

- 只更新 Harness 托管生成文件和 lock。
- 删除过期托管文件前必须在 lock 中证明其归属。
- 不删除未知文件。

### Doctor

- 验证配置、锁文件、必需文档、Adapter 输出和 Skill 引用。
- 报告可自动修复项与需人工决策项。
- 默认不修改任何文件。

### Dependency Upgrade

升级由 npm、pnpm 或 yarn 完成：

```bash
npm update azi-harness
npx azi diff
npx azi sync
```

AZI 不实现与包管理器重复的 `upgrade` 下载逻辑。

### Eject

- 默认只删除 lock 中登记的托管生成文件。
- 保留所有项目维护文件和 Work Item 产物。
- 删除配置必须使用额外明确参数并二次确认。

## 冲突策略

| 场景 | 行为 |
|---|---|
| 未登记的目标文件已存在 | 冲突，拒绝覆盖 |
| 登记文件内容等于上次生成 hash | 可安全更新 |
| 登记文件被人工修改 | 冲突，展示 diff |
| Profile 移除某生成文件 | 仅删除 lock 登记且 hash 未变化的文件 |
| Seed 模板发生变化 | 仅提供建议，不自动修改项目文件 |
