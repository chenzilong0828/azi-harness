import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  pathExists,
  resolveInsideRoot
} from "@azi-harness/core";

import type { GitReviewState, ReviewFinding } from "./review-audit.js";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue"]);
const MAX_FILE_BYTES = 300_000;

export interface RuoyiGuardOptions {
  root: string;
  git: GitReviewState;
  target: string | null;
}

interface FactSet {
  apiPaths: Set<string>;
  permissions: Set<string>;
  dictTypes: Set<string>;
}

interface ChangedFileSnapshot {
  file: string;
  content: string;
  auditContent: string;
}

export async function createRuoyiGuardFindings(
  options: RuoyiGuardOptions
): Promise<ReviewFinding[]> {
  if (!options.git.available || options.git.changedFiles.length === 0) {
    return [];
  }

  const changed = await readChangedSourceFiles(options.root, options.git);
  if (changed.length === 0) {
    return [];
  }

  const changedSet = new Set(changed.map((item) => item.file));
  const baseline = await collectProjectFacts(options.root, changedSet);
  const specFacts = await collectSpecFacts(options.root, options.target);
  const allowed = mergeFacts(baseline, specFacts);
  for (const removedContent of parseDiffContent(options.git.diff).removed.values()) {
    addSpecFacts(allowed, removedContent);
  }
  const findings: ReviewFinding[] = [];

  for (const snapshot of changed) {
    findings.push(...findUnknownApiPaths(snapshot, allowed));
    findings.push(...findUnknownPermissions(snapshot, allowed));
    findings.push(...findUnknownDictTypes(snapshot, allowed));
    findings.push(...findDirectRequestUsage(snapshot));
  }

  if (changed.some((snapshot) => usesHtwTable(snapshot.auditContent))) {
    const htwDocExists = await pathExists(resolveInsideRoot(options.root, ".harness/docs/htw-table-api.md"));
    const specAllowsHtw = specFacts.rawText !== "" && /HTWTable\s*(?:evaluation|评估|说明)|使用.*HTWTable|HTWTable.*适配/iu.test(specFacts.rawText);
    if (!htwDocExists && !specAllowsHtw) {
      findings.push({
        severity: "error",
        area: "ruoyi",
        code: "ruoyi-htwtable-evidence-missing",
        message: "本次变更使用了 HTWTable，但缺少目标项目公开 API 或规格评估证据。",
        evidence: changed.filter((snapshot) => usesHtwTable(snapshot.auditContent)).map((snapshot) => snapshot.file).join(", "),
        suggestion: "先运行 `npx azi htw inspect --write-doc`，或在 design.md 记录当前版本 HTWTable 的适配结论。"
      });
    }
  }

  return deduplicate(findings);
}

async function readChangedSourceFiles(root: string, git: GitReviewState): Promise<ChangedFileSnapshot[]> {
  const snapshots: ChangedFileSnapshot[] = [];
  const addedContentByFile = parseDiffContent(git.diff).added;
  const untracked = new Set(git.changes.filter((change) => change.untracked).map((change) => change.path));
  for (const file of git.changedFiles) {
    if (!isSourceFile(file)) {
      continue;
    }
    const absolute = resolveInsideRoot(root, file);
    if (!(await pathExists(absolute))) {
      continue;
    }
    const content = await readLimitedText(absolute);
    if (content !== null) {
      const auditContent = untracked.has(file)
        ? content
        : addedContentByFile.get(file) ?? "";
      if (auditContent.trim() !== "") {
        snapshots.push({ file, content, auditContent });
      }
    }
  }
  return snapshots;
}

async function collectProjectFacts(root: string, excludeFiles: Set<string>): Promise<FactSet> {
  const facts = emptyFacts();
  const srcRoot = resolveInsideRoot(root, "src");
  if (!(await pathExists(srcRoot))) {
    return facts;
  }
  const files = await listSourceFiles(srcRoot, "src");
  for (const file of files) {
    if (excludeFiles.has(file)) {
      continue;
    }
    const content = await readLimitedText(resolveInsideRoot(root, file));
    if (content === null) {
      continue;
    }
    addFacts(facts, file, content);
  }
  return facts;
}

