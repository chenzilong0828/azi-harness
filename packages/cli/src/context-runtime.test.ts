import {
  cp,
  mkdtemp,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import { createContextDocument } from "./context-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-context-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("context runtime", () => {
  it("builds an AI startup context from the installed runtime", async () => {
    const root = await initializedFixture();

    const context = await createContextDocument({
      root,
      task: "根据 Figma 节点还原页面，并完成视觉验收"
    });

    expect(context.root).toBe(root);
    expect(context.project.projectType).toBe("ruoyi-vue3-element-plus");
    expect(context.project.packageManager).toBe("npm");
    expect(context.skillMatch.matches[0]?.sourceId).toBe("figma-family");
    expect(context.readFirst).toContain(".harness/project.json");
    expect(context.readFirst).toContain("specs/README.md");
    expect(context.readFirst).toContain(".harness/rules/ruoyi.md");
    expect(context.commands.check).toBe("npx azi check");
    expect(context.commands.lint).toBe("npm run lint");
    expect(context.doctor.errors).toEqual([]);
  });
});

async function initializedFixture(): Promise<string> {
  const root = await copyFixture();
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-context-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}
