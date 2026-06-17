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
import { writeSuggestedRuntimeProposals } from "./proposal-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-proposals-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime proposals", () => {
  it("writes a reviewable patch for a changed managed adapter file", async () => {
    const root = await initializedFixture();
    const cursorRulePath = path.join(root, ".cursor/rules/azi-harness.mdc");
    await writeFile(cursorRulePath, "broken\n");

    const report = await writeSuggestedRuntimeProposals(root);

    expect(report.written).toEqual([".harness/proposals/runtime-sync.patch"]);
    expect(await readFile(cursorRulePath, "utf8")).toBe("broken\n");

    const patch = await readFile(
      path.join(root, ".harness/proposals/runtime-sync.patch"),
      "utf8"
    );
    expect(patch).toContain("--- a/.cursor/rules/azi-harness.mdc");
    expect(patch).toContain("+++ b/.cursor/rules/azi-harness.mdc");
    expect(patch).toContain("-broken");
    expect(patch).toContain("+1. 阅读 `AGENTS.md`。");
  });

  it("skips writing when the runtime is already in sync", async () => {
    const root = await initializedFixture();

    const report = await writeSuggestedRuntimeProposals(root);

    expect(report.written).toEqual([]);
    expect(report.skipped).toContain("No runtime patch suggestions were needed.");
  });
});

async function initializedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-proposals-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}
