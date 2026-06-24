import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  advanceWorkflow,
  applyPreparedWorkflowStart,
  getWorkflowLog,
  getWorkflowStatus,
  prepareWorkflowStart
} from "./workflow-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-workflow-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("workflow runtime", () => {
  it("starts a feature workflow and reuses an existing spec", async () => {
    const root = await initializedFixture();

    const prepared = await prepareWorkflowStart({
      root,
      featureName: "用户管理列表改造",
      slug: "user-management-list",
      task: "根据 Figma 节点完成用户管理列表改造",
      includeAvoided: false
    });

    expect(prepared.spec.status).toBe("planned");
    expect(prepared.spec.relativePath).toBe("specs/001-user-management-list");
    expect(prepared.context.skillMatch.matches[0]?.sourceId).toBe("figma-family");
    expect(prepared.nextSteps.some((step) => step.includes("azi review"))).toBe(true);

    const written = await applyPreparedWorkflowStart(prepared);
    expect(written).toContain("specs/001-user-management-list/requirements.md");
    expect(written).toContain(".harness/workflows/001-user-management-list.json");
    expect(written).toContain("specs/001-user-management-list/workflow.md");
    expect(written).toContain("specs/001-user-management-list/evidence/.gitkeep");

    const requirements = await readFile(
      path.join(root, "specs/001-user-management-list/requirements.md"),
      "utf8"
    );
    expect(requirements).toContain("# 需求：001-user-management-list");
    const workflowState = JSON.parse(await readFile(
      path.join(root, ".harness/workflows/001-user-management-list.json"),
      "utf8"
    )) as { currentStage: string; specPath: string; logs: unknown[] };
    expect(workflowState.currentStage).toBe("clarify");
    expect(workflowState.specPath).toBe("specs/001-user-management-list");
    expect(workflowState.logs).toHaveLength(1);

    const repeated = await prepareWorkflowStart({
      root,
      featureName: "user-management-list",
      slug: null,
      task: "继续用户管理列表改造",
      includeAvoided: false
    });
    expect(repeated.spec.status).toBe("existing");
    expect(await applyPreparedWorkflowStart(repeated)).toEqual([]);
  });

  it("reports, advances, and logs workflow state", async () => {
    const root = await initializedFixture();
    const prepared = await prepareWorkflowStart({
      root,
      featureName: "audit-log",
      slug: null,
      task: "审计日志列表改造",
      includeAvoided: false
    });
    await applyPreparedWorkflowStart(prepared);

    const status = await getWorkflowStatus(root);
    expect(status.workflows).toHaveLength(1);
    expect(status.workflows[0]?.currentStage).toBe("clarify");

    const advanced = await advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "plan",
      force: false,
      reason: null
    });
    expect(advanced.workflow.currentStage).toBe("plan");
    expect(advanced.changed).toContain(".harness/workflows/001-audit-log.json");

    const workflowMarkdown = await readFile(
      path.join(root, "specs/001-audit-log/workflow.md"),
      "utf8"
    );
    expect(workflowMarkdown).toContain("当前阶段：`plan`");
    expect(workflowMarkdown).toContain("<!-- azi-harness:workflow:start -->");

    const log = await getWorkflowLog(root, "specs/001-audit-log");
    expect(log.workflow.logs.map((entry) => entry.to)).toEqual(["clarify", "plan"]);
  });

  it("preserves manual workflow notes outside the generated block", async () => {
    const root = await initializedFixture();
    const prepared = await prepareWorkflowStart({
      root,
      featureName: "audit-log",
      slug: null,
      task: "审计日志列表改造",
      includeAvoided: false
    });
    await applyPreparedWorkflowStart(prepared);

    const workflowPath = path.join(root, "specs/001-audit-log/workflow.md");
    const before = await readFile(workflowPath, "utf8");
    await writeFile(workflowPath, `${before}\n人工备注：保留这条人工确认。\n`);

    await advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "plan",
      force: false,
      reason: null
    });

    const after = await readFile(workflowPath, "utf8");
    expect(after).toContain("当前阶段：`plan`");
    expect(after).toContain("人工备注：保留这条人工确认。");
  });

  it("blocks entering coding when the spec is still an untouched draft", async () => {
    const root = await initializedFixture();
    const prepared = await prepareWorkflowStart({
      root,
      featureName: "audit-log",
      slug: null,
      task: "审计日志列表改造",
      includeAvoided: false
    });
    await applyPreparedWorkflowStart(prepared);

    for (const stage of ["plan", "prd", "issues"] as const) {
      await advanceWorkflow({
        root,
        target: "specs/001-audit-log",
        to: stage,
        force: false,
        reason: null
      });
    }

    await expect(advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "coding",
      force: false,
      reason: null
    })).rejects.toThrow("spec is not ready");
  });

  it("blocks skipped stages unless force and reason are provided", async () => {
    const root = await initializedFixture();
    const prepared = await prepareWorkflowStart({
      root,
      featureName: "audit-log",
      slug: null,
      task: "审计日志列表改造",
      includeAvoided: false
    });
    await applyPreparedWorkflowStart(prepared);

    await expect(advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "coding",
      force: false,
      reason: null
    })).rejects.toThrow("cannot skip stages");

    await expect(advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "coding",
      force: true,
      reason: null
    })).rejects.toThrow("--force requires --reason");

    const advanced = await advanceWorkflow({
      root,
      target: "specs/001-audit-log",
      to: "coding",
      force: true,
      reason: "人工确认需求、计划、PRD 和切片已经在会外完成"
    });
    expect(advanced.workflow.currentStage).toBe("coding");
    expect(advanced.workflow.logs.at(-1)?.forced).toBe(true);
  });

  it("requires a slug for Chinese-only feature names", async () => {
    const root = await initializedFixture();

    await expect(prepareWorkflowStart({
      root,
      featureName: "用户管理",
      slug: null,
      task: "用户管理",
      includeAvoided: false
    })).rejects.toThrow("For Chinese task names, pass `--slug <feature-slug>`.");
  });
});

async function initializedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-workflow-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}
