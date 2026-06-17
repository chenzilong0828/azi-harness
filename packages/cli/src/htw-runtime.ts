import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  isRecord,
  pathExists,
  readJsonObject,
  resolveInsideRoot
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";

const MAX_ENTRY_BYTES = 256 * 1024;
const MAX_ENTRY_FILES = 30;
const COMMON_ENTRY_CANDIDATES = [
  "README.md",
  "readme.md",
  "index.d.ts",
  "index.ts",
  "index.js",
  "src/index.ts",
  "src/index.js",
  "dist/index.d.ts",
  "dist/index.js",
  "lib/index.d.ts",
  "lib/index.js",
  "types/index.d.ts"
];

export interface HtwEntryFile {
  path: string;
  kind: "package-field" | "common";
  exists: boolean;
}

export interface HtwPublicSignals {
  exports: string[];
  components: string[];
  props: string[];
  events: string[];
}

export interface HtwInspectReport {
  root: string;
  packageName: string | null;
  declared: boolean;
  versionSpec: string | null;
  packageInstalled: boolean;
  packageRoot: string | null;
  packageVersion: string | null;
  entryFiles: HtwEntryFile[];
  publicSignals: HtwPublicSignals;
  warnings: string[];
}

export async function inspectHtwTable(rootInput: string): Promise<HtwInspectReport> {
  const root = path.resolve(rootInput);
  const profile = await detectProject(root);
  const htw = profile.effective.htwTable;
  const packageName = htw.packageName ?? findDeclaredHtwPackageName(await readJsonObject(root, "package.json"));
  const warnings = [...htw.conflicts];

  if (packageName === null) {
    return {
      root,
      packageName,
      declared: false,
      versionSpec: null,
      packageInstalled: false,
      packageRoot: null,
      packageVersion: null,
      entryFiles: [],
      publicSignals: emptySignals(),
      warnings: [
        ...warnings,
        "package.json 中未声明 HTWTable 依赖。"
      ]
    };
  }

  const packageRoot = resolvePackageRoot(root, packageName);
  if (!(await pathExists(packageRoot))) {
    return {
      root,
      packageName,
      declared: true,
      versionSpec: htw.versionSpec,
      packageInstalled: false,
      packageRoot: toPortablePath(path.relative(root, packageRoot)),
      packageVersion: null,
      entryFiles: [],
      publicSignals: emptySignals(),
      warnings: [
        ...warnings,
        `已声明包 \`${packageName}\`，但未在 node_modules 下找到。请先安装项目依赖，再检查公开 API。`
      ]
    };
  }

  const packageJson = await readJsonObject(packageRoot, "package.json");
  const packageVersion = typeof packageJson?.version === "string" ? packageJson.version : null;
  const entryFiles = collectEntryFiles(packageJson);
  const inspectedFiles = await readEntryFiles(packageRoot, entryFiles);
  const publicSignals = extractPublicSignals(inspectedFiles);

  if (inspectedFiles.length === 0) {
    warnings.push(`未找到 \`${packageName}\` 可读取的公开入口文件。`);
  }

  return {
    root,
    packageName,
    declared: true,
    versionSpec: htw.versionSpec,
    packageInstalled: true,
    packageRoot: toPortablePath(path.relative(root, packageRoot)),
    packageVersion,
    entryFiles,
    publicSignals,
    warnings
  };
}

export async function writeHtwInspectionDocument(
  rootInput: string,
  report: HtwInspectReport
): Promise<string> {
  const root = path.resolve(rootInput);
  const relativePath = ".harness/docs/htw-table-api.md";
  const target = resolveInsideRoot(root, relativePath);
  await ensureParentDirectory(target);
  await writeFile(target, createHtwInspectionDocument(report), "utf8");
  return relativePath;
}

function collectEntryFiles(packageJson: Record<string, unknown> | null): HtwEntryFile[] {
  const entries = new Map<string, HtwEntryFile["kind"]>();
  const add = (value: unknown, kind: HtwEntryFile["kind"]): void => {
    if (typeof value !== "string" || value.trim() === "") {
      return;
    }
    const normalized = toPortablePath(value).replace(/^\.\//, "");
    if (normalized === "" || normalized.startsWith("../")) {
      return;
    }
    entries.set(normalized, kind);
  };

  if (packageJson !== null) {
    for (const field of ["main", "module", "types", "typings"] as const) {
      add(packageJson[field], "package-field");
    }
    collectExports(packageJson.exports, (value) => add(value, "package-field"));
  }

  for (const candidate of COMMON_ENTRY_CANDIDATES) {
    if (!entries.has(candidate)) {
      entries.set(candidate, "common");
    }
  }

  return [...entries.entries()]
    .slice(0, MAX_ENTRY_FILES)
    .map(([entryPath, kind]) => ({
      path: entryPath,
      kind,
      exists: false
    }));
}

function collectExports(value: unknown, add: (value: string) => void): void {
  if (typeof value === "string") {
    add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectExports(item, add);
    }
    return;
  }
  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      collectExports(item, add);
    }
  }
}

async function readEntryFiles(
  packageRoot: string,
  entryFiles: HtwEntryFile[]
): Promise<Array<{ path: string; text: string }>> {
  const readable: Array<{ path: string; text: string }> = [];
  for (const entry of entryFiles) {
    const target = path.resolve(packageRoot, entry.path);
    const relative = path.relative(packageRoot, target);
    if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      continue;
    }

    if (!(await pathExists(target))) {
      continue;
    }

    const targetStat = await stat(target);
    entry.exists = targetStat.isFile();
    if (!targetStat.isFile() || targetStat.size > MAX_ENTRY_BYTES) {
      continue;
    }

    try {
      readable.push({
        path: entry.path,
        text: await readFile(target, "utf8")
      });
    } catch {
      // Binary or unreadable files are not useful for public API inspection.
    }
  }

  return readable;
}

