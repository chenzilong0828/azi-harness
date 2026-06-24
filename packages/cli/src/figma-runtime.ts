import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  applyRuntimeWritePlan,
  createAppendOnlyPatch,
  createFullFilePatch,
  createRuntimeWritePlan,
  pathExists,
  resolveInsideRoot,
  type RuntimeFileIntent,
  type RuntimeWritePlan
} from "@azi-harness/core";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type FigmaFallbackSource = "figma-export" | "screenshot" | "legacy-page";

export interface ParsedFigmaNodeUrl {
  url: string;
  fileKey: string;
  nodeId: string;
}

export interface FigmaSourceRecord {
  schemaVersion: "1";
  target: string;
  generatedAt: string;
  source: {
    type: "figma-mcp" | FigmaFallbackSource;
    status: "ok" | "fallback";
    url: string;
    fileKey: string;
    nodeId: string;
    reference: string;
    retriedAt: string;
    fallback: string;
    notes: string;
  };
  guardrails: string[];
}

export interface FigmaNodeCache {
  schemaVersion: "1";
  target: string;
  nodes: Array<{
    fileKey: string;
    nodeId: string;
    url: string;
    status: "metadata-only";
  }>;
  notes: string[];
}

export interface FigmaCacheReuseReport {
  status: "hit" | "miss" | "fallback";
  cacheKey: string;
  matchedCachePath: string | null;
  message: string;
  warnings: string[];
}

export interface FigmaIdentityRecord {
  schemaVersion: "1";
  cacheKey: string;
  fileKey: string;
  nodeId: string;
  url: string;
  target: string;
  sourcePath: string;
  assetsPath: string;
}

export interface PreparedFigmaWrite {
  root: string;
  specPath: string;
  cachePath: string;
  source: FigmaSourceRecord;
  nodes: FigmaNodeCache;
  cacheReuse: FigmaCacheReuseReport;
  notes: string;
  proposalPath: string;
  plan: RuntimeWritePlan;
  warnings: string[];
  nextActions: string[];
}

export interface FigmaCacheStatus {
  root: string;
  specPath: string;
  cachePath: string;
  exists: boolean;
  files: string[];
  source: FigmaSourceRecord | null;
  nodes: FigmaNodeCache | null;
  notes: string | null;
  warnings: string[];
  nextActions: string[];
}

export interface FigmaAssetManifest {
  schemaVersion: "1";
  target: string;
  generatedAt: string;
  status: "cached" | "skipped" | "rate-limited" | "failed";
  source: {
    fileKey: string;
    nodeId: string;
    url: string;
  };
  icons: Array<{
    nodeId: string;
    name: string;
    file: string;
  }>;
  skipped: string[];
  warnings: string[];
  retriedAt: string;
}

export interface FigmaAssetDownloadReport {
  root: string;
  specPath: string;
  cachePath: string;
  manifestPath: string;
  status: FigmaAssetManifest["status"];
  icons: FigmaAssetManifest["icons"];
  skipped: string[];
  warnings: string[];
  retriedAt: string;
  cacheReuse: FigmaCacheReuseReport;
}

const GUARDRAILS = [
  "Figma 只提供视觉、布局、文案和交互线索。",
  "不能从 Figma 推断接口、权限标识、字典类型或后端字段。",
  "遇到 Figma MCP 429 时停止连续重试，改用 fallback 并记录来源。"
];

export function parseFigmaNodeUrl(input: string): ParsedFigmaNodeUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Figma URL is invalid.");
  }

  if (!url.hostname.endsWith("figma.com")) {
    throw new Error("Figma URL must use figma.com.");
  }

  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  const fileKeyIndex = segments.findIndex((segment) => segment === "design" || segment === "file");
  const fileKey = fileKeyIndex === -1 ? undefined : segments[fileKeyIndex + 1];
  const branchIndex = segments.findIndex((segment) => segment === "branch");
  const effectiveFileKey = branchIndex === -1 ? fileKey : segments[branchIndex + 1] ?? fileKey;
  if (effectiveFileKey === undefined || effectiveFileKey.trim() === "") {
    throw new Error("Figma URL must include a file key.");
  }

  const rawNodeId = url.searchParams.get("node-id");
  if (rawNodeId === null || rawNodeId.trim() === "") {
    throw new Error("Figma URL must include a node-id query parameter.");
  }
  const nodeId = rawNodeId.replace(/-/g, ":");
  if (!/^\d+:\d+$/u.test(nodeId)) {
    throw new Error("Figma node-id must look like 1-2 or 1:2.");
  }

  return {
    url: input,
    fileKey: effectiveFileKey,
    nodeId
  };
}

