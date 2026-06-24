import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyRuntimeWritePlan, createRuntimeWritePlan } from "@azi-harness/core";

import {
  analyzeSpecTraceability,
  prepareSpecCreation,
  summarizeSpecValidation,
  validateSpecs
} from "./specs.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-specs-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("spec creation", () => {
  it("increments the next spec number and creates five files", async () => {
    const root = await createTemporaryRoot();
    await mkdir(path.join(root, "specs", "001-existing"), { recursive: true });

    const prepared = await prepareSpecCreation(root, "user-management");
    const plan = await createRuntimeWritePlan(root, prepared.intents);
    const written = await applyRuntimeWritePlan(plan);

    expect(prepared.directoryName).toBe("002-user-management");
    expect(written).toHaveLength(5);
    expect(await readFile(path.join(root, "specs", "002-user-management", "screens.yaml"), "utf8")).toContain(
      "feature: user-management"
    );
    const screens = await readFile(path.join(root, "specs", "002-user-management", "screens.yaml"), "utf8");
    const requirements = await readFile(
      path.join(root, "specs", "002-user-management", "requirements.md"),
      "utf8"
    );
    const tasks = await readFile(path.join(root, "specs", "002-user-management", "tasks.md"), "utf8");
    const acceptance = await readFile(
      path.join(root, "specs", "002-user-management", "acceptance.md"),
      "utf8"
    );
    expect(screens).toContain("status: pending");
    expect(screens).toContain("fallback: \"\"");
    expect(requirements).toContain("## 背景与目标");
    expect(requirements).toContain("REQ-001");
    expect(requirements).toContain("## 验收条件");
    expect(tasks).toContain("## 任务列表");
    expect(tasks).toContain("Verify / 验证：azi spec validate");
    expect(tasks).toContain("TASK-001");
    expect(acceptance).toContain("## 检查结果");
    expect(acceptance).toContain("- lint：");
    expect(acceptance).toContain("ACC-001");
  });
});

