# Figma 工作流

Figma 在 `azi-harness` 中的定位是“页面事实来源”，不是直接代码生成器。

## 标准流程

1. 用户提供具体功能和 Figma 节点级 URL。
2. AI 使用官方 Figma Skill，例如 `figma` 或 `figma-use`，并读取 `.harness/project.json` 和 `.harness/rules/figma.md`。
3. AI 提取布局、可见文本、组件、状态、交互和资源。
4. AI 将内容写入功能规格目录。
5. AI 把接口、权限、字典、后端字段等未知项记录为问题。
6. 执行 `azi spec validate`。
7. 规格通过并补齐业务事实后，才进入页面实现。

## 功能规格中的来源记录

`screens.yaml` 必须记录真实来源。支持的来源包括：

- `figma-mcp`
- `figma-export`
- `screenshot`
- `legacy-page`
- `none`

Figma MCP 正常时，建议记录节点 URL、节点 ID、状态和提取时间。非 Figma 来源时，`source.reference` 应记录导出文件、截图路径或项目内参考页面路径。

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