export function deriveFigmaFeature(input: string): { featureName: string; slug: string } {
  const parsed = parseFigmaNodeUrl(input);
  const url = new URL(input);
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  const branchIndex = segments.findIndex((segment) => segment === "branch");
  const fileNameIndex = branchIndex === -1
    ? segments.findIndex((segment) => segment === "design" || segment === "file") + 2
    : branchIndex + 2;
  const rawName = segments[fileNameIndex] ?? "";
  const decodedName = decodeURIComponent(rawName).trim();
  const fallback = `figma-node-${parsed.nodeId.replace(/:/g, "-")}`;
  const slug = slugify(decodedName) ?? fallback;
  return {
    featureName: decodedName === "" ? fallback : decodedName,
    slug
  };
}

export async function prepareFigmaSpec(
  options: {
    root: string;
    target: string;
    url: string;
    generatedAt?: string;
  }
): Promise<PreparedFigmaWrite> {
  const root = path.resolve(options.root);
  const target = await normalizeSpecTarget(root, options.target);
  const parsed = parseFigmaNodeUrl(options.url);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const reusable = await findReusableFigmaCache(root, parsed);
  const cachePath = figmaCachePath(target.specPath);
  const cacheReuse = reusable === null
    ? createCacheReuse("miss", parsed, null, "Figma cache miss; local node cache will be created before any asset request.", [])
    : createCacheReuse(
      reusable.source.source.status === "fallback" ? "fallback" : "hit",
      parsed,
      reusable.cachePath,
      `Figma cache ${reusable.source.source.status === "fallback" ? "fallback" : "hit"}: ${reusable.cachePath}`,
      reusable.source.source.status === "fallback"
        ? ["Matched cache is a fallback source; do not retry Figma until a human confirms the next checkpoint."]
        : []
    );
  if (reusable !== null && reusable.cachePath === cachePath) {
    return createPreparedWrite(
      root,
      target.specPath,
      reusable.source,
      reusable.nodes ?? createNodeCache(target.specPath, parsed),
      reusable.source.generatedAt,
      cacheReuse
    );
  }
  const source = createSourceRecord({
    target: target.specPath,
    generatedAt,
    type: "figma-mcp",
    status: "ok",
    url: parsed.url,
    fileKey: parsed.fileKey,
    nodeId: parsed.nodeId,
    reference: "",
    retriedAt: "",
    fallback: "",
    notes: reusable === null
      ? "Figma node URL 已记录；实际视觉事实仍需由 Figma MCP、导出图或人工复核补充。"
      : `已优先复用本地 Figma 缓存：${reusable.cachePath}；不要重复请求 Figma API/MCP。`
  });
  const nodes = createNodeCache(target.specPath, parsed);
  return createPreparedWrite(root, target.specPath, source, nodes, generatedAt, cacheReuse);
}

export async function prepareFigmaFallback(
  options: {
    root: string;
    target: string;
    source: FigmaFallbackSource;
    reference: string;
    retriedAt: string | null;
    notes: string | null;
    generatedAt?: string;
  }
): Promise<PreparedFigmaWrite> {
  const root = path.resolve(options.root);
  const target = await normalizeSpecTarget(root, options.target);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const source = createSourceRecord({
    target: target.specPath,
    generatedAt,
    type: options.source,
    status: "fallback",
    url: "",
    fileKey: "",
    nodeId: "",
    reference: options.reference,
    retriedAt: options.retriedAt ?? "",
    fallback: `${options.source}:${options.reference}`,
    notes: options.notes ?? "Figma MCP 不可用或需要降级；使用人工确认的替代来源继续规格化。"
  });
  const nodes = {
    schemaVersion: "1",
    target: target.specPath,
    nodes: [],
    notes: [
      "No Figma node metadata is cached for fallback-only source.",
      ...GUARDRAILS
    ]
  } satisfies FigmaNodeCache;
  return createPreparedWrite(
    root,
    target.specPath,
    source,
    nodes,
    generatedAt,
    createCacheReuse("fallback", { fileKey: "", nodeId: "" }, null, "Fallback source recorded; no Figma node cache lookup was possible.", [])
  );
}

export async function applyPreparedFigmaWrite(prepared: PreparedFigmaWrite): Promise<string[]> {
  return applyRuntimeWritePlan(prepared.plan);
}