function extractPublicSignals(files: Array<{ path: string; text: string }>): HtwPublicSignals {
  const exports = new Set<string>();
  const components = new Set<string>();
  const props = new Set<string>();
  const events = new Set<string>();

  for (const file of files) {
    collectMatches(file.text, /\bexport\s+(?:declare\s+)?(?:const|let|var|function|class|interface|type)\s+([A-Za-z_$][\w$]*)/g, exports);
    collectNamedExports(file.text, exports);
    collectMatches(file.text, /\b(HtwTable|HTWTable|Htw[A-Za-z0-9_]*Table|[A-Za-z0-9_]*Table)\b/g, components);
    collectMatches(file.text, /\binterface\s+([A-Za-z_$][\w$]*Props)\b/g, props);
    collectMatches(file.text, /\btype\s+([A-Za-z_$][\w$]*Props)\b/g, props);
    collectMatches(file.text, /\bemit\s*\(\s*["']([^"']+)["']/g, events);
    collectMatches(file.text, /\bevent\s*:\s*["']([^"']+)["']/g, events);
    collectEmitsArray(file.text, events);

    if (/defineProps\s*</.test(file.text)) {
      props.add(`defineProps in ${file.path}`);
    }
    if (/defineEmits\s*</.test(file.text)) {
      events.add(`defineEmits in ${file.path}`);
    }
  }

  return {
    exports: sorted(exports),
    components: sorted(components),
    props: sorted(props),
    events: sorted(events)
  };
}

function collectNamedExports(text: string, target: Set<string>): void {
  const regex = /\bexport\s*\{([^}]+)\}/g;
  for (const match of text.matchAll(regex)) {
    const names = match[1];
    if (names === undefined) {
      continue;
    }
    for (const part of names.split(",")) {
      const name = part.trim().split(/\s+as\s+/i)[0]?.trim();
      if (name !== undefined && /^[A-Za-z_$][\w$]*$/.test(name)) {
        target.add(name);
      }
    }
  }
}

function collectEmitsArray(text: string, target: Set<string>): void {
  const regex = /\bemits\s*:\s*\[([^\]]+)\]/g;
  for (const match of text.matchAll(regex)) {
    const body = match[1];
    if (body === undefined) {
      continue;
    }
    collectMatches(body, /["']([^"']+)["']/g, target);
  }
}

function collectMatches(text: string, regex: RegExp, target: Set<string>): void {
  for (const match of text.matchAll(regex)) {
    const value = match[1]?.trim();
    if (value !== undefined && value !== "") {
      target.add(value);
    }
  }
}

function createHtwInspectionDocument(report: HtwInspectReport): string {
  return [
    "# HTWTable API 检查",
    "",
    `- 包名：\`${report.packageName ?? "未声明"}\``,
    `- package.json 是否声明：\`${report.declared}\``,
    `- 依赖版本或来源：\`${report.versionSpec ?? "unknown"}\``,
    `- node_modules 是否已安装：\`${report.packageInstalled}\``,
    `- 包目录：\`${report.packageRoot ?? "unknown"}\``,
    `- 包版本：\`${report.packageVersion ?? "unknown"}\``,
    "",
    "## 公开入口文件",
    "",
    ...formatEntryFiles(report.entryFiles),
    "",
    "## 公开 API 线索",
    "",
    formatList("导出项", report.publicSignals.exports),
    "",
    formatList("组件", report.publicSignals.components),
    "",
    formatList("Props", report.publicSignals.props),
    "",
    formatList("事件", report.publicSignals.events),
    "",
    "## 警告",
    "",
    ...formatWarnings(report.warnings),
    "",
    "本文件只根据目标项目已安装的包生成，不复制、不修改 HTWTable 源码。"
  ].join("\n");
}

function formatEntryFiles(entryFiles: HtwEntryFile[]): string[] {
  if (entryFiles.length === 0) {
    return ["- 无"];
  }
  return entryFiles.map((entry) => `- ${entry.exists ? "已找到" : "未找到"}：\`${entry.path}\`（${entry.kind}）`);
}

function formatList(title: string, values: string[]): string {
  if (values.length === 0) {
    return `### ${title}\n\n- 无`;
  }
  return [`### ${title}`, "", ...values.map((value) => `- \`${value}\``)].join("\n");
}

function formatWarnings(warnings: string[]): string[] {
  return warnings.length === 0 ? ["- 无"] : warnings.map((warning) => `- ${warning}`);
}

function findDeclaredHtwPackageName(packageJson: Record<string, unknown> | null): string | null {
  if (packageJson === null) {
    return null;
  }
  for (const section of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const value = packageJson[section];
    if (!isRecord(value)) {
      continue;
    }
    const match = Object.keys(value).find((name) => /htw[-_]?table/i.test(name));
    if (match !== undefined) {
      return match;
    }
  }
  return null;
}

function resolvePackageRoot(root: string, packageName: string): string {
  return resolveInsideRoot(root, path.posix.join("node_modules", ...packageName.split("/")));
}

function emptySignals(): HtwPublicSignals {
  return {
    exports: [],
    components: [],
    props: [],
    events: []
  };
}

function sorted(values: Set<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right)).slice(0, 50);
}

async function ensureParentDirectory(target: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}
