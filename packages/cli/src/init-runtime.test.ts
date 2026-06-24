import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-init-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime initialization", () => {
  it("installs a complete RuoYi runtime and is safe to repeat", async () => {
    const root = await copyFixture();
    const prepared = await prepareRuntimeInitialization(root);

    expect(prepared.status).toBe("ready");
    expect(prepared.plan?.hasConflicts).toBe(false);
    const created = await applyPreparedInitialization(prepared);

    expect(created).toContain("AGENTS.md");
    expect(created).toContain(".harness/manifest.json");
    expect(created).toContain(".agents/skills/README.md");
    expect(created).toContain(".harness/docs/ai-tools.md");
    expect(created).toContain(".harness/skill-map.json");
    expect(created).toContain(".harness/skill-catalog.json");
    expect(created).toContain(".harness/docs/skill-sources.md");
    expect(created).toContain(".harness/docs/skill-hub.md");
    expect(created).toContain(".cursor/rules/azi-harness.mdc");
    expect(created).toContain(".harness/docs/gitlab-ci.example.yml");

    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(agents.split("\n").length).toBeLessThanOrEqual(60);
    const project = JSON.parse(
      await readFile(path.join(root, ".harness/project.json"), "utf8")
    ) as { detected: { projectType: { value: string } } };
    expect(project.detected.projectType.value).toBe("ruoyi-vue3-element-plus");

    const cursorRule = await readFile(path.join(root, ".cursor/rules/azi-harness.mdc"), "utf8");
    expect(cursorRule).toContain("AGENTS.md");
    expect(cursorRule).toContain(".harness/project.json");

    const gitlabCi = await readFile(path.join(root, ".harness/docs/gitlab-ci.example.yml"), "utf8");
    expect(gitlabCi).toContain("azi:review:");
    expect(gitlabCi).toContain("AZI_REVIEW_TARGET=specs/<id-feature>");

    const repeated = await prepareRuntimeInitialization(root);
    expect(repeated.status).toBe("already-initialized");
    expect(await applyPreparedInitialization(repeated)).toEqual([]);
  });

  it("keeps an existing AGENTS.md and generates an append-only proposal", async () => {
    const root = await copyFixture();
    const existingAgents = "# Existing instructions\n\nKeep this content.\n";
    await writeFile(path.join(root, "AGENTS.md"), existingAgents);

    const prepared = await prepareRuntimeInitialization(root);
    expect(prepared.plan?.entries.some((entry) => entry.intent.path === "AGENTS.md")).toBe(false);
    expect(
      prepared.plan?.entries.some(
        (entry) => entry.intent.path === ".harness/proposals/AGENTS.md.patch"
      )
    ).toBe(true);

    await applyPreparedInitialization(prepared);
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toBe(existingAgents);
    const proposal = await readFile(
      path.join(root, ".harness/proposals/AGENTS.md.patch"),
      "utf8"
    );
    expect(proposal).toContain("## azi-harness");
    expect(proposal).toContain("--- a/AGENTS.md");
  });

  it("stops before writing when an existing runtime file conflicts", async () => {
    const root = await copyFixture();
    await mkdir(path.join(root, ".harness"));
    await writeFile(path.join(root, ".harness/config.json"), "{\"custom\":true}\n");

    const prepared = await prepareRuntimeInitialization(root);

    expect(prepared.plan?.hasConflicts).toBe(true);
    await expect(applyPreparedInitialization(prepared)).rejects.toThrow("conflicts");
    await expect(stat(path.join(root, ".harness/manifest.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(await readFile(path.join(root, ".harness/config.json"), "utf8")).toBe(
      "{\"custom\":true}\n"
    );
  });
});

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-init-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}