export async function getFigmaCacheStatus(rootInput: string, targetInput: string): Promise<FigmaCacheStatus> {
  const root = path.resolve(rootInput);
  const target = await normalizeSpecTarget(root, targetInput);
  const cachePath = figmaCachePath(target.specPath);
  const sourcePath = path.posix.join(cachePath, "source.json");
  const nodesPath = path.posix.join(cachePath, "nodes.json");
  const notesPath = path.posix.join(cachePath, "notes.md");
  const files: string[] = [];
  const warnings: string[] = [];

  const source = await readJson<FigmaSourceRecord>(root, sourcePath);
  const nodes = await readJson<FigmaNodeCache>(root, nodesPath);
  const notes = await readOptionalText(root, notesPath);
  for (const candidate of [sourcePath, nodesPath, notesPath]) {
    if (await pathExists(resolveInsideRoot(root, candidate))) {
      files.push(candidate);
    }
  }

  if (source === null) {
    warnings.push("Figma source cache is missing. Run `azi figma spec` or `azi figma fallback`.");
  }
  if (nodes === null) {
    warnings.push("Figma node cache is missing.");
  }
  if (source?.source.status === "fallback" && source.source.retriedAt === "") {
    warnings.push("Fallback is active but retriedAt is empty; record the 429 retry checkpoint if applicable.");
  }

  return {
    root,
    specPath: target.specPath,
    cachePath,
    exists: files.length > 0,
    files,
    source,
    nodes,
    notes,
    warnings,
    nextActions: createStatusNextActions(source, warnings)
  };
}

