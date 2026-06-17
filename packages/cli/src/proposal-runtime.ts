import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createFullFilePatch,
  pathExists,
  resolveInsideRoot
} from "@azi-harness/core";

import { prepareRuntimeSynchronization } from "./sync-runtime.js";

export interface ProposalWriteReport {
  root: string;
  written: string[];
  skipped: string[];
}

export async function writeSuggestedRuntimeProposals(
  rootInput: string
): Promise<ProposalWriteReport> {
  const root = path.resolve(rootInput);
  const prepared = await prepareRuntimeSynchronization(root);
  if (prepared.status === "not-initialized" || prepared.plan === null) {
    return {
      root,
      written: [],
      skipped: ["Runtime is not initialized. Run `npx azi init` first."]
    };
  }

  const candidates = prepared.plan.entries.filter((entry) => {
    if (entry.action === "skip") {
      return false;
    }
    if (entry.intent.path.startsWith(".harness/proposals/")) {
      return false;
    }
    return entry.intent.ownership === "managed";
  });

  if (candidates.length === 0) {
    return {
      root,
      written: [],
      skipped: ["No runtime patch suggestions were needed."]
    };
  }

  const patches: string[] = [];
  for (const entry of candidates) {
    const existingContent = await readOptionalText(root, entry.intent.path);
    patches.push(createFullFilePatch(
      entry.intent.path,
      existingContent,
      entry.intent.content
    ));
  }

  const proposalPath = ".harness/proposals/runtime-sync.patch";
  const target = resolveInsideRoot(root, proposalPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, patches.join("\n"), "utf8");

  return {
    root,
    written: [proposalPath],
    skipped: []
  };
}

async function readOptionalText(root: string, relativePath: string): Promise<string | null> {
  const target = resolveInsideRoot(root, relativePath);
  if (!(await pathExists(target))) {
    return null;
  }
  return readFile(target, "utf8");
}
