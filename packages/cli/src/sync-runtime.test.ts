import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { applyRuntimeWritePlan, sha256 } from "@azi-harness/core";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import { prepareRuntimeSynchronization } from "./sync-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-sync-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime synchronization", () => {
  it("asks for initialization when no manifest exists", async () => {
    const root = await copyFixture();

    const prepared = await prepareRuntimeSynchronization(root);

    expect(prepared.status).toBe("not-initialized");
    expect(prepared.plan).toBeNull();
  });

  it("produces a no-op sync plan immediately after initialization", async () => {
    const root = await initializedFixture();

    const prepared = await prepareRuntimeSynchronization(root);

    expect(prepared.status).toBe("ready");
    expect(prepared.plan?.hasConflicts).toBe(false);
    expect(
      prepared.plan?.entries.filter((entry) => entry.action !== "skip")
    ).toEqual([]);
  });

  it("recreates a missing managed file during sync", async () => {
    const root = await initializedFixture();
    await unlink(path.join(root, ".harness/rules/quality.md"));

    const prepared = await prepareRuntimeSynchronization(root);
    const entry = prepared.plan?.entries.find(
      (candidate) => candidate.intent.path === ".harness/rules/quality.md"
    );

    expect(entry?.action).toBe("create");
    await applyRuntimeWritePlan(prepared.plan!);
    expect(await readFile(path.join(root, ".harness/rules/quality.md"), "utf8")).toContain(
      "# 质量规则"
    );
  });

  it("adds Skill Hub files when synchronizing an older runtime manifest", async () => {
    const root = await initializedFixture();
    const newFiles = [
      ".harness/skill-catalog.json",
      ".harness/docs/skill-hub.md"
    ];
    for (const relativePath of newFiles) {
      await unlink(path.join(root, relativePath));
    }
    const manifestPath = path.join(root, ".harness/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: Array<{ path: string }>;
    };
    manifest.files = manifest.files.filter((entry) => !newFiles.includes(entry.path));
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const prepared = await prepareRuntimeSynchronization(root);
    for (const relativePath of newFiles) {
      expect(
        prepared.plan?.entries.find((entry) => entry.intent.path === relativePath)?.action
      ).toBe("create");
    }

    await applyRuntimeWritePlan(prepared.plan!);
    expect(await readFile(path.join(root, ".harness/skill-catalog.json"), "utf8")).toContain(
      "not-verified-by-project-runtime"
    );
    expect(await readFile(path.join(root, ".harness/docs/skill-hub.md"), "utf8")).toContain(
      "# Skill Hub"
    );
  });

  it("stops when a managed file was edited after initialization", async () => {
    const root = await initializedFixture();
    await writeFile(path.join(root, ".harness/rules/ruoyi.md"), "user changed\n");

    const prepared = await prepareRuntimeSynchronization(root);
    const entry = prepared.plan?.entries.find(
      (candidate) => candidate.intent.path === ".harness/rules/ruoyi.md"
    );

    expect(entry?.action).toBe("conflict");
    expect(entry?.reason).toContain("changed after initialization");
  });

  it("leaves seeded files untouched during sync", async () => {
    const root = await initializedFixture();
    await writeFile(path.join(root, ".harness/config.json"), "{\"local\":true}\n");

    const prepared = await prepareRuntimeSynchronization(root);
    const entry = prepared.plan?.entries.find(
      (candidate) => candidate.intent.path === ".harness/config.json"
    );

    expect(entry?.action).toBe("skip");
    expect(entry?.reason).toContain("Seeded files");
  });

  it("applies supported config overrides to the refreshed runtime profile", async () => {
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

    const prepared = await prepareRuntimeSynchronization(root);
    await applyRuntimeWritePlan(prepared.plan!);

    const project = JSON.parse(
      await readFile(path.join(root, ".harness/project.json"), "utf8")
    ) as {
      effective: { htwTable: { documentationUrl: string } };
      overridesApplied: Array<{ path: string }>;
    };
    const htwRules = await readFile(path.join(root, ".harness/rules/htw-table.md"), "utf8");

    expect(project.effective.htwTable.documentationUrl).toBe("http://intranet.local/docs/htw-table");
    expect(project.overridesApplied).toContainEqual(
      expect.objectContaining({ path: "htwTable.documentationUrl" })
    );
    expect(htwRules).toContain("http://intranet.local/docs/htw-table");
  });

  it("removes retired managed skill files during sync", async () => {
    const root = await initializedFixture();
    const retiredPath = path.join(root, ".agents/skills/ruoyi-project/SKILL.md");
    await mkdir(path.dirname(retiredPath), { recursive: true });
    await writeFile(retiredPath, "old skill\n");

    const manifestPath = path.join(root, ".harness/manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: Array<{
        path: string;
        ownership: string;
        templateVersion: string | null;
        sha256: string;
      }>;
    };
    manifest.files.push({
      path: ".agents/skills/ruoyi-project/SKILL.md",
      ownership: "managed",
      templateVersion: "2",
      sha256: sha256("old skill\n")
    });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const prepared = await prepareRuntimeSynchronization(root);
    const entry = prepared.plan?.entries.find(
      (candidate) => candidate.intent.path === ".agents/skills/ruoyi-project/SKILL.md"
    );

    expect(entry?.action).toBe("delete");
    await applyRuntimeWritePlan(prepared.plan!);
    await expect(readFile(retiredPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function initializedFixture(): Promise<string> {
  const root = await copyFixture();
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-sync-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}