export async function downloadFigmaSvgAssets(options: {
  root: string;
  target: string;
  url: string;
  token: string | undefined;
  generatedAt?: string;
}): Promise<FigmaAssetDownloadReport> {
  const root = path.resolve(options.root);
  const target = await normalizeSpecTarget(root, options.target);
  const parsed = parseFigmaNodeUrl(options.url);
  const cachePath = figmaCachePath(target.specPath);
  const manifestPath = path.posix.join(cachePath, "assets.json");
  const existing = await readJson<FigmaAssetManifest>(root, manifestPath);
  const reusable = await findReusableFigmaAssetManifest(root, parsed, manifestPath);
  if (reusable !== null) {
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      reusable.manifestPath,
      reusable.manifest,
      createCacheReuse(
        reusable.manifest.status === "rate-limited" ? "fallback" : "hit",
        parsed,
        reusable.cachePath,
        reusable.manifest.status === "rate-limited"
          ? `Figma 429 cache hit: ${reusable.cachePath}; retry after ${reusable.manifest.retriedAt || "unknown"}.`
          : `Figma asset cache hit: ${reusable.cachePath}; API request skipped.`,
        reusable.manifest.status === "rate-limited"
          ? ["Using cached 429 checkpoint to avoid repeated Figma API/MCP requests."]
          : []
      )
    );
  }
  if (existing !== null && existing.status === "cached") {
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      existing,
      createCacheReuse("hit", parsed, cachePath, "Figma asset cache hit in the current target; API request skipped.", [])
    );
  }
  if (existing !== null && existing.status === "skipped") {
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      existing,
      createCacheReuse("hit", parsed, cachePath, "Figma asset skip cache hit in the current target; API request skipped.", [])
    );
  }
  if (existing !== null && existing.status === "rate-limited" && retryIsInFuture(existing.retriedAt)) {
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      existing,
      createCacheReuse("fallback", parsed, cachePath, `Figma 429 cache hit in the current target; retry after ${existing.retriedAt}.`, [
        "Using cached 429 checkpoint to avoid repeated Figma API/MCP requests."
      ])
    );
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (options.token === undefined || options.token.trim() === "") {
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "skipped",
      icons: [],
      skipped: ["未设置 FIGMA_TOKEN，跳过 SVG icon 下载。"],
      warnings: ["设置 FIGMA_TOKEN 后可自动请求 Figma REST API，并把 SVG 缓存到本地。"],
      retriedAt: ""
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      manifest,
      createCacheReuse("miss", parsed, null, "Figma asset cache miss, but FIGMA_TOKEN is not set; API request skipped.", [])
    );
  }

  const nodesResponse = await figmaGetJson(options.token, `/v1/files/${encodeURIComponent(parsed.fileKey)}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&depth=4`);
  if (nodesResponse.status === 429) {
    const retriedAt = retryAfterToIso(nodesResponse.retryAfter, generatedAt);
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "rate-limited",
      icons: [],
      skipped: ["Figma REST API 返回 429，已停止继续请求。"],
      warnings: ["在 retriedAt 前会优先使用本地缓存或 fallback，避免连续触发 429。"],
      retriedAt
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      manifest,
      createCacheReuse("fallback", parsed, cachePath, `Figma REST API returned 429; retry after ${retriedAt || "unknown"}.`, [
        "429 checkpoint written so the next run can use local fallback instead of repeated requests."
      ])
    );
  }
  if (nodesResponse.status !== 200 || !isRecord(nodesResponse.json)) {
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "failed",
      icons: [],
      skipped: ["Figma 节点读取失败。"],
      warnings: [nodesResponse.error ?? `HTTP ${nodesResponse.status}`],
      retriedAt: ""
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(root, target.specPath, cachePath, manifestPath, manifest, createCacheReuse("miss", parsed, null, "Figma asset cache miss; node metadata request failed.", []));
  }

  const candidates = findIconCandidates(nodesResponse.json, parsed.nodeId).slice(0, 30);
  if (candidates.length === 0) {
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "skipped",
      icons: [],
      skipped: ["未在 Figma 节点树中发现可导出的 icon 候选。"],
      warnings: ["可以手动选择 icon 节点 URL 再运行 `azi figma <url> --yes`。"],
      retriedAt: ""
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(root, target.specPath, cachePath, manifestPath, manifest, createCacheReuse("miss", parsed, null, "Figma asset cache miss; no icon candidates were discovered.", []));
  }

  const ids = candidates.map((candidate) => candidate.nodeId).join(",");
  const imagePath = `/v1/images/${encodeURIComponent(parsed.fileKey)}?ids=${encodeURIComponent(ids)}&format=svg&svg_include_node_id=true&svg_outline_text=false`;
  const imageResponse = await figmaGetJson(options.token, imagePath);
  if (imageResponse.status === 429) {
    const retriedAt = retryAfterToIso(imageResponse.retryAfter, generatedAt);
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "rate-limited",
      icons: [],
      skipped: ["Figma SVG 导出返回 429，已停止继续请求。"],
      warnings: ["已避免逐个 icon 重试；后续等 retriedAt 之后再请求。"],
      retriedAt
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(
      root,
      target.specPath,
      cachePath,
      manifestPath,
      manifest,
      createCacheReuse("fallback", parsed, cachePath, `Figma SVG export returned 429; retry after ${retriedAt || "unknown"}.`, [
        "429 checkpoint written so the next run can use local fallback instead of repeated requests."
      ])
    );
  }
  const imageMap = isRecord(imageResponse.json) && isRecord(imageResponse.json.images)
    ? imageResponse.json.images
    : null;
  if (imageResponse.status !== 200 || imageMap === null) {
    const manifest = createAssetManifest({
      target: target.specPath,
      generatedAt,
      parsed,
      status: "failed",
      icons: [],
      skipped: ["Figma SVG 导出失败。"],
      warnings: [imageResponse.error ?? `HTTP ${imageResponse.status}`],
      retriedAt: ""
    });
    await writeAssetManifest(root, manifestPath, manifest);
    return createAssetReport(root, target.specPath, cachePath, manifestPath, manifest, createCacheReuse("miss", parsed, null, "Figma asset cache miss; SVG export failed.", []));
  }

  const icons: FigmaAssetManifest["icons"] = [];
  const warnings: string[] = [];
  const iconDirectory = path.posix.join(cachePath, "icons");
  await mkdir(resolveInsideRoot(root, iconDirectory), { recursive: true });
  for (const candidate of candidates) {
    const exportUrl = imageMap[candidate.nodeId];
    if (typeof exportUrl !== "string" || exportUrl === "") {
      warnings.push(`节点 ${candidate.nodeId} 未返回 SVG 下载地址。`);
      continue;
    }
    const svg = await fetchText(exportUrl);
    if (svg.status !== 200 || svg.text === null) {
      warnings.push(`节点 ${candidate.nodeId} SVG 下载失败：${svg.error ?? `HTTP ${svg.status}`}`);
      continue;
    }
    const file = path.posix.join(iconDirectory, `${safeFileName(candidate.name)}-${candidate.nodeId.replace(/:/g, "-")}.svg`);
    await writeText(root, file, svg.text);
    icons.push({
      nodeId: candidate.nodeId,
      name: candidate.name,
      file
    });
  }

  const manifest = createAssetManifest({
    target: target.specPath,
    generatedAt,
    parsed,
    status: icons.length > 0 ? "cached" : "failed",
    icons,
    skipped: icons.length > 0 ? [] : ["没有成功下载任何 SVG icon。"],
    warnings,
    retriedAt: ""
  });
  await writeAssetManifest(root, manifestPath, manifest);
  return createAssetReport(
    root,
    target.specPath,
    cachePath,
    manifestPath,
    manifest,
    createCacheReuse("miss", parsed, null, "Figma asset cache miss; SVG assets were fetched once and cached locally.", [])
  );
}

