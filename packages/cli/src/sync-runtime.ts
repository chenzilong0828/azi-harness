import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  applyProjectConfig,
  createAppendOnlyPatch,
  createRuntimeSyncPlan,
  pathExists,
  readJsonObject,
  readRuntimeManifest,
  sha256,
  type ProjectProfile,
  type RuntimeWritePlan
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";
import {
  RUNTIME_VERSION,
  createAgentsEntry,
  createRuntimeIntents
} from "@azi-harness/runtime-templates";

export interface PreparedSynchronization {
  status: "ready" | "not-initialized";
  root: string;
  profile: ProjectProfile | null;
  plan: RuntimeWritePlan | null;
}

export async function prepareRuntimeSynchronization(
  rootInput: string
): Promise<PreparedSynchronization> {
  const root = path.resolve(rootInput);
  const manifest = await readRuntimeManifest(root);
  if (manifest === null) {
    return {
      status: "not-initialized",
      root,
      profile: null,
      plan: null
    };
  }

  const detectedProfile = await detectProject(root);
  const config = await readJsonObject(root, ".harness/config.json");
  const { profile } = applyProjectConfig(detectedProfile, config);
  const previousProfile = await readProjectProfile(root);
  if (previousProfile !== null && sameProfileContent(previousProfile, profile)) {
    profile.generatedAt = previousProfile.generatedAt;
  }

  const existingAgents = await readOptionalText(path.join(root, "AGENTS.md"));
  const trackedAgents = manifest.files.some((entry) => entry.path === "AGENTS.md");
  const includeAgents = trackedAgents || existingAgents === null;
  const agentsProposal = !includeAgents
    && existingAgents !== null
    && !existingAgents.includes("## azi-harness")
    ? createAppendOnlyPatch(
      "AGENTS.md",
      existingAgents,
      `\n${createAgentsEntry(profile)}`
    )
    : null;

  const templateOptions = {
    includeAgents,
    agentsProposal
  };
  let intents = createRuntimeIntents(profile, templateOptions);
  if (canReuseManifestTimestamp(manifest, profile, intents)) {
    intents = createRuntimeIntents(profile, {
      ...templateOptions,
      manifestGeneratedAt: manifest.generatedAt
    });
  }
  const plan = await createRuntimeSyncPlan(root, intents, manifest);

  return {
    status: "ready",
    root,
    profile,
    plan
  };
}

async function readOptionalText(file: string): Promise<string | null> {
  if (!(await pathExists(file))) {
    return null;
  }
  return readFile(file, "utf8");
}

async function readProjectProfile(root: string): Promise<ProjectProfile | null> {
  const file = path.join(root, ".harness/project.json");
  if (!(await pathExists(file))) {
    return null;
  }

  try {
    const raw = await readFile(file, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isProjectProfile(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function sameProfileContent(left: ProjectProfile, right: ProjectProfile): boolean {
  return JSON.stringify({
    schemaVersion: left.schemaVersion,
    root: left.root,
    detected: left.detected,
    effective: left.effective,
    overridesApplied: left.overridesApplied
  }) === JSON.stringify({
    schemaVersion: right.schemaVersion,
    root: right.root,
    detected: right.detected,
    effective: right.effective,
    overridesApplied: right.overridesApplied
  });
}

function canReuseManifestTimestamp(
  manifest: { generatedAt: string; runtimeVersion: string; files: Array<{ path: string; sha256: string; ownership: string; templateVersion: string | null }>; detectionDigest: string },
  profile: ProjectProfile,
  intents: Array<{ path: string; content: string; ownership: string; templateVersion: string | null }>
): boolean {
  const trackedIntents = intents.filter((intent) => intent.path !== ".harness/manifest.json");
  if (manifest.runtimeVersion !== RUNTIME_VERSION) {
    return false;
  }
  if (manifest.detectionDigest !== sha256(JSON.stringify(profile.detected))) {
    return false;
  }
  if (manifest.files.length !== trackedIntents.length) {
    return false;
  }

  const previous = new Map(manifest.files.map((entry) => [entry.path, entry]));
  return trackedIntents.every((intent) => {
    const match = previous.get(intent.path);
    return match !== undefined
      && match.ownership === intent.ownership
      && match.templateVersion === intent.templateVersion
      && match.sha256 === sha256(intent.content);
  });
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  return typeof value === "object"
    && value !== null
    && "schemaVersion" in value
    && "generatedAt" in value
    && "detected" in value
    && "effective" in value
    && "overridesApplied" in value;
}
