# 试点记录模板

复制本模板，为每个真实项目建立一份试点记录。记录要以可复核事实为主，避免只写结论。

## 基本信息

- 项目名称：
- 项目类型：
- 试点日期：
- 试点负责人：
- Git 仓库：
- Git 分支：
- 操作系统：
- 终端：
- Node 版本：
- 包管理器及版本：
- CI 环境：

## 试点范围

- 试点功能：
- 功能类型：
- Figma 节点或视觉来源：
- 接口来源：
- 权限来源：
- 字典来源：
- 后端字段来源：

## 项目识别

命令：

```bash
npx azi detect . --explain
```

结果：

- 识别项目类型：
- 识别 Vue 版本：
- 识别 UI 框架：
- 识别若依能力：
- 识别 HTWTable：
- 识别命令：

问题：

- 错误识别：
- 缺失证据：
- 冲突证据：
- 需要新增的识别规则：

## 初始化

命令：

```bash
npx azi init . --dry-run
npx azi init . --yes
```

结果：

- 新增文件：
- 冲突文件：
- 建议补丁：
- 是否存在静默覆盖：

## 运行时检查

命令：

```bash
npx azi doctor . --json
npx azi check . --quick --json
```

结果：

- doctor 错误：
- doctor 警告：
- check 错误：
- check 警告：
- 误报：
- 漏报：

## 功能规格

命令：

```bash
npx azi spec create <feature-name> . --yes
npx azi spec validate specs --json
```

结果：

- 规格目录：
- `requirements.md` 完成情况：
- `design.md` 完成情况：
- `screens.yaml` 来源记录：
- `tasks.md` 完成情况：
- `acceptance.md` 完成情况：
- 仍然未知的业务事实：

## HTWTable

命令：

```bash
npx azi htw inspect . --write-doc
```

结果：

- 是否安装：
- 包名：
- 版本：
- 公开入口：
- 公开 signals：
- 本功能是否使用：
- 例外原因：
- 搜索字典同步方式：
- 新增/编辑/删除后的刷新方式：
- 导出查询条件来源：

## AI 实现观察

- 使用的 AI 工具：
- 是否读取 `AGENTS.md`：
- 是否读取 `.harness/project.json`：
- 是否读取 `.harness/rules/`：
- 是否读取当前规格：
- 是否使用适用外部 Skill / 插件能力：
- 是否猜测接口、权限、字典或字段：
- 是否混用 Vue2/Vue3 API：
- 是否重复实现若依公共能力：
- 是否遵守 HTWTable 决策：

## 最终验证

命令：

```bash
npx azi spec validate specs --json
npx azi check . --json
```

结果：

- lint：
- test：
- build：
- spec validate：
- check：
- 人工验收：

## 结论

- 是否通过试点：
- 阻塞问题：
- 可接受风险：
- 需要修改的通用运行时：
- 只属于本项目的配置：
- 下一轮试点建议：
