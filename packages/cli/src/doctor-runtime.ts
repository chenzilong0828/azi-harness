import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  applyProjectConfig,
  pathExists,
  readJsonObject,
  readRuntimeManifest,
  validateSkillMap,
  validateSkillCatalog,
  type ProjectProfile,
  resolveInsideRoot,
  sha256
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";

export interface DoctorReport {
  root: string;
  initialized: boolean;
  errors: string[];
  warnings: string[];
}

export async function runRuntimeDoctor(rootInput: string): Promise<DoctorReport> {
  const root = path.resolve(rootInput);
  const manifest = await readRuntimeManifest(root);
  if (manifest === null) {
    return {
      root,
      initialized: false,
      errors: [
        "Missing or invalid `.harness/manifest.json`. Run `npx azi init` first."
      ],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const config = await readJsonObject(root, ".harness/config.json");

  for (const file of manifest.files) {
    const absolutePath = resolveInsideRoot(root, file.path);
    if (!(await pathExists(absolutePath))) {
      errors.push(`Tracked runtime file is missing: ${file.path}`);
      continue;
    }
    if (file.ownership === "managed") {
      const content = await readFile(absolutePath, "utf8");
      if (sha256(content) !== file.sha256) {
        errors.push(`Managed runtime file changed after initialization: ${file.path}. Run \`npx azi sync\` and review conflicts.`);
      }
    }
  }

  const projectProfile = await readProjectProfile(root);
  if (projectProfile === null) {
    errors.push("Missing or invalid `.harness/project.json`.");
  } else {
    const detectedProfile = await detectProject(root);
    const currentDigest = sha256(JSON.stringify(detectedProfile.detected));
    if (currentDigest !== manifest.detectionDigest) {
      warnings.push("Project detection evidence changed. Run `npx azi sync` to refresh the runtime.");
    }

    const applied = applyProjectConfig(detectedProfile, config);
    for (const issue of applied.issues) {
      if (issue.severity === "error") {
        errors.push(issue.message);
      } else {
        warnings.push(issue.message);
      }
    }

    if (!sameProfileContent(projectProfile, applied.profile)) {
      warnings.push("Effective project profile changed. Run `npx azi sync` to refresh `.harness/project.json` and runtime docs.");
    }
  }

  const agentsPath = resolveInsideRoot(root, "AGENTS.md");
  if (await pathExists(agentsPath)) {
    const agents = await readFile(agentsPath, "utf8");
    if (countLines(agents) > 60) {
      warnings.push("`AGENTS.md` is longer than 60 lines and should stay a short entry point.");
    }
  }

  const proposalPath = resolveInsideRoot(root, ".harness/proposals/AGENTS.md.patch");
  if (await pathExists(proposalPath)) {
    warnings.push("An AGENTS proposal patch is waiting in `.harness/proposals/AGENTS.md.patch`.");
  }

  await checkToolAdapters(root, errors, warnings);
  await checkSkillMap(root, errors, warnings);
  await checkSkillCatalog(root, errors, warnings);

  const projectPackage = await readJsonObject(root, "package.json");
  const scripts = isRecord(projectPackage?.scripts) ? projectPackage.scripts : {};
  if (config !== null) {
    const commandConfig = isRecord(config.commands) ? config.commands : {};
    const checksConfig = isRecord(config.checks) ? config.checks : {};
    const commandChecks = isRecord(checksConfig.commands) ? checksConfig.commands : {};
    for (const key of ["lint", "test", "build"] as const) {
      const value = commandConfig[key];
      if (typeof value === "string" && !(value in scripts)) {
        warnings.push(`Configured ${key} command \`${value}\` does not exist in package.json scripts.`);
      }

      const commandCheck = commandChecks[key];
      if (!isRecord(commandCheck)) {
        continue;
      }
      if (commandCheck.enabled === false) {
        const reason = typeof commandCheck.reason === "string" ? commandCheck.reason.trim() : "";
        if (reason === "") {
          warnings.push(`Disabled ${key} command is missing a reason in \`.harness/config.json\`.`);
        }
      }
    }
  }

  return {
    root,
    initialized: true,
    errors,
    warnings
  };
}

async function checkSkillCatalog(
  root: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const skillCatalogPath = resolveInsideRoot(root, ".harness/skill-catalog.json");
  if (!(await pathExists(skillCatalogPath))) {
    warnings.push("Missing `.harness/skill-catalog.json`.");
    return;
  }

  const raw = await readJsonObject(root, ".harness/skill-catalog.json");
  if (raw === null) {
    errors.push("Invalid `.harness/skill-catalog.json`.");
    return;
  }

  const report = validateSkillCatalog(raw);
  errors.push(...report.errors.map((message) => `Skill catalog: ${message}`));
  warnings.push(...report.warnings.map((message) => `Skill catalog: ${message}`));
  if (!report.valid) {
    errors.push("`.harness/skill-catalog.json` failed validation.");
  }
}

async function checkSkillMap(
  root: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const skillMapPath = resolveInsideRoot(root, ".harness/skill-map.json");
  if (!(await pathExists(skillMapPath))) {
    warnings.push("Missing `.harness/skill-map.json`.");
    return;
  }

  const raw = await readJsonObject(root, ".harness/skill-map.json");
  if (raw === null) {
    errors.push("Invalid `.harness/skill-map.json`.");
    return;
  }

  const report = validateSkillMap(raw);
  errors.push(...report.errors.map((message) => `Skill map: ${message}`));
  warnings.push(...report.warnings.map((message) => `Skill map: ${message}`));
  if (!report.valid) {
    errors.push("`.harness/skill-map.json` failed validation.");
  }
}

async function readProjectProfile(root: string): Promise<ProjectProfile | null> {
  const value = await readJsonObject(root, ".harness/project.json");
  return isProjectProfile(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  return isRecord(value)
    && value.schemaVersion === "1"
    && isRecord(value.detected)
    && isRecord(value.effective)
    && Array.isArray(value.overridesApplied);
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

function countLines(text: string): number {
  return text === "" ? 0 : text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").length;
}

async function checkToolAdapters(
  root: string,
  errors: string[],
  warnings: string[]
): Promise<void> {
  const aiToolsPath = resolveInsideRoot(root, ".harness/docs/ai-tools.md");
  if (await pathExists(aiToolsPath)) {
    const aiTools = await readFile(aiToolsPath, "utf8");
    if (!aiTools.includes("AGENTS.md") || !aiTools.includes(".harness/project.json")) {
      warnings.push("`.harness/docs/ai-tools.md` should point tools back to `AGENTS.md` and `.harness/project.json`.");
    }
  }

  const cursorRulePath = resolveInsideRoot(root, ".cursor/rules/azi-harness.mdc");
  if (!(await pathExists(cursorRulePath))) {
    return;
  }

  const cursorRule = await readFile(cursorRulePath, "utf8");
  if (!cursorRule.includes("AGENTS.md")) {
    errors.push("`.cursor/rules/azi-harness.mdc` must point Cursor back to `AGENTS.md`.");
  }
  if (!cursorRule.includes(".harness/project.json")) {
    errors.push("`.cursor/rules/azi-harness.mdc` must point Cursor back to `.harness/project.json`.");
  }
  const hasWindsurfProhibition = cursorRule.includes("Never read or apply `.windsurfrules`.")
    || cursorRule.includes("禁止读取或套用 `.windsurfrules`");
  if (cursorRule.includes(".windsurfrules") && !hasWindsurfProhibition) {
    warnings.push("`.cursor/rules/azi-harness.mdc` mentions `.windsurfrules`; keep it only as a prohibition.");
  }
}
