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
