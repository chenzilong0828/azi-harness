import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readUtf8File, scanProjectFiles } from "./scanner.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-scanner-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("scanProjectFiles", () => {
  it("keeps large lockfile metadata without reading it as text", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "azi-harness-scanner-"));
    temporaryRoots.push(root);
    await writeFile(path.join(root, "package-lock.json"), Buffer.alloc(600 * 1024, "x"));
    await writeFile(path.join(root, ".windsurfrules"), "must never be read");

    const result = await scanProjectFiles(root);
    const lockfile = result.files.find((file) => file.relativePath === "package-lock.json");

    expect(lockfile).toBeDefined();
    expect(result.files.some((file) => file.relativePath === ".windsurfrules")).toBe(false);
    expect(await readUtf8File(lockfile!)).toBeNull();
  });
});

