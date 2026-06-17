import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  applyRuntimeWritePlan,
  createAppendOnlyPatch,
  createRuntimeWritePlan,
  type ProjectProfile,
  type RuntimeWritePlan
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";
import {
  createAgentsEntry,
  createRuntimeIntents
} from "@azi-harness/runtime-templates";

export interface PreparedInitialization {
  status: "ready" | "already-initialized";
  root: string;
  profile: ProjectProfile | null;
  plan: RuntimeWritePlan | null;
}

export async function prepareRuntimeInitialization(
  rootInput: string
): Promise<PreparedInitialization> {
  const root = path.resolve(rootInput);
  if (await exists(path.join(root, ".harness", "manifest.json"))) {
    return {
      status: "already-initialized",
      root,
      profile: null,
      plan: null
    };
  }

  const profile = await detectProject(root);
  const existingAgents = await readOptionalText(path.join(root, "AGENTS.md"));
  const hasHarnessEntry = existingAgents?.includes("## azi-harness") ?? false;
  const agentsProposal = existingAgents !== null && !hasHarnessEntry
    ? createAppendOnlyPatch(
      "AGENTS.md",
      existingAgents,
      `\n${createAgentsEntry(profile)}`
    )
    : null;

  const intents = createRuntimeIntents(profile, {
    includeAgents: existingAgents === null,
    agentsProposal
  });
  const plan = await createRuntimeWritePlan(root, intents);

  return {
    status: "ready",
    root,
    profile,
    plan
  };
}

export async function applyPreparedInitialization(
  prepared: PreparedInitialization
): Promise<string[]> {
  if (prepared.status !== "ready" || prepared.plan === null) {
    return [];
  }
  return applyRuntimeWritePlan(prepared.plan);
}

async function readOptionalText(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

