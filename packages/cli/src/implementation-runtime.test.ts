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
import {
  createImplementationContext,
  createImplementationPatchCandidate
} from "./implementation-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-implementation-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("implementation runtime", () => {
  it("finds similar RuoYi pages and writes Codex context", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "azi-harness-implementation-"));
    temporaryRoots.push(root);
    await cp(fixtureRoot, root, { recursive: true });
    await applyPreparedInitialization(await prepareRuntimeInitialization(root));

    const report = await createImplementationContext({
      root,
      specPath: "specs/001-user-management",
      featureName: "User Management",
      slug: "user-management",
      figma: null,
      assets: null,
      write: true
    });

    expect(report.similarPages[0]?.path).toBe("src/views/system/role/index.vue");
    expect(report.suggestedTarget).toBe("src/views/system/user-management/index.vue");
    expect(report.written).toBe(".harness/implementation/001-user-management/codex-context.md");
    const context = await readFile(path.join(root, report.written), "utf8");
    expect(context).toContain("Codex 实现上下文");
    expect(context).toContain("Figma 缓存状态：未生成");
    expect(context).toContain("src/views/system/role/index.vue");
    expect(context).toContain("不从 Figma 推断");
  });

  it("writes a reviewable implementation patch when the target page is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "azi-harness-implementation-"));
    temporaryRoots.push(root);
    await cp(fixtureRoot, root, { recursive: true });
    await applyPreparedInitialization(await prepareRuntimeInitialization(root));

    const context = await createImplementationContext({
      root,
      specPath: "specs/001-user-management",
      featureName: "User Management",
      slug: "user-management",
      figma: null,
      assets: null,
      write: true
    });
    const patch = await createImplementationPatchCandidate({
      root,
      specPath: "specs/001-user-management",
      featureName: "User Management",
      slug: "user-management",
      context,
      write: true
    });

    expect(patch.status).toBe("written");
    expect(patch.targetPath).toBe("src/views/system/user-management/index.vue");
    expect(patch.written).toBe(".harness/proposals/001-user-management-implementation.patch");
    const proposal = await readFile(path.join(root, patch.written), "utf8");
    expect(proposal).toContain("+++ b/src/views/system/user-management/index.vue");
    expect(proposal).toContain("Generated from similar page pattern: src/views/system/role/index.vue");
    expect(proposal).toContain("<HtwTable>");
  });

  it("applies a missing target page only when requested", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "azi-harness-implementation-"));
    temporaryRoots.push(root);
    await cp(fixtureRoot, root, { recursive: true });
    await applyPreparedInitialization(await prepareRuntimeInitialization(root));

    const context = await createImplementationContext({
      root,
      specPath: "specs/001-user-management",
      featureName: "User Management",
      slug: "user-management",
      figma: null,
      assets: null,
      write: true
    });
    const patch = await createImplementationPatchCandidate({
      root,
      specPath: "specs/001-user-management",
      featureName: "User Management",
      slug: "user-management",
      context,
      write: true,
      apply: true
    });

    expect(patch.status).toBe("applied");
    expect(patch.applied).toBe("src/views/system/user-management/index.vue");
    const page = await readFile(path.join(root, patch.applied), "utf8");
    expect(page).toContain("Generated from similar page pattern: src/views/system/role/index.vue");
    expect(page).toContain("请先确认接口、权限和字段事实。");
  });
});
