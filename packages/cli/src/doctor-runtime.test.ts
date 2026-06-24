import {
  cp,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import { runRuntimeDoctor } from "./doctor-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-doctor-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime doctor", () => {
  it("reports a healthy initialized runtime", async () => {
    const root = await initializedFixture();

    const report = await runRuntimeDoctor(root);

    expect(report.initialized).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("reports missing runtime files as errors", async () => {
    const root = await initializedFixture();
    await unlink(path.join(root, ".harness/rules/quality.md"));

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain("Tracked runtime file is missing: .harness/rules/quality.md");
  });

  it("reports managed runtime file drift as an error", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/rules/quality.md"),
      "# 人工改坏 managed 文件\n"
    );

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain(
      "Managed runtime file changed after initialization: .harness/rules/quality.md. Run `npx azi sync` and review conflicts."
    );
  });

  it("warns when project evidence changed after initialization", async () => {
    const root = await initializedFixture();
    const packageJsonPath = path.join(root, "package.json");
    const packageJson = await readFile(packageJsonPath, "utf8");
    await writeFile(
      packageJsonPath,
      packageJson.replace(
        "\"element-plus\": \"^2.9.0\",",
        "\"element-plus\": \"^2.9.0\",\n    \"@dcloudio/uni-app\": \"^3.0.0\","
      )
    );

    const report = await runRuntimeDoctor(root);

    expect(report.warnings).toContain(
      "Project detection evidence changed. Run `npx azi sync` to refresh the runtime."
    );
  });

  it("warns when configured commands no longer exist", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/config.json"),
      JSON.stringify({
        schemaVersion: "1",
        checks: {
          runProjectCommands: true,
          commands: {
            lint: { enabled: true, reason: null },
            test: { enabled: true, reason: null },
            build: { enabled: true, reason: null }
          }
        },
        commands: { lint: "missing-lint", test: "test", build: "build" },
        overrides: []
      }, null, 2)
    );

    const report = await runRuntimeDoctor(root);

    expect(report.warnings).toContain(
      "Configured lint command `missing-lint` does not exist in package.json scripts."
    );
  });

  it("warns when a disabled command has no reason", async () => {
    const root = await initializedFixture();
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

    const report = await runRuntimeDoctor(root);

    expect(report.warnings).toContain(
      "Disabled lint command is missing a reason in `.harness/config.json`."
    );
  });

  it("reports invalid override paths as errors", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/config.json"),
      JSON.stringify({
        schemaVersion: "1",
        checks: {
          runProjectCommands: true,
          commands: {
            lint: { enabled: true, reason: null },
            test: { enabled: true, reason: null },
            build: { enabled: true, reason: null }
          }
        },
        commands: { lint: "lint", test: "test", build: "build" },
        overrides: [
          {
            path: "framework.vueMajor",
            value: 2,
            reason: "Force legacy handling",
            owner: null
          }
        ]
      }, null, 2)
    );

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain(
      "Override `framework.vueMajor` is not allowed: framework facts come from installed project dependencies and cannot be overridden."
    );
  });

  it("warns when config overrides change the effective runtime profile", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/config.json"),
      JSON.stringify({
        schemaVersion: "1",
        checks: {
          runProjectCommands: true,
          commands: {
            lint: { enabled: true, reason: null },
            test: { enabled: true, reason: null },
            build: { enabled: true, reason: null }
          }
        },
        commands: { lint: "lint", test: "test", build: "build" },
        overrides: [
          {
            path: "htwTable.documentationUrl",
            value: "http://intranet.local/docs/htw-table",
            reason: "Use the internal docs mirror",
            owner: "tester"
          }
        ]
      }, null, 2)
    );

    const report = await runRuntimeDoctor(root);

    expect(report.warnings).toContain(
      "Effective project profile changed. Run `npx azi sync` to refresh `.harness/project.json` and runtime docs."
    );
  });

  it("reports broken Cursor adapter entries", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".cursor/rules/azi-harness.mdc"),
      "---\ndescription: broken\nalwaysApply: true\n---\n\nNo runtime reference.\n"
    );

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain(
      "`.cursor/rules/azi-harness.mdc` must point Cursor back to `AGENTS.md`."
    );
    expect(report.errors).toContain(
      "`.cursor/rules/azi-harness.mdc` must point Cursor back to `.harness/project.json`."
    );
  });

  it("reports invalid skill-map content", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/skill-map.json"),
      JSON.stringify({
        schemaVersion: "2",
        sources: [
          { id: "dup", matchWhenAny: ["Figma"] },
          { id: "dup", matchWhenAny: [] }
        ]
      }, null, 2)
    );

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain(
      "Skill map: `.harness/skill-map.json` must declare `schemaVersion: \"1\"`."
    );
    expect(report.errors).toContain("Skill map: Duplicate skill source id: dup");
    expect(report.errors).toContain("`.harness/skill-map.json` failed validation.");
    expect(report.warnings).toContain("Skill map: Skill source dup has an empty matchWhenAny list.");
  });

  it("reports invalid skill-catalog content", async () => {
    const root = await initializedFixture();
    await writeFile(
      path.join(root, ".harness/skill-catalog.json"),
      "{}\n"
    );

    const report = await runRuntimeDoctor(root);

    expect(report.errors).toContain(
      "Skill catalog: `.harness/skill-catalog.json` must declare `schemaVersion: \"1\"`."
    );
    expect(report.errors).toContain("`.harness/skill-catalog.json` failed validation.");
  });
});

async function initializedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-doctor-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}
