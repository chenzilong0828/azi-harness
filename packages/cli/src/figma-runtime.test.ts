import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedFigmaWrite,
  downloadFigmaSvgAssets,
  getFigmaCacheStatus,
  deriveFigmaFeature,
  parseFigmaNodeUrl,
  prepareFigmaFallback,
  prepareFigmaSpec
} from "./figma-runtime.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-figma-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("figma runtime", () => {
  it("requires node-specific Figma URLs", () => {
    expect(parseFigmaNodeUrl("https://www.figma.com/design/abc/Test?node-id=12-34")).toEqual({
      url: "https://www.figma.com/design/abc/Test?node-id=12-34",
      fileKey: "abc",
      nodeId: "12:34"
    });
    expect(() => parseFigmaNodeUrl("https://www.figma.com/design/abc/Test")).toThrow(
      "node-id"
    );
  });

  it("derives a feature slug from a Figma URL", () => {
    expect(deriveFigmaFeature("https://www.figma.com/design/abc/User-Management?node-id=12-34")).toEqual({
      featureName: "User-Management",
      slug: "user-management"
    });
    expect(deriveFigmaFeature("https://www.figma.com/design/abc/%E7%94%A8%E6%88%B7?node-id=12-34")).toEqual({
      featureName: "用户",
      slug: "figma-node-12-34"
    });
  });

  it("writes a Figma source cache and reviewable spec proposal", async () => {
    const root = await createSpecRoot();
    const prepared = await prepareFigmaSpec({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T01:02:03.004Z"
    });

    expect(prepared.plan.hasConflicts).toBe(false);
    const written = await applyPreparedFigmaWrite(prepared);
    expect(written).toEqual([
      ".harness/figma-cache/001-user-management/identity.json",
      ".harness/figma-cache/001-user-management/source.json",
      ".harness/figma-cache/001-user-management/nodes.json",
      ".harness/figma-cache/001-user-management/notes.md",
      ".harness/proposals/001-user-management-figma-source.patch",
      ".harness/figma-cache/index.json"
    ]);
    expect(prepared.cacheReuse.status).toBe("miss");

    const source = JSON.parse(
      await readFile(path.join(root, ".harness/figma-cache/001-user-management/source.json"), "utf8")
    ) as { source: { type: string; nodeId: string; status: string } };
    expect(source.source).toMatchObject({
      type: "figma-mcp",
      nodeId: "1:2",
      status: "ok"
    });

    const index = JSON.parse(
      await readFile(path.join(root, ".harness/figma-cache/index.json"), "utf8")
    ) as { entries: Array<{ cacheKey: string; sourcePath: string }> };
    expect(index.entries).toMatchObject([
      {
        cacheKey: "fileKey:1:2",
        sourcePath: ".harness/figma-cache/001-user-management/source.json"
      }
    ]);

    const proposal = await readFile(
      path.join(root, ".harness/proposals/001-user-management-figma-source.patch"),
      "utf8"
    );
    expect(proposal).toContain("+++ b/specs/001-user-management/screens.yaml");
    expect(proposal).toContain("nodeId: 1:2");
    expect(proposal).toContain("Figma 来源记录");
    expect(proposal).toContain("不能由 Figma 推断");

    const status = await getFigmaCacheStatus(root, "specs/001-user-management");
    expect(status.exists).toBe(true);
    expect(status.warnings).toEqual([]);
  });

  it("reuses a matching Figma node cache by file key and node id", async () => {
    const root = await createSpecRoot();
    const first = await prepareFigmaSpec({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T01:02:03.004Z"
    });
    await applyPreparedFigmaWrite(first);
    await mkdir(path.join(root, "specs/002-user-management-copy"), { recursive: true });
    await writeFile(path.join(root, "specs/002-user-management-copy/screens.yaml"), "version: 1\n", "utf8");
    await writeFile(path.join(root, "specs/002-user-management-copy/design.md"), "# Design\n", "utf8");

    const second = await prepareFigmaSpec({
      root,
      target: "specs/002-user-management-copy",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T02:02:03.004Z"
    });

    expect(second.cacheReuse.status).toBe("hit");
    expect(second.cacheReuse.matchedCachePath).toBe(".harness/figma-cache/001-user-management");
  });

  it("indexes every local cache path for the same Figma identity", async () => {
    const root = await createSpecRoot();
    const first = await prepareFigmaSpec({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T01:02:03.004Z"
    });
    await applyPreparedFigmaWrite(first);
    await mkdir(path.join(root, "specs/002-user-management-copy"), { recursive: true });
    await writeFile(path.join(root, "specs/002-user-management-copy/screens.yaml"), "version: 1\n", "utf8");
    await writeFile(path.join(root, "specs/002-user-management-copy/design.md"), "# Design\n", "utf8");

    const second = await prepareFigmaSpec({
      root,
      target: "specs/002-user-management-copy",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T02:02:03.004Z"
    });
    await applyPreparedFigmaWrite(second);

    const index = JSON.parse(
      await readFile(path.join(root, ".harness/figma-cache/index.json"), "utf8")
    ) as { entries: Array<{ cacheKey: string; sourcePath: string }> };
    expect(index.entries.map((entry) => entry.cacheKey)).toEqual(["fileKey:1:2", "fileKey:1:2"]);
    expect(index.entries.map((entry) => entry.sourcePath)).toEqual([
      ".harness/figma-cache/001-user-management/source.json",
      ".harness/figma-cache/002-user-management-copy/source.json"
    ]);
  });

  it("reuses the current target Figma cache without write conflicts", async () => {
    const root = await createSpecRoot();
    const first = await prepareFigmaSpec({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T01:02:03.004Z"
    });
    await applyPreparedFigmaWrite(first);

    const second = await prepareFigmaSpec({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      generatedAt: "2026-06-23T02:02:03.004Z"
    });

    expect(second.cacheReuse.status).toBe("hit");
    expect(second.cacheReuse.matchedCachePath).toBe(".harness/figma-cache/001-user-management");
    expect(second.plan.hasConflicts).toBe(false);
  });

  it("records fallback source and retry checkpoint without Figma metadata", async () => {
    const root = await createSpecRoot();
    const prepared = await prepareFigmaFallback({
      root,
      target: "specs/001-user-management",
      source: "screenshot",
      reference: "specs/001-user-management/evidence/list.png",
      retriedAt: "2026-06-24T01:02:03.004Z",
      notes: "Figma MCP 429，使用截图继续规格化。",
      generatedAt: "2026-06-23T01:02:03.004Z"
    });

    await applyPreparedFigmaWrite(prepared);
    const status = await getFigmaCacheStatus(root, "specs/001-user-management");

    expect(status.source?.source).toMatchObject({
      type: "screenshot",
      status: "fallback",
      reference: "specs/001-user-management/evidence/list.png",
      retriedAt: "2026-06-24T01:02:03.004Z"
    });
    expect(status.nodes?.nodes).toEqual([]);
    expect(status.warnings).toEqual([]);
  });

  it("skips SVG asset download without FIGMA_TOKEN and records cache manifest", async () => {
    const root = await createSpecRoot();
    const report = await downloadFigmaSvgAssets({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      token: undefined,
      generatedAt: "2026-06-23T01:02:03.004Z"
    });

    expect(report.status).toBe("skipped");
    expect(report.cacheReuse.status).toBe("miss");
    expect(report.skipped[0]).toContain("FIGMA_TOKEN");
    const manifest = await readFile(path.join(root, ".harness/figma-cache/001-user-management/assets.json"), "utf8");
    expect(manifest).toContain("\"status\": \"skipped\"");
  });

  it("reuses skipped SVG asset manifest without reporting a cache miss", async () => {
    const root = await createSpecRoot();
    await downloadFigmaSvgAssets({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      token: undefined,
      generatedAt: "2026-06-23T01:02:03.004Z"
    });

    const second = await downloadFigmaSvgAssets({
      root,
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      token: undefined,
      generatedAt: "2026-06-23T02:02:03.004Z"
    });

    expect(second.status).toBe("skipped");
    expect(second.cacheReuse.status).toBe("hit");
    expect(second.cacheReuse.message).toContain("skip cache hit");
  });
});

async function createSpecRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-figma-"));
  temporaryRoots.push(root);
  const specRoot = path.join(root, "specs/001-user-management");
  await mkdir(specRoot, { recursive: true });
  await writeFile(path.join(specRoot, "screens.yaml"), [
    "version: 1",
    "feature: user-management",
    "source:",
    "  type: none",
    "  url: \"\"",
    "  nodeId: \"\"",
    "  reference: \"\"",
    "  status: pending",
    "  retriedAt: \"\"",
    "  fallback: \"\"",
    "  notes: \"\"",
    "screens:",
    "  - id: list",
    "    route: \"\"",
    "    title: \"\"",
    "    states:",
    "      - default",
    "    regions: []",
    "    interactions: []",
    "    assets: []",
    "unknowns: []",
    ""
  ].join("\n"), "utf8");
  await writeFile(path.join(specRoot, "design.md"), [
    "# 设计：001-user-management",
    "",
    "## 页面和模块边界",
    "",
    "- Route / 路由："
  ].join("\n"), "utf8");
  return root;
}
