import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyRuntimeWritePlan, createRuntimeWritePlan } from "@azi-harness/core";

import {
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
    expect(requirements).toContain("## 验收条件");
    expect(tasks).toContain("## 任务列表");
    expect(tasks).toContain("Verify / 验证：azi spec validate");
    expect(acceptance).toContain("## 检查结果");
    expect(acceptance).toContain("- lint：");
  });
});

describe("spec validation", () => {
  it("accepts a generated spec", async () => {
    const root = await createTemporaryRoot();
    const prepared = await prepareSpecCreation(root, "audit-log");
    await applyRuntimeWritePlan(await createRuntimeWritePlan(root, prepared.intents));

    const reports = await validateSpecs(root);
    const summary = summarizeSpecValidation(reports);

    expect(summary.valid).toBe(true);
    expect(summary.errors).toBe(0);
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
        "    route: \"\"",
        "    title: \"\"",
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
    await writeFile(
      path.join(root, "specs", prepared.directoryName, "requirements.md"),
      "# 需求：audit-log\n\n## 范围\n\n- In scope / 本次包含：列表页\n"
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
});

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-specs-"));
  temporaryRoots.push(root);
  return root;
}