async function collectSpecFacts(root: string, target: string | null): Promise<FactSet & { rawText: string }> {
  const facts = Object.assign(emptyFacts(), { rawText: "" });
  if (target === null) {
    return facts;
  }
  for (const name of ["requirements.md", "design.md", "tasks.md", "acceptance.md"]) {
    const file = resolveInsideRoot(root, path.posix.join(target, name));
    if (!(await pathExists(file))) {
      continue;
    }
    const content = await readLimitedText(file);
    if (content === null) {
      continue;
    }
    facts.rawText += `\n${content}`;
    addSpecFacts(facts, content);
  }
  return facts;
}

function addFacts(facts: FactSet, file: string, content: string): void {
  for (const apiPath of extractApiPaths(file, content)) {
    facts.apiPaths.add(apiPath);
  }
  for (const permission of extractPermissions(content)) {
    facts.permissions.add(permission);
  }
  for (const dictType of extractDictTypes(content)) {
    facts.dictTypes.add(dictType);
  }
}

function addSpecFacts(facts: FactSet, content: string): void {
  for (const apiPath of extractPathLiterals(content)) {
    facts.apiPaths.add(apiPath);
  }
  for (const permission of extractPermissions(content)) {
    facts.permissions.add(permission);
  }
  for (const dictType of extractDictTypes(content)) {
    facts.dictTypes.add(dictType);
  }
}

function findUnknownApiPaths(snapshot: ChangedFileSnapshot, allowed: FactSet): ReviewFinding[] {
  if (!shouldAuditApiPaths(snapshot.file, snapshot.auditContent)) {
    return [];
  }
  return extractApiPaths(snapshot.file, snapshot.auditContent)
    .filter((apiPath) => !allowed.apiPaths.has(apiPath))
    .map((apiPath) => ({
      severity: "error" as const,
      area: "ruoyi",
      code: "ruoyi-api-path-unverified",
      message: `新增 API 路径缺少项目既有事实或规格证据：${apiPath}`,
      evidence: snapshot.file,
      suggestion: "把接口来源补进 requirements.md/design.md，或复用已有 api 模块；不要凭空发明后端路径。"
    }));
}

function findUnknownPermissions(snapshot: ChangedFileSnapshot, allowed: FactSet): ReviewFinding[] {
  return extractPermissions(snapshot.auditContent)
    .filter((permission) => !allowed.permissions.has(permission))
    .map((permission) => ({
      severity: "error" as const,
      area: "ruoyi",
      code: "ruoyi-permission-unverified",
      message: `权限标识缺少项目既有事实或规格证据：${permission}`,
      evidence: snapshot.file,
      suggestion: "权限必须来自后端/菜单配置/相似页面/当前规格，不能在页面里临时编造。"
    }));
}

function findUnknownDictTypes(snapshot: ChangedFileSnapshot, allowed: FactSet): ReviewFinding[] {
  return extractDictTypes(snapshot.auditContent)
    .filter((dictType) => !allowed.dictTypes.has(dictType))
    .map((dictType) => ({
      severity: "error" as const,
      area: "ruoyi",
      code: "ruoyi-dict-type-unverified",
      message: `字典类型缺少项目既有事实或规格证据：${dictType}`,
      evidence: snapshot.file,
      suggestion: "字典类型必须来自项目已有用法、后端字典配置或当前规格。"
    }));
}