function createPreparedWrite(
  root: string,
  specPath: string,
  source: FigmaSourceRecord,
  nodes: FigmaNodeCache,
  generatedAt: string,
  cacheReuse: FigmaCacheReuseReport
): Promise<PreparedFigmaWrite> {
  return createPreparedWriteAsync(root, specPath, source, nodes, generatedAt, cacheReuse);
}

async function createPreparedWriteAsync(
  root: string,
  specPath: string,
  source: FigmaSourceRecord,
  nodes: FigmaNodeCache,
  generatedAt: string,
  cacheReuse: FigmaCacheReuseReport
): Promise<PreparedFigmaWrite> {
  const cachePath = figmaCachePath(specPath);
  const notes = createNotes(source);
  const proposalPath = `.harness/proposals/${path.posix.basename(specPath)}-figma-source.patch`;
  const proposalContent = await createSpecProposal(root, specPath, source, generatedAt);
  const identity = createIdentityRecord(cachePath, source);
  const intents: RuntimeFileIntent[] = [
    seeded(path.posix.join(cachePath, "identity.json"), json(identity)),
    seeded(path.posix.join(cachePath, "source.json"), json(source)),
    seeded(path.posix.join(cachePath, "nodes.json"), json(nodes)),
    seeded(path.posix.join(cachePath, "notes.md"), notes),
    seeded(proposalPath, proposalContent)
  ];
  const plan = await createRuntimeWritePlan(root, intents);

  return {
    root,
    specPath,
    cachePath,
    source,
    nodes,
    cacheReuse,
    notes,
    proposalPath,
    plan,
    warnings: plan.hasConflicts
      ? ["写入计划存在冲突；已有缓存或建议补丁内容不同，未直接覆盖。"]
      : cacheReuse.warnings,
    nextActions: [
      "人工复核 `.harness/figma-cache/` 中的来源记录。",
      `审查并按需应用 ${proposalPath}，再运行 \`npx azi spec validate --root <project> ${specPath}\`。`,
      "补齐接口、权限、字典和后端字段事实；不要从 Figma 推断这些内容。"
    ]
  };
}

async function createSpecProposal(
  root: string,
  specPath: string,
  source: FigmaSourceRecord,
  generatedAt: string
): Promise<string> {
  const screensRelative = path.posix.join(specPath, "screens.yaml");
  const designRelative = path.posix.join(specPath, "design.md");
  const existingScreens = await readOptionalText(root, screensRelative);
  const existingDesign = await readOptionalText(root, designRelative);
  const nextScreens = createNextScreensYaml(existingScreens, source);
  const designAddition = createDesignSourceSection(source, generatedAt);
  return [
    createFullFilePatch(screensRelative, existingScreens, nextScreens),
    existingDesign === null
      ? createFullFilePatch(designRelative, null, designAddition)
      : createAppendOnlyPatch(designRelative, existingDesign, designAddition)
  ].join("\n");
}

function createNextScreensYaml(existing: string | null, source: FigmaSourceRecord): string {
  const parsed = parseExistingScreens(existing);
  parsed.source = {
    type: source.source.type,
    url: source.source.url,
    nodeId: source.source.nodeId,
    reference: source.source.reference,
    status: source.source.status,
    retriedAt: source.source.retriedAt,
    fallback: source.source.fallback,
    notes: source.source.notes
  };
  if (!Array.isArray(parsed.unknowns)) {
    parsed.unknowns = [];
  }
  const unknowns = parsed.unknowns as unknown[];
  if (!unknowns.some((item) => isRecord(item) && item.id === "figma-backend-facts")) {
    unknowns.push({
      id: "figma-backend-facts",
      question: "接口、权限、字典和后端字段必须来自项目证据或人工确认，不能由 Figma 推断。",
      blocking: true
    });
  }
  return stringifyYaml(parsed);
}

