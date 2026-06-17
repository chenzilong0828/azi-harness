import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  rename,
  rmdir,
  stat,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import type {
  RuntimeManifest,
  RuntimeFileIntent,
  RuntimeWritePlan
} from "./types.js";

const MANIFEST_PATH = ".harness/manifest.json";

export async function createRuntimeWritePlan(
  rootInput: string,
  intents: RuntimeFileIntent[]
): Promise<RuntimeWritePlan> {
  const root = path.resolve(rootInput);
  const seen = new Set<string>();
  const entries = [];

  for (const intent of intents) {
    const target = resolveInsideRoot(root, intent.path);
    const normalizedPath = toPortablePath(path.relative(root, target));
    if (seen.has(normalizedPath)) {
      throw new Error(`Duplicate runtime file intent: ${normalizedPath}`);
    }
    seen.add(normalizedPath);

    let existing: string | null = null;
    try {
      existing = await readFile(target, "utf8");
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }

    if (existing === null) {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "create" as const,
        reason: "File does not exist"
      });
    } else if (normalizeText(existing) === normalizeText(intent.content)) {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "skip" as const,
        reason: "Existing content is identical"
      });
    } else {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "conflict" as const,
        reason: "Existing file has different content"
      });
    }
  }

  return {
    root,
    entries,
    hasConflicts: entries.some((entry) => entry.action === "conflict")
  };
}

export async function applyRuntimeWritePlan(plan: RuntimeWritePlan): Promise<string[]> {
  if (plan.hasConflicts) {
    throw new Error("Cannot apply a runtime write plan with conflicts");
  }

  const changedFiles: string[] = [];
  const createdDirectories: string[] = [];

  try {
    for (const entry of plan.entries) {
      if (entry.action !== "create" && entry.action !== "update") {
        continue;
      }

      const target = resolveInsideRoot(plan.root, entry.intent.path);
      await ensureParentDirectories(plan.root, path.dirname(target), createdDirectories);
      const temporary = `${target}.azi-tmp-${randomUUID()}`;
      await writeFile(temporary, normalizeText(entry.intent.content), {
        encoding: "utf8",
        flag: "wx"
      });
      try {
        await rename(temporary, target);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
      changedFiles.push(target);
    }

    for (const entry of plan.entries) {
      if (entry.action !== "delete") {
        continue;
      }

      const target = resolveInsideRoot(plan.root, entry.intent.path);
      try {
        await unlink(target);
      } catch (error) {
        if (!isMissing(error)) {
          throw error;
        }
      }
      await pruneEmptyParentDirectories(plan.root, path.dirname(target));
      changedFiles.push(target);
    }
  } catch (error) {
    await rollbackCreatedPaths(plan.root, changedFiles, createdDirectories);
    throw error;
  }

  return changedFiles.map((file) => toPortablePath(path.relative(plan.root, file)));
}

export async function createRuntimeSyncPlan(
  rootInput: string,
  intents: RuntimeFileIntent[],
  manifest: RuntimeManifest
): Promise<RuntimeWritePlan> {
  const root = path.resolve(rootInput);
  const previousEntries = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const seen = new Set<string>();
  const entries = [];

  for (const intent of intents) {
    const target = resolveInsideRoot(root, intent.path);
    const normalizedPath = toPortablePath(path.relative(root, target));
    if (seen.has(normalizedPath)) {
      throw new Error(`Duplicate runtime file intent: ${normalizedPath}`);
    }
    seen.add(normalizedPath);

    const previous = previousEntries.get(normalizedPath) ?? null;
    const nextContent = normalizeText(intent.content);
    const nextHash = sha256(nextContent);

    let existing: string | null = null;
    try {
      existing = await readFile(target, "utf8");
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }

    if (existing === null) {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "create" as const,
        reason: "Runtime file is missing"
      });
      continue;
    }

    const existingNormalized = normalizeText(existing);
    if (existingNormalized === nextContent) {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "skip" as const,
        reason: "Existing content already matches the current template"
      });
      continue;
    }

    if (intent.ownership === "seeded") {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "skip" as const,
        reason: "Seeded files are never overwritten during sync"
      });
      continue;
    }

    if (previous === null) {
      if (normalizedPath === MANIFEST_PATH) {
        entries.push({
          intent: { ...intent, path: normalizedPath },
          action: "update" as const,
          reason: "Runtime manifest is regenerated on every sync"
        });
        continue;
      }
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "conflict" as const,
        reason: "Existing file is not tracked by the runtime manifest"
      });
      continue;
    }

    const existingHash = sha256(existingNormalized);
    if (existingHash === previous.sha256) {
      entries.push({
        intent: { ...intent, path: normalizedPath },
        action: "update" as const,
        reason: previous.sha256 === nextHash
          ? "Content is unchanged from the previous template"
          : "Managed file can be updated safely"
      });
      continue;
    }

    entries.push({
      intent: { ...intent, path: normalizedPath },
      action: "conflict" as const,
      reason: "Managed file was changed after initialization"
    });
  }

  for (const previous of manifest.files) {
    if (seen.has(previous.path) || previous.path === MANIFEST_PATH || previous.ownership !== "managed") {
      continue;
    }

    const target = resolveInsideRoot(root, previous.path);
    let existing: string | null = null;
    try {
      existing = await readFile(target, "utf8");
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }

    const retiredIntent = {
      path: previous.path,
      content: "",
      ownership: previous.ownership,
      templateVersion: previous.templateVersion
    } satisfies RuntimeFileIntent;

    if (existing === null) {
      entries.push({
        intent: retiredIntent,
        action: "skip" as const,
        reason: "Retired managed file is already missing"
      });
      continue;
    }

    const existingHash = sha256(normalizeText(existing));
    if (existingHash === previous.sha256) {
      entries.push({
        intent: retiredIntent,
        action: "delete" as const,
        reason: "Managed file was retired from the runtime template"
      });
      continue;
    }

    entries.push({
      intent: retiredIntent,
      action: "conflict" as const,
      reason: "Retired managed file was changed after initialization"
    });
  }

  return {
    root,
    entries,
    hasConflicts: entries.some((entry) => entry.action === "conflict")
  };
}