describe("spec validation", () => {
  it("flags a generated spec as a draft instead of treating placeholders as ready", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));

    const reports = await validateSpecs(root);
    const summary = summarizeSpecValidation(reports);

    expect(summary.valid).toBe(false);
    expect(summary.errors).toBeGreaterThan(0);
    expect(reports[0]?.errors).toContain(
      "specs/001-audit-log/requirements.md has an empty required field: APIs："
    );
    expect(reports[0]?.errors).toContain(
      "specs/001-audit-log/screens.yaml source is still pending; record Figma, screenshot, legacy-page, or approved fallback evidence before implementation."
    );
  });

  it("reports invalid screens.yaml content", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));
    await writeFile(
      path.join(root, prepared.directoryName ? "specs" : "specs", prepared.directoryName, "screens.yaml"),
      "version: 2\nfeature: audit-log\nsource: []\nscreens: []\nunknowns: {}\n"
    );

    const reports = await validateSpecs(root, path.posix.join("specs", prepared.directoryName));

    expect(reports[0]?.valid).toBe(false);
    expect(reports[0]?.errors.some((error) => error.includes("version: 1"))).toBe(true);
    expect(reports[0]?.errors.some((error) => error.includes("source must be an object"))).toBe(true);
  });

  it("warns when Figma MCP is rate-limited without a retry checkpoint or fallback", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));
    await writeReadyMarkdownSpec(root, prepared.directoryName);
    await writeFile(
      path.join(root, "specs", prepared.directoryName, "screens.yaml"),
      [
        "version: 1",
        "feature: audit-log",
        "source:",
        "  type: figma-mcp",
        "  url: \"\"",
        "  nodeId: \"\"",
        "  reference: \"\"",
        "  status: rate-limited",
        "  retriedAt: \"\"",
        "  fallback: \"\"",
        "  notes: \"Figma MCP returned 429.\"",
        "screens:",
        "  - id: list",
        "    route: \"/audit/log\"",
        "    title: \"审计日志\"",
        "    states:",
        "      - default",
        "    regions: []",
        "    interactions: []",
        "    assets: []",
        "unknowns: []",
        ""
      ].join("\n")
    );

    const reports = await validateSpecs(root, path.posix.join("specs", prepared.directoryName));

    expect(reports[0]?.valid).toBe(true);
    expect(reports[0]?.warnings).toContain(
      "specs/001-audit-log/screens.yaml source.retriedAt should record when Figma MCP can be retried."
    );
    expect(reports[0]?.warnings).toContain(
      "specs/001-audit-log/screens.yaml source.fallback should record the approved fallback after Figma 429."
    );
  });

  it("warns when required markdown sections are missing", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));
    await writeReadySpec(root, prepared.directoryName);
    await writeFile(
      path.join(root, "specs", prepared.directoryName, "requirements.md"),
      [
        "# 需求：audit-log",
        "",
        "## SDD 追踪",
        "",
        "- REQ-001：查询审计日志。",
        "- REQ-002：分页展示审计日志。",
        "",
        "## 范围",
        "",
        "- In scope / 本次包含：列表页",
        ""
      ].join("\n")
    );

    const reports = await validateSpecs(root, path.posix.join("specs", prepared.directoryName));

    expect(reports[0]?.valid).toBe(true);
    expect(reports[0]?.warnings).toContain(
      "Expected heading `## 背景与目标` in specs/001-audit-log/requirements.md."
    );
    expect(reports[0]?.warnings).toContain(
      "Expected heading `## 已确认事实` in specs/001-audit-log/requirements.md."
    );
  });

  it("warns when a legacy-page source has no reference path", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));
    await writeReadyMarkdownSpec(root, prepared.directoryName);
    await writeFile(
      path.join(root, "specs", prepared.directoryName, "screens.yaml"),
      [
        "version: 1",
        "feature: audit-log",
        "source:",
        "  type: legacy-page",
        "  url: \"\"",
        "  nodeId: \"\"",
        "  reference: \"\"",
        "  status: fallback",
        "  retriedAt: \"\"",
        "  fallback: \"same-project-list-page\"",
        "  notes: \"Use the existing page as the approved fallback.\"",
        "screens:",
        "  - id: list",
        "    route: \"/audit/log\"",
        "    title: \"审计日志\"",
        "    states:",
        "      - default",
        "    regions: []",
        "    interactions: []",
        "    assets: []",
        "unknowns: []",
        ""
      ].join("\n")
    );

    const reports = await validateSpecs(root, path.posix.join("specs", prepared.directoryName));

    expect(reports[0]?.valid).toBe(true);
    expect(reports[0]?.warnings).toContain(
      "specs/001-audit-log/screens.yaml source.reference should record the in-project reference page path."
    );
  });

  it("reports unknown requirement references and duplicate trace ids", () => {
    const report = analyzeSpecTraceability({
      specPath: "specs/001-audit-log",
      requirements: [
        "## SDD 追踪",
        "- REQ-001：查询日志。",
        "- REQ-001：重复需求。",
        "- 这里只是提到 REQ-999，不应算作定义。"
      ].join("\n"),
      tasks: [
        "- [ ] TASK-001 查询日志",
        "  - Requirement / 需求：REQ-999",
        "- [ ] TASK-001 重复任务",
        "  - Requirement / 需求：REQ-001"
      ].join("\n"),
      acceptance: [
        "- [ ] ACC-001 验证查询",
        "  - Requirement / 需求：REQ-001",
        "- [ ] ACC-001 重复验收",
        "  - Requirement / 需求：REQ-001"
      ].join("\n")
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContain(
      "specs/001-audit-log/requirements.md defines duplicate requirement id `REQ-001`."
    );
    expect(report.errors).toContain(
      "specs/001-audit-log/tasks.md TASK-001 references unknown requirement id `REQ-999`."
    );
    expect(report.errors).toContain(
      "specs/001-audit-log/tasks.md defines duplicate task id `TASK-001`."
    );
    expect(report.errors).toContain(
      "specs/001-audit-log/acceptance.md defines duplicate acceptance id `ACC-001`."
    );
  });
});

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-specs-"));
  temporaryRoots.push(root);
  return root;
}

async function writeReadySpec(root: string, directoryName: string): Promise<void> {
  await writeReadyMarkdownSpec(root, directoryName);
  await writeReadyScreens(root, directoryName);
}