function findDirectRequestUsage(snapshot: ChangedFileSnapshot): ReviewFinding[] {
  if (isRequestInfrastructureFile(snapshot.file)) {
    return [];
  }
  if (!/(?:from\s+["']axios["']|require\(["']axios["']\)|\baxios\s*\.|\bfetch\s*\()/u.test(snapshot.auditContent)) {
    return [];
  }
  return [{
    severity: "error",
    area: "ruoyi",
    code: "ruoyi-request-wrapper-bypassed",
    message: "业务代码绕过了项目请求封装，直接使用 axios/fetch。",
    evidence: snapshot.file,
    suggestion: "复用 `src/utils/request` 和目标项目已有 api 模块写法。"
  }];
}

function extractApiPaths(file: string, content: string): string[] {
  return shouldAuditApiPaths(file, content) ? extractPathLiterals(content) : [];
}

function extractPathLiterals(content: string): string[] {
  const paths = new Set<string>();
  for (const match of content.matchAll(/(?:url\s*:\s*)?["'`]((?:\/[a-zA-Z0-9_.$:{}-]+){2,})["'`]|(?:^|\s)((?:\/[a-zA-Z0-9_.$:{}-]+){2,})(?=\s|$|[，。,;；)])/gmu)) {
    const value = normalizeApiPath(match[1] ?? match[2] ?? "");
    if (value !== null) {
      paths.add(value);
    }
  }
  return [...paths].sort();
}

function extractPermissions(content: string): string[] {
  const permissions = new Set<string>();
  for (const match of content.matchAll(/["'`]([a-z][a-z0-9_-]*(?::[a-z0-9_-]+){1,4})["'`]/giu)) {
    const value = match[1] ?? "";
    if (!value.includes("http:") && !value.includes("https:")) {
      permissions.add(value);
    }
  }
  return [...permissions].sort();
}

function extractDictTypes(content: string): string[] {
  const dictTypes = new Set<string>();
  const patterns = [
    /\bdictType\s*[:=]\s*["'`]([a-zA-Z0-9_:-]+)["'`]/gu,
    /\bdict\s*[:=]\s*["'`]([a-zA-Z0-9_:-]+)["'`]/gu
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const value = match[1]?.trim();
      if (value !== undefined && value !== "") {
        dictTypes.add(value);
      }
    }
  }
  for (const match of content.matchAll(/\buseDict\s*\(([^)]*)\)/gsu)) {
    const args = match[1] ?? "";
    for (const arg of args.matchAll(/["'`]([a-zA-Z0-9_:-]+)["'`]/gu)) {
      const value = arg[1]?.trim();
      if (value !== undefined && value !== "") {
        dictTypes.add(value);
      }
    }
  }
  return [...dictTypes].sort();
}

function parseDiffContent(diff: string): { added: Map<string, string>; removed: Map<string, string> } {
  const addedByFile = new Map<string, string[]>();
  const removedByFile = new Map<string, string[]>();
  let currentFile: string | null = null;

  for (const line of diff.split(/\r?\n/u)) {
    const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/u);
    if (header !== null) {
      currentFile = header[2] ?? null;
      if (currentFile !== null) {
        if (!addedByFile.has(currentFile)) {
          addedByFile.set(currentFile, []);
        }
        if (!removedByFile.has(currentFile)) {
          removedByFile.set(currentFile, []);
        }
      }
      continue;
    }
    if (currentFile === null || line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      addedByFile.get(currentFile)?.push(line.slice(1));
    } else if (line.startsWith("-")) {
      removedByFile.get(currentFile)?.push(line.slice(1));
    }
  }

  return {
    added: compactDiffMap(addedByFile),
    removed: compactDiffMap(removedByFile)
  };
}

function compactDiffMap(input: Map<string, string[]>): Map<string, string> {
  return new Map(
    [...input.entries()]
      .filter(([, lines]) => lines.length > 0)
      .map(([file, lines]) => [file, lines.join("\n")])
  );
}

function shouldAuditApiPaths(file: string, content: string): boolean {
  return file.startsWith("src/api/")
    || /\brequest\s*\(|\burl\s*:/u.test(content);
}

function normalizeApiPath(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "/api" || trimmed.startsWith("//")) {
    return null;
  }
  if (/^\/(?:assets|static|img|images|icons|favicon|src)\//u.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/\/+$/u, "");
}

function usesHtwTable(content: string): boolean {
  return /\bHTWTable\b|\bhtw-table\b|<\s*h-t-w-table\b/iu.test(content);
}

function mergeFacts(left: FactSet, right: FactSet): FactSet {
  return {
    apiPaths: new Set([...left.apiPaths, ...right.apiPaths]),
    permissions: new Set([...left.permissions, ...right.permissions]),
    dictTypes: new Set([...left.dictTypes, ...right.dictTypes])
  };
}

function emptyFacts(): FactSet {
  return {
    apiPaths: new Set(),
    permissions: new Set(),
    dictTypes: new Set()
  };
}

async function listSourceFiles(directory: string, relativeDirectory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") {
      continue;
    }
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(absolute, relative));
    } else if (entry.isFile() && isSourceFile(relative)) {
      files.push(relative);
    }
  }
  return files;
}

async function readLimitedText(filePath: string): Promise<string | null> {
  const content = await readFile(filePath, "utf8");
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    return null;
  }
  return content;
}

function isSourceFile(file: string): boolean {
  return file.startsWith("src/") && SOURCE_EXTENSIONS.has(path.extname(file));
}

function isRequestInfrastructureFile(file: string): boolean {
  return /^src\/utils\/request\.[jt]s$/u.test(file) || /^src\/plugins\/request\.[jt]s$/u.test(file);
}

function deduplicate(findings: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.code}\0${finding.message}\0${finding.evidence ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
