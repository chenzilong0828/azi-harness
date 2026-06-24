import { chmod, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyRuntimeWritePlan,
  createRuntimeWritePlan
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";
import { createRuntimeIntents } from "@azi-harness/runtime-templates";
import { prepareSpecCreation } from "@azi-harness/spec-kit";

import { runIntegratedChecks } from "./checks.js";

const temporaryRoots: string[] = [];
const fixtureVue3 = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");
const fixtureVue2 = path.resolve(process.cwd(), "fixtures/ruoyi-vue2-element-ui");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-checks-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("integrated checks", () => {
  it("skips project commands in quick mode", async () => {
    const root = await initializedFixture(fixtureVue3);

    const report = await runIntegratedChecks(root, { quick: true });

    expect(report.valid).toBe(true);
    expect(report.commands.skipped).toBe(true);
    expect(report.commands.skipReason).toContain("--quick");
  });

  it("runs lint, test, and build through the detected package manager", async () => {
    const root = await initializedFixture(fixtureVue3);
    await createFeatureSpec(root, "audit-log");
    const env = await createFakePackageManagerEnvironment(root, {
      lint: 0,
      test: 0,
      build: 0
    });

    const report = await runIntegratedChecks(root, { env });

    expect(report.valid).toBe(true);
    expect(report.commands.results.map((result) => result.status)).toEqual([
      "passed",
      "passed",
      "passed"
    ]);
  });

  it("fails when a project command returns a non-zero exit code", async () => {
    const root = await initializedFixture(fixtureVue3);
    await createFeatureSpec(root, "audit-log");
    const env = await createFakePackageManagerEnvironment(root, {
      lint: 0,
      test: 1,
      build: 0
    });

    const report = await runIntegratedChecks(root, { env });

    expect(report.valid).toBe(false);
    expect(report.commands.errors).toContain("test command failed: npm run test");
    expect(report.commands.results.find((result) => result.role === "test")?.status).toBe("failed");
  });

  it("warns when a disabled command has no reason", async () => {
    const root = await initializedFixture(fixtureVue3);
    await createFeatureSpec(root, "audit-log");
    await writeFile(
      path.join(root, ".harness/config.json"),
      JSON.stringify({
        schemaVersion: "1",
        checks: {
          runProjectCommands: true,
          commands: {
            lint: { enabled: false, reason: "" },
            test: { enabled: true, reason: null },
            build: { enabled: true, reason: null }
          }
        },
        commands: { lint: "lint", test: "test", build: "build" },
        overrides: []
      }, null, 2)
    );
    const env = await createFakePackageManagerEnvironment(root, {
      lint: 0,
      test: 0,
      build: 0
    });

    const report = await runIntegratedChecks(root, { env });

    expect(report.commands.warnings).toContain(
      "Disabled lint command is missing a reason in `.harness/config.json`."
    );
    expect(report.commands.results.find((result) => result.role === "lint")?.status).toBe("skipped");
  });

  it("warns when a Vue 2 project appears to use a Vue 3 bootstrap API", async () => {
    const root = await initializedFixture(fixtureVue2);
    await writeFile(
      path.join(root, "src", "main.js"),
      "import App from './App.vue';\ncreateApp(App).mount('#app');\n"
    );

    const report = await runIntegratedChecks(root, { quick: true });

    expect(report.rules.findings.some((finding) => finding.ruleId === "vue2-no-createapp")).toBe(true);
  });
});

async function initializedFixture(source: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-checks-"));
  temporaryRoots.push(root);
  await cp(source, root, { recursive: true });

  const profile = await detectProject(root);
  const intents = createRuntimeIntents(profile);
  const plan = await createRuntimeWritePlan(root, intents);
  await applyRuntimeWritePlan(plan);

  return root;
}

async function createFeatureSpec(root: string, slug: string): Promise<void> {
  const prepared = await prepareSpecCreation(root, slug);
  const plan = await createRuntimeWritePlan(root, prepared.intents);
  await applyRuntimeWritePlan(plan);
  await writeMinimalReadySpec(root, prepared.directoryName, slug);
}

async function writeMinimalReadySpec(root: string, directoryName: string, slug: string): Promise<void> {
  const specRoot = path.join(root, "specs", directoryName);
  await writeFile(
    path.join(specRoot, "requirements.md"),
    [
      `# 需求：${directoryName}`,
      "",
      "## SDD 追踪",
      "",
      "- REQ-001：完成列表查询与分页。",
      "",
      "## 背景与目标",
      "",
      "- Background / 背景：验证检查命令。",
      "- User goal / 用户目标：完成列表自检。",
      "- Business goal / 业务目标：保证交付质量。",
      "",
      "## 用户角色",
      "",
      "- Roles / 角色：管理员。",
      "",
      "## 范围",
      "",
      "- In scope / 本次包含：列表。",
      "- Out of scope / 本次不包含：新增。",
      "",
      "## 业务规则",
      "",
      "- Rules / 规则：遵守若依分页。",
      "",
      "## 已确认事实",
      "",
      "- APIs：已确认列表接口。",
      "- Permissions / 权限：system:list。",
      "- Dictionaries / 字典：无需新增。",
      "",
      "## 验收条件",
      "",
      "- [ ] 列表分页可用。",
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
      "- Route / 路由：/system/list",
      "- Entry points / 入口：菜单。",
      "- Modules / 模块：查询、列表。",
      "",
      "## 数据与请求",
      "",
      "- Data flow / 数据流：query -> request -> rows。",
      "- Request mapping / 请求映射：listApi。",
      "",
      "## 接入与复用",
      "",
      "- Permission integration / 权限接入：v-hasPermi。",
      "- Dictionary integration / 字典接入：无需新增。",
      "- Feedback / Message / Download 复用：复用项目能力。",
      "- Component choice / 组件选择：普通列表。",
      "- HTWTable evaluation / HTWTable 评估：已评估。",
      "",
      "## 状态与交互",
      "",
      "- States / 状态：default、loading。",
      "- Interactions / 交互：查询。",
      "",
      "## 实现约束",
      "",
      "- Vue constraints / Vue 约束：遵守项目 Vue 版本。",
      "- Rollback / 回退方案：保留原实现。",
      "",
      "## 风险",
      "",
      "- [ ] 无阻断风险。"
    ].join("\n")
  );
  await writeFile(
    path.join(specRoot, "screens.yaml"),
    [
      "version: 1",
      `feature: ${slug}`,
      "source:",
      "  type: legacy-page",
      "  url: \"\"",
      "  nodeId: \"\"",
      "  reference: \"src/views/system/list/index.vue\"",
      "  status: fallback",
      "  retriedAt: \"\"",
      "  fallback: \"same-project-list-page\"",
      "  notes: \"test fixture\"",
      "screens:",
      "  - id: list",
      "    route: \"/system/list\"",
      "    title: \"列表\"",
      "    states:",
      "      - default",
      "    regions: []",
      "    interactions: []",
      "    assets: []",
      "unknowns: []",
      ""
    ].join("\n")
  );
  await writeFile(
    path.join(specRoot, "tasks.md"),
    [
      `# 任务：${directoryName}`,
      "",
      "## 任务列表",
      "",
      "- [ ] TASK-001 完成列表",
      "  - Requirement / 需求：REQ-001",
      "  - Files / 文件：src/views/system/list/index.vue",
      "  - Depends on / 前置：接口确认",
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
      "- [ ] ACC-001 功能路径和核心操作已验证。",
      "  - Requirement / 需求：REQ-001",
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
      "- Used / Exception：已评估。"
    ].join("\n")
  );
}

async function createFakePackageManagerEnvironment(
  root: string,
  exitCodes: Record<"lint" | "test" | "build", number>
): Promise<NodeJS.ProcessEnv> {
  const binDir = path.join(root, ".test-bin");
  await mkdir(binDir, { recursive: true });

  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const scriptPath = path.join(binDir, executable);
  const script = process.platform === "win32"
    ? [
        "@echo off",
        "set SCRIPT=%2",
        `if "%SCRIPT%"=="lint" exit /b ${exitCodes.lint}`,
        `if "%SCRIPT%"=="test" exit /b ${exitCodes.test}`,
        `if "%SCRIPT%"=="build" exit /b ${exitCodes.build}`,
        "exit /b 0",
        ""
      ].join("\r\n")
    : [
        "#!/usr/bin/env sh",
        "script=\"$2\"",
        `if [ "$script" = "lint" ]; then exit ${exitCodes.lint}; fi`,
        `if [ "$script" = "test" ]; then exit ${exitCodes.test}; fi`,
        `if [ "$script" = "build" ]; then exit ${exitCodes.build}; fi`,
        "exit 0",
        ""
      ].join("\n");

  await writeFile(scriptPath, script, "utf8");
  if (process.platform !== "win32") {
    await chmod(scriptPath, 0o755);
  }

  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`
  };
}