export async function readRuntimeManifest(
  rootInput: string
): Promise<RuntimeManifest | null> {
  const root = path.resolve(rootInput);
  const manifestPath = resolveInsideRoot(root, ".harness/manifest.json");

  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isRuntimeManifest(parsed) ? parsed : null;
  } catch (error) {
    if (isMissing(error) || isSyntaxError(error)) {
      return null;
    }
    throw error;
  }
}

export function sha256(content: string): string {
  return createHash("sha256").update(normalizeText(content), "utf8").digest("hex");
}

export function resolveInsideRoot(rootInput: string, relativePath: string): string {
  if (relativePath.includes("\0") || path.isAbsolute(relativePath)) {
    throw new Error(`Unsafe runtime path: ${relativePath}`);
  }

  const root = path.resolve(rootInput);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Runtime path escapes the project root: ${relativePath}`);
  }
  return target;
}

export function createAppendOnlyPatch(
  relativePath: string,
  existingContent: string,
  appendedContent: string
): string {
  const existing = normalizeText(existingContent).replace(/\n$/, "");
  const addition = normalizeText(appendedContent).replace(/^\n+/, "").replace(/\n$/, "");
  const lineCount = existing === "" ? 0 : existing.split("\n").length;
  const additionLines = addition.split("\n");
  const headerLine = lineCount === 0 ? 1 : lineCount + 1;

  return [
    `--- a/${toPortablePath(relativePath)}`,
    `+++ b/${toPortablePath(relativePath)}`,
    `@@ -${headerLine},0 +${headerLine},${additionLines.length} @@`,
    ...additionLines.map((line) => `+${line}`),
    ""
  ].join("\n");
}

export function createFullFilePatch(
  relativePath: string,
  existingContent: string | null,
  nextContent: string
): string {
  const portablePath = toPortablePath(relativePath);
  const existingLines = existingContent === null ? [] : toPatchLines(existingContent);
  const nextLines = toPatchLines(nextContent);
  const oldHeader = existingContent === null ? "/dev/null" : `a/${portablePath}`;
  const oldStart = existingLines.length === 0 ? 0 : 1;
  const nextStart = nextLines.length === 0 ? 0 : 1;

  return [
    `--- ${oldHeader}`,
    `+++ b/${portablePath}`,
    `@@ -${oldStart},${existingLines.length} +${nextStart},${nextLines.length} @@`,
    ...existingLines.map((line) => `-${line}`),
    ...nextLines.map((line) => `+${line}`),
    ""
  ].join("\n");
}

function normalizeText(content: string): string {
  return `${content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\s+$/, "")}\n`;
}

function toPatchLines(content: string): string[] {
  const normalized = normalizeText(content);
  const withoutFinalNewline = normalized.endsWith("\n")
    ? normalized.slice(0, -1)
    : normalized;
  return withoutFinalNewline === "" ? [] : withoutFinalNewline.split("\n");
}

async function ensureParentDirectories(
  root: string,
  targetDirectory: string,
  createdDirectories: string[]
): Promise<void> {
  const relative = path.relative(root, targetDirectory);
  if (relative === "") {
    return;
  }

  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const currentStat = await stat(current);
      if (!currentStat.isDirectory()) {
        throw new Error(`Expected directory but found a file: ${current}`);
      }
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
      await mkdir(current);
      createdDirectories.push(current);
    }
  }
}

async function rollbackCreatedPaths(
  root: string,
  files: string[],
  directories: string[]
): Promise<void> {
  for (const file of [...files].reverse()) {
    assertResolvedInsideRoot(root, file);
    await unlink(file).catch(() => undefined);
  }
  for (const directory of [...directories].reverse()) {
    assertResolvedInsideRoot(root, directory);
    await rmdir(directory).catch(() => undefined);
  }
}

async function pruneEmptyParentDirectories(root: string, targetDirectory: string): Promise<void> {
  let current = path.resolve(targetDirectory);
  const resolvedRoot = path.resolve(root);

  while (current !== resolvedRoot) {
    try {
      await rmdir(current);
    } catch (error) {
      if (isMissing(error)) {
        current = path.dirname(current);
        continue;
      }
      if (isNodeError(error) && (error.code === "ENOTEMPTY" || error.code === "EEXIST")) {
        break;
      }
      throw error;
    }

    current = path.dirname(current);
  }
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    if (isMissing(error)) {
      return false;
    }
    throw error;
  }
}

function isRuntimeManifest(value: unknown): value is RuntimeManifest {
  if (!isRecord(value)) {
    return false;
  }
  return value.schemaVersion === "1"
    && typeof value.runtimeVersion === "string"
    && Array.isArray(value.files)
    && typeof value.detectionDigest === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertResolvedInsideRoot(rootInput: string, targetInput: string): void {
  const root = path.resolve(rootInput);
  const target = path.resolve(targetInput);
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`Refusing to modify a path outside the project root: ${target}`);
  }
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isMissing(error: unknown): boolean {
  return isNodeError(error) && error.code === "ENOENT";
}

function isSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
