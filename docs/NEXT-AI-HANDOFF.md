# 下一位 AI 接手说明

## 用户的核心反馈

用户认为当前 `azi-harness` 的问题不是功能少，而是触发成本高、定义模糊、容易变成“Codex + MCP + Skill + rules 已经能做的事”。

后续不要继续优先堆子命令。产品方向必须改成：团队级 AI 开发运行时。

## 新定位

`azi-harness` 不是代码生成器，也不是替代 Codex/Cursor/MCP/Skill。

它应该是安装到项目里的团队规范与上下文运行时：

- 保存项目事实：若依版本、Vue 版本、UI 框架、请求封装、权限、字典、分页约定。
- 保存团队约束：不能乱写路由、权限、store、公共组件，不能混用 Vue2/Vue3 API。
- 保存 Figma 缓存：相同页面下次优先读 `.harness/figma-cache/`，避免重复调用 Figma API/MCP 和 429。
- 保存 Skill 匹配：根据任务自动提示 Figma、Superpowers、HTWTable、Review 等合适能力。
- 保存交付证据：workflow、specs、reviews、proposals，让团队多人和多 AI 能接续。

## 用户期望的体验

理想体验不是让用户记命令。

用户希望可以直接对 AI 说：

> 请依照我给的 Figma 页面进行开发

AI 读取项目中的 `AGENTS.md` 和 `.harness/` 后，应该自动：

1. 识别 Figma URL 或 Figma 任务意图。
2. 优先读取本地 Figma 缓存。
3. 没有缓存时拉 Figma 并缓存节点、SVG、截图或降级记录。
4. 找相似页面和组件。
5. 匹配合适 Skill。
6. 生成 Codex/AI 可直接执行的实现上下文。
7. 按若依约束生成最小补丁或在明确允许时创建缺失页面。
8. 跑 quick check / review，输出阻塞项。

## 当前已经做到的部分

直接入口：

```bash
azi task "<用户原话>"
azi go "<用户原话>"
azi figma "<figma-node-url>" --yes
azi figma "<figma-node-url>" --apply
```

已经会：

- 创建或复用 workflow 规格。
- 写 `.harness/figma-cache/<id-feature>/source.json`、`nodes.json`、`notes.md`。
- 有 `FIGMA_TOKEN` 时下载 SVG；没有 token 时记录 skipped，不失败。
- 429 时记录重试与 fallback 信息。
- 扫描 `src/views/**/*.vue` 找相似页面。
- 生成 `.harness/implementation/<id-feature>/codex-context.md`。
- 生成 `.harness/proposals/<id-feature>-implementation.patch`。
- `--apply` 时只创建不存在的建议目标页面，不覆盖已有业务文件。
- 自动跑 quick check，并输出前几个阻塞错误和警告。
- `azi task` 会自动路由 Figma URL、HTWTable API 核对、quick check 和普通开发/新增/修改/修复任务。
- 普通开发任务会自动派生稳定 slug，创建或复用 workflow/spec，输出 Skill 匹配、必读文件、quick check 和下一步。

## 下一步最高优先级

不要再先做复杂命令。

低指令触发层已经有 MVP，接下来优先把它做硬：

1. 接入或消费更细的真实 Figma MCP / REST 节点事实，把组件、文案、布局、区域、交互写入可执行上下文。
2. 把 `.harness/figma-cache/` 的复用策略继续做成可验证行为，尤其是 429、fallback、SVG 缓存和相同 fileKey + nodeId 命中。
3. 强化若依适配：权限、字典、请求封装、分页、路由、菜单、HTWTable 必须从相似页面和项目事实读取，不能凭空生成。
4. 把这些若依约束从规则提示升级为 `review/check` blocker。
5. 用真实若依项目做 pilot，验证 `azi task -> Figma/Workflow -> 最小补丁 -> review` 是否真的比“直接 Codex + rules”更稳。

## 判断后续工作是否正确

正确方向：

- 用户需要记住的命令越来越少。
- AI 自动读取 `.harness/` 并知道下一步。
- Figma 页面第二次出现时会优先读缓存。
- 若依项目输出越来越像项目已有代码。
- 团队成员和不同 AI 工具读到同一套规则。

错误方向：

- 继续新增很多需要用户记忆的子命令。
- 把 `azi-harness` 做成另一个代码生成器。
- 把本来 MCP/Skill 能做的一次性动作包装成复杂 CLI。
- 只生成文档，不减少团队开发时的误输出和重复上下文成本。