async function writeReadyMarkdownSpec(root: string, directoryName: string): Promise<void> {
  const specRoot = path.join(root, "specs", directoryName);
  await writeFile(
    path.join(specRoot, "requirements.md"),
    [
      `# 需求：${directoryName}`,
      "",
      "## SDD 追踪",
      "",
      "- REQ-001：支持审计日志条件查询。",
      "- REQ-002：支持审计日志分页展示。",
      "",
      "## 背景与目标",
      "",
      "- Background / 背景：补充审计日志列表能力。",
      "- User goal / 用户目标：查看审计日志并按条件查询。",
      "- Business goal / 业务目标：提升操作追溯效率。",
      "",
      "## 用户角色",
      "",
      "- Roles / 角色：系统管理员。",
      "",
      "## 范围",
      "",
      "- In scope / 本次包含：列表查询。",
      "- Out of scope / 本次不包含：新增和删除。",
      "",
      "## 业务规则",
      "",
      "- Rules / 规则：按若依分页约定查询。",
      "",
      "## 已确认事实",
      "",
      "- APIs：使用已确认的日志列表接口。",
      "- Permissions / 权限：system:log:list。",
      "- Dictionaries / 字典：无需新增字典。",
      "",
      "## 验收条件",
      "",
      "- [ ] 列表查询、分页和权限表现符合规格。",
      "",
      "## 未知项",
      "",
      "- 无。"
    ].join("\n")
  );
  await writeFile(
    path.join(specRoot, "design.md"),
    [
      `# 设计：${directoryName}`,
      "",
      "## 页面和模块边界",
      "",
      "- Route / 路由：/system/log",
      "- Entry points / 入口：动态菜单。",
      "- Modules / 模块：查询表单、列表表格。",
      "",
      "## 数据与请求",
      "",
      "- Data flow / 数据流：查询参数 -> 请求封装 -> 表格数据。",
      "- Request mapping / 请求映射：getLogList。",
      "",
      "## 接入与复用",
      "",
      "- Permission integration / 权限接入：v-hasPermi。",
      "- Dictionary integration / 字典接入：无需新增字典。",
      "- Feedback / Message / Download 复用：复用项目消息能力。",
      "- Component choice / 组件选择：普通列表优先评估 HTWTable。",
      "- HTWTable evaluation / HTWTable 评估：场景适配，使用目标项目公开 API。",
      "",
      "## 状态与交互",
      "",
      "- States / 状态：default、loading、empty、error。",
      "- Interactions / 交互：查询、重置、分页。",
      "",
      "## 实现约束",
      "",
      "- Vue constraints / Vue 约束：按当前项目 Vue 版本实现。",
      "- Rollback / 回退方案：保留原表格实现备选。",
      "",
      "## 风险",
      "",
      "- [ ] HTWTable API 需以目标项目版本为准。"
    ].join("\n")
  );
  await writeFile(
    path.join(specRoot, "tasks.md"),
    [
      `# 任务：${directoryName}`,
      "",
      "## 任务列表",
      "",
      "- [ ] TASK-001 实现查询表单",
      "  - Requirement / 需求：REQ-001",
      "  - Files / 文件：src/views/system/log/index.vue",
      "  - Depends on / 前置：接口和权限已确认",
      "  - Verify / 验证：azi spec validate",
      "- [ ] TASK-002 实现列表分页",
      "  - Requirement / 需求：REQ-002",
      "  - Files / 文件：src/views/system/log/index.vue",
      "  - Depends on / 前置：TASK-001",
      "  - Verify / 验证：azi check"
    ].join("\n")
  );
  await writeFile(
    path.join(specRoot, "acceptance.md"),
    [
      `# 验收：${directoryName}`,
      "",
      "## 功能验收",
      "",
      "- [ ] ACC-001 条件查询和核心操作已验证。",
      "  - Requirement / 需求：REQ-001",
      "  - Evidence / 证据：测试报告。",
      "- [ ] ACC-002 分页展示已验证。",
      "  - Requirement / 需求：REQ-002",
      "  - Evidence / 证据：测试报告。",
      "",
      "## 权限验收",
      "",
      "- [ ] permission 行为已验证。",
      "",
      "## 字典与状态",
      "",
      "- [ ] 字典展示、loading、empty、error、normal 状态已验证。",
      "",
      "## 分页字段",
      "",
      "- [ ] pageNum/pageSize/rows/total 行为已验证。",
      "",
      "## 视觉对照",
      "",
      "- [ ] 已对照同类页面。",
      "",
      "## 检查结果",
      "",
      "- lint：待执行",
      "- test：待执行",
      "- build：待执行",
      "",
      "## Review 记录",
      "",
      "- Reviewer：待人工确认",
      "- Notes：待人工确认",
      "",
      "## HTWTable 说明",
      "",
      "- Used / Exception：使用 HTWTable。"
    ].join("\n")
  );
}

async function writeReadyScreens(root: string, directoryName: string): Promise<void> {
  await writeFile(
    path.join(root, "specs", directoryName, "screens.yaml"),
    [
      "version: 1",
      "feature: audit-log",
      "source:",
      "  type: legacy-page",
      "  url: \"\"",
      "  nodeId: \"\"",
      "  reference: \"src/views/system/log/index.vue\"",
      "  status: fallback",
      "  retriedAt: \"\"",
      "  fallback: \"same-project-list-page\"",
      "  notes: \"Use the existing page as the approved fallback.\"",
      "screens:",
      "  - id: list",
      "    route: \"/audit/log\"",
      "    title: \"审计日志\"",
      "    states:",
      "      - default",
      "    regions: []",
      "    interactions: []",
      "    assets: []",
      "unknowns: []",
      ""
    ].join("\n")
  );
}
