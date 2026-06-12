# CLI 交互契约

## 定位

`azi` 是 `azi-harness` 开发依赖提供的管理界面，不是独立产品。所有命令必须支持脚本化，
错误写入 stderr，并使用稳定退出码。

## 首版命令

```text
azi init [directory] --profile <name> --adapter <name>
azi setup <profile> [directory] --adapter <name>  # init 的便捷别名
azi diff [directory]
azi sync [directory]
azi doctor [directory]
azi status [directory]
azi profile list
azi skill list [--profile <name>]
azi eject [directory] --generated-only
```

## 命令语义

### `init`

- 首次接入项目。
- 默认目录为当前目录。
- 默认 Profile 可以是 `omz`，但输出必须明确显示。
- 已初始化项目必须拒绝重复执行，并建议 `diff` 或 `sync`。

### `setup`

为宣传材料中的 `setup omz` 使用习惯提供别名：

```bash
npx azi setup omz .
```

其行为必须完全映射到 `init --profile omz`，不得形成第二套生命周期。

### `diff`

- 纯只读。
- 输出新增、修改、删除、冲突和 Seed 建议。
- 退出码区分“无变化”“有变化”“执行错误”。

### `sync`

- 默认先展示摘要。
- 支持 `--dry-run`。
- 只处理 lock 可证明归属的生成文件。
- 冲突时拒绝部分危险写入，并给出恢复建议。

### `doctor`

检查：

- Node 与包版本兼容性。
- 配置和 Schema。
- Profile、Skill、Adapter 引用。
- Seed 文件存在性。
- 生成文件漂移。
- Work Item 基础完整性。
- Adapter 能力缺口。

### `status`

显示依赖版本、Profile、Adapters、最后同步时间、漂移状态和活跃 Work Items，不使用
单一全局研发阶段。

### `eject`

首版只允许 `--generated-only`。没有明确参数时拒绝执行。

## 通用选项

```text
--json       输出机器可读结果
--dry-run    不写文件
--verbose    输出诊断细节
--no-color   禁用颜色
--yes        只跳过低风险确认，不得跳过高风险审批
```

## 退出码

| 退出码 | 含义 |
|---:|---|
| 0 | 成功且无需处理 |
| 1 | 一般执行错误 |
| 2 | 参数或配置错误 |
| 3 | 检测到漂移或待同步变化 |
| 4 | 文件冲突，需要人工处理 |
| 5 | 安全策略拒绝操作 |

## 可用性要求

- 每个失败都必须说明发生了什么、未执行什么、下一步是什么。
- 不得用成功退出码掩盖部分失败。
- `--json` 输出不得混入人类提示文本。
- Windows、macOS、Linux 路径行为必须通过测试。