function parseExistingScreens(existing: string | null): Record<string, unknown> {
  if (existing !== null && existing.trim() !== "") {
    const parsed: unknown = parseYaml(existing);
    if (isRecord(parsed)) {
      return parsed;
    }
  }
  return {
    version: 1,
    feature: "unknown",
    source: {
      type: "none",
      url: "",
      nodeId: "",
      reference: "",
      status: "pending",
      retriedAt: "",
      fallback: "",
      notes: ""
    },
    screens: [
      {
        id: "list",
        route: "",
        title: "",
        states: ["default"],
        regions: [],
        interactions: [],
        assets: []
      }
    ],
    unknowns: []
  };
}

function createDesignSourceSection(source: FigmaSourceRecord, generatedAt: string): string {
  return [
    "## Figma 来源记录",
    "",
    `- Generated / 生成时间：${generatedAt}`,
    `- Source / 来源类型：${source.source.type}`,
    `- Status / 状态：${source.source.status}`,
    `- URL：${source.source.url || "无"}`,
    `- File key：${source.source.fileKey || "无"}`,
    `- Node ID：${source.source.nodeId || "无"}`,
    `- Reference / 降级引用：${source.source.reference || "无"}`,
    `- Retried at / 重试检查点：${source.source.retriedAt || "无"}`,
    `- Fallback / 降级方式：${source.source.fallback || "无"}`,
    `- Notes / 说明：${source.source.notes}`,
    "- Boundary / 边界：Figma 不能作为接口、权限、字典或后端字段来源。"
  ].join("\n");
}

function createSourceRecord(input: {
  target: string;
  generatedAt: string;
  type: FigmaSourceRecord["source"]["type"];
  status: FigmaSourceRecord["source"]["status"];
  url: string;
  fileKey: string;
  nodeId: string;
  reference: string;
  retriedAt: string;
  fallback: string;
  notes: string;
}): FigmaSourceRecord {
  return {
    schemaVersion: "1",
    target: input.target,
    generatedAt: input.generatedAt,
    source: {
      type: input.type,
      status: input.status,
      url: input.url,
      fileKey: input.fileKey,
      nodeId: input.nodeId,
      reference: input.reference,
      retriedAt: input.retriedAt,
      fallback: input.fallback,
      notes: input.notes
    },
    guardrails: GUARDRAILS
  };
}

function createNodeCache(target: string, parsed: ParsedFigmaNodeUrl): FigmaNodeCache {
  return {
    schemaVersion: "1",
    target,
    nodes: [{
      fileKey: parsed.fileKey,
      nodeId: parsed.nodeId,
      url: parsed.url,
      status: "metadata-only"
    }],
    notes: [
      "This cache stores the node source only; it does not include Figma MCP design payloads yet.",
      ...GUARDRAILS
    ]
  };
}

