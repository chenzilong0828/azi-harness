import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import type { ScanResult, ScannedFile } from "./types.js";

const IGNORED_DIRECTORIES = new Set([
  ".agents",
  ".cache",
  ".codex",
  ".cursor",
  ".git",
  ".harness",
  ".idea",
  ".opencode",
  ".output",
  ".sanshu-memory",
  ".vscode",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "specs"
]);

const IGNORED_FILES = new Set([".windsurfrules"]);

export interface ScanOptions {
  maxFiles?: number;
}

export async function scanProjectFiles(
  root: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const maxFiles = options.maxFiles ?? 10_000;
  const rootRealPath = await realpath(root);
  const files: ScannedFile[] = [];
  const warnings: string[] = [];
  const directories = [rootRealPath];

  while (directories.length > 0) {
    const current = directories.pop();
    if (current === undefined) {
      break;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      warnings.push(`Cannot read directory ${toRelative(rootRealPath, current)}: ${messageOf(error)}`);
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (IGNORED_FILES.has(entry.name)) {
        continue;
      }

      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        warnings.push(`Skipped symbolic link ${toRelative(rootRealPath, absolutePath)}`);
        continue;
      }

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          directories.push(absolutePath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (files.length >= maxFiles) {
        warnings.push(`File scan stopped at the configured limit of ${maxFiles}`);
        return { files, warnings };
      }

      let stat;
      try {
        stat = await lstat(absolutePath);
      } catch (error) {
        warnings.push(`Cannot inspect ${toRelative(rootRealPath, absolutePath)}: ${messageOf(error)}`);
        continue;
      }

      files.push({
        absolutePath,
        relativePath: toRelative(rootRealPath, absolutePath),
        size: stat.size
      });
    }
  }

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return { files, warnings };
}

export async function readUtf8File(
  file: ScannedFile,
  maxBytes = 512 * 1024
): Promise<string | null> {
  if (file.size > maxBytes) {
    return null;
  }
  try {
    return await readFile(file.absolutePath, "utf8");
  } catch {
    return null;
  }
}

export async function readJsonObject(
  root: string,
  relativePath: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(path.join(root, relativePath), "utf8");
    const value: unknown = JSON.parse(raw);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRelative(root: string, target: string): string {
  const relative = path.relative(root, target);
  return relative === "" ? "." : relative.split(path.sep).join("/");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
