import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  createSddStatus,
  prepareSddArtifact,
  writeSddArtifact
} from "./sdd-runtime.js";
import {
  applyPreparedWorkflowStart,
  prepareWorkflowStart
} from "./workflow-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-sdd-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("SDD runtime", () => {
  it("reports draft traceability and becomes ready after required facts are filled", async () => {
    const root = await initializedWorkflow();

    const draft = await createSddStatus({
      root,
      target: "specs/001-audit-log"
    });
    expect(draft.valid).toBe(false);
    expect(draft.stage).toBe("draft");
    expect(draft.traceability.requirementIds).toEqual(["REQ-001"]);
    expect(draft.traceability.taskIds).toEqual(["TASK-001", "TASK-002", "TASK-003"]);
    expect(draft.traceability.acceptanceIds).toEqual(["ACC-001"]);

    await fillRequiredSpecFacts(root);
    const ready = await createSddStatus({
      root,
      target: "specs/001-audit-log"
    });
    expect(ready.blockingIssues).toEqual([]);
    expect(ready.valid).toBe(true);
    expect(ready.stage).toBe("ready-for-implementation");
    expect(ready.traceability.requirementToTasks["REQ-001"]).toEqual([
      "TASK-001",
      "TASK-002",
      "TASK-003"
    ]);
    expect(ready.traceability.requirementToAcceptance["REQ-001"]).toEqual(["ACC-001"]);
  });

  it("previews, writes once, skips identical output, and protects user changes", async () => {
    const root = await initializedWorkflow();
    const target = "specs/001-audit-log";
    const artifactPath = path.join(root, target, "sdd", "clarify.md");

    const preview = await prepareSddArtifact({ root, target, phase: "clarify" });
    expect(preview.plan.entries[0]?.action).toBe("create");
    expect(preview.content).toContain("不要猜接口、权限、字典、字段或后端行为");
    await expect(readFile(artifactPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });

    const written = await writeSddArtifact(preview);
    expect(written.written).toEqual(["specs/001-audit-log/sdd/clarify.md"]);

    const repeated = await prepareSddArtifact({ root, target, phase: "clarify" });
    expect(repeated.plan.entries[0]?.action).toBe("skip");
    expect((await writeSddArtifact(repeated)).written).toEqual([]);

    await writeFile(artifactPath, "# 人工澄清记录\n\n不得覆盖。\n", "utf8");
    const conflict = await prepareSddArtifact({ root, target, phase: "clarify" });
    expect(conflict.plan.hasConflicts).toBe(true);
    expect(conflict.plan.entries[0]?.action).toBe("conflict");
    await expect(writeSddArtifact(conflict)).rejects.toThrow("conflicts");
    expect(await readFile(artifactPath, "utf8")).toContain("不得覆盖");

    const retrospective = await prepareSddArtifact({ root, target, phase: "retrospective" });
    expect(retrospective.content).toContain("只记录真实发生的结果");
    expect(retrospective.artifactPath).toBe("specs/001-audit-log/sdd/retrospective.md");

    const issues = await prepareSddArtifact({ root, target, phase: "issues" });
    expect(issues.content).toContain("Tasks / 任务：TASK-001, TASK-002, TASK-003");
    expect(issues.content).toContain("Acceptance / 验收：ACC-001");
  });

  it("rejects targets outside a numbered spec directory", async () => {
    const root = await initializedWorkflow();

    await expect(createSddStatus({ root, target: "../outside" })).rejects.toThrow(
      "escapes the project root"
    );
    await expect(createSddStatus({ root, target: "specs" })).rejects.toThrow(
      "numbered spec directory"
    );
  });
});

async function initializedWorkflow(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-sdd-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  await applyPreparedInitialization(await prepareRuntimeInitialization(root));
  await applyPreparedWorkflowStart(await prepareWorkflowStart({
    root,
    featureName: "audit-log",
    slug: null,
    task: "审计日志列表改造",
    includeAvoided: false
  }));
  return root;
}

async function fillRequiredSpecFacts(root: string): Promise<void> {
  const specRoot = path.join(root, "specs", "001-audit-log");
  const requirementsPath = path.join(specRoot, "requirements.md");
  const requirements = await readFile(requirementsPath, "utf8");
  await writeFile(requirementsPath, requirements
    .replace("- REQ-001：待确认的核心需求。", "- REQ-001：支持审计日志列表查询。")
    .replace("Source / 来源：", "Source / 来源：已确认的业务需求。")
    .replace("Status / 状态：draft", "Status / 状态：confirmed")
    .replace("Background / 背景：", "Background / 背景：补充审计日志能力。")
    .replace("User goal / 用户目标：", "User goal / 用户目标：查询审计日志。")
    .replace("Business goal / 业务目标：", "Business goal / 业务目标：提升追溯效率。")
    .replace("APIs：", "APIs：使用已确认的日志列表接口。")
    .replace("Permissions / 权限：", "Permissions / 权限：system:log:list。")
    .replace("- [ ] 描述业务验收条件。", "- [ ] 审计日志列表可按条件查询。")
    .replace("- [ ] 明确记录阻塞问题。", "- 无。"), "utf8");

  const designPath = path.join(specRoot, "design.md");
  const design = await readFile(designPath, "utf8");
  await writeFile(designPath, design
    .replace("Route / 路由：", "Route / 路由：/system/log")
    .replace("Data flow / 数据流：", "Data flow / 数据流：query -> request -> rows。")
    .replace("Request mapping / 请求映射：", "Request mapping / 请求映射：getLogList。")
    .replace("Permission integration / 权限接入：", "Permission integration / 权限接入：v-hasPermi。")
    .replace("Component choice / 组件选择：", "Component choice / 组件选择：HTWTable。")
    .replace("HTWTable evaluation / HTWTable 评估：", "HTWTable evaluation / HTWTable 评估：适配普通列表。")
    .replace("Vue constraints / Vue 约束：", "Vue constraints / Vue 约束：遵守目标项目 Vue3 API。"), "utf8");

  const screensPath = path.join(specRoot, "screens.yaml");
  const screens = await readFile(screensPath, "utf8");
  await writeFile(screensPath, screens
    .replace("  type: none", "  type: legacy-page")
    .replace("  reference: \"\"", "  reference: \"src/views/system/log/index.vue\"")
    .replace("  status: pending", "  status: fallback")
    .replace("  fallback: \"\"", "  fallback: \"same-project-list-page\"")
    .replace("    route: \"\"", "    route: \"/system/log\"")
    .replace("    title: \"\"", "    title: \"审计日志\""), "utf8");
}
