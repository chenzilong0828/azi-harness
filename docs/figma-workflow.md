# Figma 工作流

Figma 在 `azi-harness` 中的定位是“页面事实来源”和“可缓存上下文来源”，不是业务事实生成器。

## 标准流程

1. 用户直接给 AI 一个 Figma 节点级 URL，或说“按 Figma 页面开发 / 还原设计稿”。
2. AI 先读取 `AGENTS.md`、`.harness/project.json` 和 `.harness/rules/figma.md`。
3. AI 优先运行 `npx azi task "<用户原话>"`，让运行时识别 URL、读取 `.harness/figma-cache/`、匹配 Skill、寻找相似页面并生成实现上下文。
4. 缓存缺失时，AI 使用官方 Figma Skill / MCP 或 `azi figma "<url>" --yes` 的同等流程提取布局、可见文本、组件、状态、交互和资源，并写入缓存。
5. AI 将来源记录、规格建议和候选实现补丁写入 `.harness/figma-cache/`、`specs/` 建议补丁和 `.harness/proposals/`。
6. AI 把接口、权限、字典、后端字段等未知项记录为问题，不能从 Figma 推断。
7. 默认只生成候选补丁；只有用户明确允许 `--apply` 时，才可创建不存在的建议目标页面。已有业务页面不能覆盖。
8. 执行 quick check / `azi spec validate` / review，并输出阻塞项。

## 功能规格中的来源记录

`screens.yaml` 必须记录真实来源。支持的来源包括：

- `figma-mcp`
- `figma-export`
- `screenshot`
- `legacy-page`
- `none`

Figma MCP 正常时，建议记录节点 URL、节点 ID、状态和提取时间。非 Figma 来源时，`source.reference` 应记录导出文件、截图路径或项目内参考页面路径。相同 fileKey + nodeId 下一次必须优先读取 `.harness/figma-cache/`，禁止重复请求 Figma API/MCP。

## 429 限流处理

Figma MCP 可能返回 429。处理原则是停止重复请求、记录状态、等待可重试时间，并允许人工确认降级方案。

`screens.yaml` 中应记录：

```yaml
source:
  type: figma-mcp
  status: rate-limited
  url: "<node-specific-figma-url>"
  retriedAt: "2026-06-16T10:00:00+08:00"
  fallback: figma-export
  notes: "Figma MCP returned 429. Use exported frame until retry is available."
```

## 降级方案

可接受的降级方案：

- Figma 导出的 frame 图片。
- 人工提供的截图。
- 目标项目内同类页面，仅用于确认实现方式和布局习惯。

不可接受的行为：

- 把旧项目当成通用视觉模板。
- 因为 MCP 不可用就猜测页面内容。
- 因为截图里出现按钮就猜权限字符串。
- 因为表格列名就猜接口字段。
- 绕过缓存反复请求同一个 Figma 节点。
- 覆盖已有业务页面。
