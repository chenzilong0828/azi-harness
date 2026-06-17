import {
  cp,
  mkdtemp,
  readFile,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import { prepareRuntimeSetup } from "./setup-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-setup-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("runtime setup", () => {
  it("uses init mode for a fresh project", async () => {
    const root = await copyFixture();

    const prepared = await prepareRuntimeSetup(root);

    expect(prepared.mode).toBe("init");
    expect(prepared.plan.entries.some((entry) => entry.intent.path === ".harness/manifest.json")).toBe(
      true
    );
  });

  it("uses sync mode after initialization", async () => {
    const root = await initializedFixture();

    const prepared = await prepareRuntimeSetup(root);

    expect(prepared.mode).toBe("sync");
    expect(prepared.plan.entries.every((entry) => entry.action === "skip")).toBe(true);
  });

  it("tracks new runtime files through setup sync mode", async () => {
    const root = await initializedFixture();
    const prepared = await prepareRuntimeSetup(root);

    const skillMapEntry = prepared.plan.entries.find(
      (entry) => entry.intent.path === ".harness/skill-map.json"
    );

    expect(skillMapEntry).toBeDefined();
    expect(await readFile(path.join(root, ".harness/skill-map.json"), "utf8")).toContain(
      "\"schemaVersion\": \"1\""
    );
  });
});

async function initializedFixture(): Promise<string> {
  const root = await copyFixture();
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-setup-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}