function createNotes(source: FigmaSourceRecord): string {
  return [
    `# Figma 缓存：${source.target}`,
    "",
    `- 生成时间：${source.generatedAt}`,
    `- 来源类型：${source.source.type}`,
    `- 状态：${source.source.status}`,
    `- URL：${source.source.url || "无"}`,
    `- Node ID：${source.source.nodeId || "无"}`,
    `- 降级引用：${source.source.reference || "无"}`,
    `- 重试检查点：${source.source.retriedAt || "无"}`,
    `- 降级方式：${source.source.fallback || "无"}`,
    "",
    "## 边界",
    "",
    ...GUARDRAILS.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

function createStatusNextActions(source: FigmaSourceRecord | null, warnings: string[]): string[] {
  if (source === null) {
    return ["运行 `npx azi figma spec --target specs/<id-feature> --url <figma-node-url> --write` 或 `npx azi figma fallback ... --write`。"];
  }
  const actions = ["审查 `.harness/proposals/*-figma-source.patch`，决定是否合并到规格。"];
  if (warnings.length > 0) {
    actions.push("补齐 warning 中提到的来源、fallback 或重试记录。");
  }
  actions.push("继续补充接口、权限、字典和后端字段事实。");
  return actions;
}

async function normalizeSpecTarget(root: string, target: string): Promise<{
  specPath: string;
  absolutePath: string;
}> {
  const normalizedTarget = target.replace(/\\/g, "/").replace(/^\.\//u, "").replace(/\/$/u, "");
  const absoluteTarget = resolveInsideRoot(root, normalizedTarget);
  if (!(await pathExists(absoluteTarget))) {
    throw new Error(`Figma target does not exist: ${target}`);
  }
  const targetStat = await stat(absoluteTarget);
  const specDirectory = targetStat.isDirectory() ? absoluteTarget : path.dirname(absoluteTarget);
  const specPath = path.relative(root, specDirectory).split(path.sep).join("/");
  if (!/^specs\/\d{3}-[^/]+$/u.test(specPath)) {
    throw new Error("Figma target must be a numbered spec directory such as `specs/001-feature`.");
  }
  return {
    specPath,
    absolutePath: specDirectory
  };
}

function createAssetManifest(input: {
  target: string;
  generatedAt: string;
  parsed: ParsedFigmaNodeUrl;
  status: FigmaAssetManifest["status"];
  icons: FigmaAssetManifest["icons"];
  skipped: string[];
  warnings: string[];
  retriedAt: string;
}): FigmaAssetManifest {
  return {
    schemaVersion: "1",
    target: input.target,
    generatedAt: input.generatedAt,
    status: input.status,
    source: {
      fileKey: input.parsed.fileKey,
      nodeId: input.parsed.nodeId,
      url: input.parsed.url
    },
    icons: input.icons,
    skipped: input.skipped,
    warnings: input.warnings,
    retriedAt: input.retriedAt
  };
}

function createAssetReport(
  root: string,
  specPath: string,
  cachePath: string,
  manifestPath: string,
  manifest: FigmaAssetManifest,
  cacheReuse: FigmaCacheReuseReport
): FigmaAssetDownloadReport {
  return {
    root,
    specPath,
    cachePath,
    manifestPath,
    status: manifest.status,
    icons: manifest.icons,
    skipped: manifest.skipped,
    warnings: manifest.warnings,
    retriedAt: manifest.retriedAt,
    cacheReuse
  };
}

async function findReusableFigmaCache(
  root: string,
  parsed: ParsedFigmaNodeUrl
): Promise<{ cachePath: string; source: FigmaSourceRecord; nodes: FigmaNodeCache | null } | null> {
  const entries = await listFigmaCacheEntries(root);
  for (const cachePath of entries) {
    const source = await readJson<FigmaSourceRecord>(root, path.posix.join(cachePath, "source.json"));
    if (source?.source.fileKey === parsed.fileKey && source.source.nodeId === parsed.nodeId) {
      const nodes = await readJson<FigmaNodeCache>(root, path.posix.join(cachePath, "nodes.json"));
      return { cachePath, source, nodes };
    }
  }
  return null;
}

async function findReusableFigmaAssetManifest(
  root: string,
  parsed: ParsedFigmaNodeUrl,
  currentManifestPath: string
): Promise<{ cachePath: string; manifestPath: string; manifest: FigmaAssetManifest } | null> {
  const entries = await listFigmaCacheEntries(root);
  for (const cachePath of entries) {
    const manifestPath = path.posix.join(cachePath, "assets.json");
    if (manifestPath === currentManifestPath) {
      continue;
    }
    const manifest = await readJson<FigmaAssetManifest>(root, manifestPath);
    if (manifest?.source.fileKey !== parsed.fileKey || manifest.source.nodeId !== parsed.nodeId) {
      continue;
    }
    if (manifest.status === "cached") {
      return { cachePath, manifestPath, manifest };
    }
    if (manifest.status === "rate-limited" && retryIsInFuture(manifest.retriedAt)) {
      return { cachePath, manifestPath, manifest };
    }
  }
  return null;
}

async function listFigmaCacheEntries(root: string): Promise<string[]> {
  const base = resolveInsideRoot(root, ".harness/figma-cache");
  try {
    const entries = await readdir(base, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => `.harness/figma-cache/${entry.name}`)
      .sort();
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }
}

function createIdentityRecord(cachePath: string, source: FigmaSourceRecord): FigmaIdentityRecord {
  return {
    schemaVersion: "1",
    cacheKey: figmaCacheKey(source.source.fileKey, source.source.nodeId),
    fileKey: source.source.fileKey,
    nodeId: source.source.nodeId,
    url: source.source.url,
    target: source.target,
    sourcePath: path.posix.join(cachePath, "source.json"),
    assetsPath: path.posix.join(cachePath, "assets.json")
  };
}

function createCacheReuse(
  status: FigmaCacheReuseReport["status"],
  parsed: Pick<ParsedFigmaNodeUrl, "fileKey" | "nodeId">,
  matchedCachePath: string | null,
  message: string,
  warnings: string[]
): FigmaCacheReuseReport {
  return {
    status,
    cacheKey: figmaCacheKey(parsed.fileKey, parsed.nodeId),
    matchedCachePath,
    message,
    warnings
  };
}

function figmaCacheKey(fileKey: string, nodeId: string): string {
  return `${fileKey}:${nodeId}`;
}

async function writeAssetManifest(root: string, relativePath: string, manifest: FigmaAssetManifest): Promise<void> {
  await writeText(root, relativePath, json(manifest));
}

async function writeText(root: string, relativePath: string, content: string): Promise<void> {
  const target = resolveInsideRoot(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

function findIconCandidates(payload: Record<string, unknown>, rootNodeId: string): Array<{ nodeId: string; name: string }> {
  const nodes = isRecord(payload.nodes) ? payload.nodes : {};
  const rootEntry = nodes[rootNodeId];
  const document = isRecord(rootEntry) && isRecord(rootEntry.document) ? rootEntry.document : null;
  if (document === null) {
    return [];
  }
  const candidates: Array<{ nodeId: string; name: string }> = [];
  walkFigmaNode(document, candidates);
  return uniqueByNodeId(candidates);
}

function walkFigmaNode(node: Record<string, unknown>, candidates: Array<{ nodeId: string; name: string }>): void {
  const id = typeof node.id === "string" ? node.id : null;
  const name = typeof node.name === "string" ? node.name : "icon";
  const type = typeof node.type === "string" ? node.type : "";
  if (id !== null && isIconLikeNode(node, name, type)) {
    candidates.push({ nodeId: id, name });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (isRecord(child)) {
        walkFigmaNode(child, candidates);
      }
    }
  }
}

function isIconLikeNode(node: Record<string, unknown>, name: string, type: string): boolean {
  if (/icon|icons|ico|图标|按钮图标/iu.test(name)) {
    return true;
  }
  if (!["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "POLYGON"].includes(type)) {
    return false;
  }
  const box = isRecord(node.absoluteBoundingBox) ? node.absoluteBoundingBox : null;
  const width = typeof box?.width === "number" ? box.width : null;
  const height = typeof box?.height === "number" ? box.height : null;
  return width !== null && height !== null && width > 0 && height > 0 && width <= 96 && height <= 96;
}

function uniqueByNodeId(values: Array<{ nodeId: string; name: string }>): Array<{ nodeId: string; name: string }> {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.nodeId)) {
      return false;
    }
    seen.add(value.nodeId);
    return true;
  });
}

async function figmaGetJson(token: string, apiPath: string): Promise<{
  status: number;
  json: unknown;
  retryAfter: string | null;
  error: string | null;
}> {
  try {
    const response = await fetch(`https://api.figma.com${apiPath}`, {
      headers: {
        "X-Figma-Token": token
      }
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text === "" ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      status: response.status,
      json,
      retryAfter: response.headers.get("retry-after"),
      error: response.ok ? null : extractFigmaError(json) ?? text
    };
  } catch (error) {
    return {
      status: 0,
      json: null,
      retryAfter: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchText(url: string): Promise<{ status: number; text: string | null; error: string | null }> {
  try {
    const response = await fetch(url);
    return {
      status: response.status,
      text: response.ok ? await response.text() : null,
      error: response.ok ? null : await response.text().catch(() => "")
    };
  } catch (error) {
    return {
      status: 0,
      text: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function extractFigmaError(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.err === "string" && value.err !== "") {
    return value.err;
  }
  if (typeof value.message === "string" && value.message !== "") {
    return value.message;
  }
  return null;
}

function retryAfterToIso(retryAfter: string | null, nowIso: string): string {
  if (retryAfter === null || retryAfter.trim() === "") {
    return "";
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return new Date(new Date(nowIso).getTime() + seconds * 1000).toISOString();
  }
  const parsed = new Date(retryAfter);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function retryIsInFuture(value: string): boolean {
  if (value === "") {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function safeFileName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 60);
  return normalized === "" ? "icon" : normalized;
}

async function readOptionalText(root: string, relativePath: string): Promise<string | null> {
  const absolute = resolveInsideRoot(root, relativePath);
  if (!(await pathExists(absolute))) {
    return null;
  }
  return readFile(absolute, "utf8");
}

async function readJson<T>(root: string, relativePath: string): Promise<T | null> {
  const raw = await readOptionalText(root, relativePath);
  if (raw === null) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function figmaCachePath(specPath: string): string {
  return `.harness/figma-cache/${path.posix.basename(specPath)}`;
}

function seeded(pathname: string, content: string): RuntimeFileIntent {
  return {
    path: pathname,
    content,
    ownership: "seeded",
    templateVersion: "1"
  };
}

function slugify(input: string): string | null {
  const slug = input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) ? slug : null;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
