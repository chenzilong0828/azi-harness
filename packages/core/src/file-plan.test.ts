import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyRuntimeWritePlan,
  createFullFilePatch,
  createRuntimeSyncPlan,
  createRuntimeWritePlan,
  sha256
} from "./file-plan.js";
import type { RuntimeFileIntent, RuntimeManifest } from "./types.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-plan-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime file plans", () => {
  it("creates files and skips identical content", async () => {
    const root = await createTemporaryRoot();
    const intents = [intent(".harness/project.json", "{}\n")];

    const firstPlan = await createRuntimeWritePlan(root, intents);
    expect(firstPlan.entries[0]?.action).toBe("create");
    await applyRuntimeWritePlan(firstPlan);
    expect(await readFile(path.join(root, ".harness/project.json"), "utf8")).toBe("{}\n");

    const secondPlan = await createRuntimeWritePlan(root, intents);
    expect(secondPlan.entries[0]?.action).toBe("skip");
  });

  it("reports conflicts without overwriting content", async () => {
    const root = await createTemporaryRoot();
    await writeFile(path.join(root, "AGENTS.md"), "user content\n");

    const plan = await createRuntimeWritePlan(root, [intent("AGENTS.md", "generated\n")]);

    expect(plan.hasConflicts).toBe(true);
    await expect(applyRuntimeWritePlan(plan)).rejects.toThrow("conflicts");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toBe("user content\n");
  });

  it("rejects paths outside the project root", async () => {
    const root = await createTemporaryRoot();

    await expect(
      createRuntimeWritePlan(root, [intent("../outside.txt", "no\n")])
    ).rejects.toThrow("escapes the project root");
  });

  it("rolls back files created before a later write failure", async () => {
    const root = await createTemporaryRoot();
    await mkdir(path.join(root, ".harness"));
    await writeFile(path.join(root, ".harness/block"), "not a directory");
    const plan = await createRuntimeWritePlan(root, [
      intent(".harness/created-first.txt", "first\n"),
      intent(".harness/block/created-second.txt", "second\n")
    ]);

    await expect(applyRuntimeWritePlan(plan)).rejects.toThrow("Expected directory");
    await expect(stat(path.join(root, ".harness/created-first.txt"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("updates managed files safely during sync", async () => {
    const root = await createTemporaryRoot();
    const initialIntents = [intent(".harness/rules/quality.md", "v1\n")];
    const initialPlan = await createRuntimeWritePlan(root, initialIntents);
    await applyRuntimeWritePlan(initialPlan);

    const manifest: RuntimeManifest = {
      schemaVersion: "1",
      runtimeVersion: "0.1.0",
      generatedAt: new Date().toISOString(),
      files: [
        {
          path: ".harness/rules/quality.md",
          ownership: "managed",
          templateVersion: "1",
          sha256: sha256("v1\n")
        }
      ],
      detectionDigest: "digest"
    };

    const syncPlan = await createRuntimeSyncPlan(root, [
      intent(".harness/rules/quality.md", "v2\n")
    ], manifest);

    expect(syncPlan.entries[0]?.action).toBe("update");
    await applyRuntimeWritePlan(syncPlan);
    expect(await readFile(path.join(root, ".harness/rules/quality.md"), "utf8")).toBe("v2\n");
  });

  it("never overwrites seeded files during sync", async () => {
    const root = await createTemporaryRoot();
    await mkdir(path.join(root, ".harness"));
    await writeFile(path.join(root, ".harness/config.json"), "{\"custom\":true}\n");
    const manifest: RuntimeManifest = {
      schemaVersion: "1",
      runtimeVersion: "0.1.0",
      generatedAt: new Date().toISOString(),
      files: [
        {
          path: ".harness/config.json",
          ownership: "seeded",
          templateVersion: "1",
          sha256: sha256("{\"custom\":true}\n")
        }
      ],
      detectionDigest: "digest"
    };

    const syncPlan = await createRuntimeSyncPlan(root, [
      {
        path: ".harness/config.json",
        content: "{\n  \"schemaVersion\": \"1\"\n}\n",
        ownership: "seeded",
        templateVersion: "2"
      }
    ], manifest);

    expect(syncPlan.entries[0]?.action).toBe("skip");
    expect(syncPlan.entries[0]?.reason).toContain("Seeded files");
  });

  it("deletes retired managed files that still match the manifest", async () => {
    const root = await createTemporaryRoot();
    await mkdir(path.join(root, ".agents", "skills", "ruoyi-project"), { recursive: true });
    await writeFile(
      path.join(root, ".agents/skills/ruoyi-project/SKILL.md"),
      "old skill\n"
    );

    const manifest: RuntimeManifest = {
      schemaVersion: "1",
      runtimeVersion: "0.1.0",
      generatedAt: new Date().toISOString(),
      files: [
        {
          path: ".agents/skills/ruoyi-project/SKILL.md",
          ownership: "managed",
          templateVersion: "1",
          sha256: sha256("old skill\n")
        }
      ],
      detectionDigest: "digest"
    };

    const syncPlan = await createRuntimeSyncPlan(root, [], manifest);

    expect(syncPlan.entries[0]?.action).toBe("delete");
    await applyRuntimeWritePlan(syncPlan);
    await expect(stat(path.join(root, ".agents/skills/ruoyi-project/SKILL.md"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("creates full-file patches for reviewable proposals", () => {
    const patch = createFullFilePatch(
      ".cursor/rules/azi-harness.mdc",
      "old\n",
      "new\nnext\n"
    );

    expect(patch).toContain("--- a/.cursor/rules/azi-harness.mdc");
    expect(patch).toContain("+++ b/.cursor/rules/azi-harness.mdc");
    expect(patch).toContain("-old");
    expect(patch).toContain("+new");
    expect(patch).toContain("+next");
  });
});

function intent(filePath: string, content: string): RuntimeFileIntent {
  return {
    path: filePath,
    content,
    ownership: "managed",
    templateVersion: "test"
  };
}

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-plan-"));
  temporaryRoots.push(root);
  return root;
}
