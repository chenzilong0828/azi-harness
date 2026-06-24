import path from "node:path";

import {
  readJsonObject,
  type CommandFacts,
  type PackageManager,
  type ProjectProfile
} from "@azi-harness/core";

import {
  runRuntimeDoctor,
  type DoctorReport
} from "./doctor-runtime.js";
import {
  runSkillMatch,
  type SkillMatchReport
} from "./skill-runtime.js";

export interface RunContextOptions {
  root: string;
  task: string;
  includeAvoided?: boolean;
}

export interface ContextDocument {
  root: string;
  task: string;
  project: {
    projectType: string;
    vueMajor: 2 | 3 | null;
    ui: string | null;
    ruoyi: boolean;
    packageManager: string;
    htwTableInstalled: boolean;
  };
  skillMatch: SkillMatchReport;
  readFirst: string[];
  rules: string[];
  specs: {
    root: string;
    instruction: string;
  };
  commands: {
    check: string;
    htwInspect: string | null;
    lint: string | null;
    test: string | null;
    build: string | null;
  };
  guardrails: string[];
  doctor: {
    initialized: boolean;
    errors: string[];
    warnings: string[];
  };
}

export async function createContextDocument(options: RunContextOptions): Promise<ContextDocument> {
  const root = path.resolve(options.root);
  const profile = await readProjectProfile(root);
  const skillMatchOptions: {
    root: string;
    task: string;
    includeAvoided?: boolean;
  } = {
    root,
    task: options.task
  };
  if (options.includeAvoided !== undefined) {
    skillMatchOptions.includeAvoided = options.includeAvoided;
  }

  const skillMatch = await runSkillMatch(skillMatchOptions);
  const doctor = await runRuntimeDoctor(root);

  return {
    root,
    task: options.task,
    project: {
      projectType: profile.effective.projectType.value,
      vueMajor: profile.effective.framework.vueMajor.value,
      ui: profile.effective.framework.ui.value,
      ruoyi: profile.effective.ruoyi.value,
      packageManager: profile.effective.packageManager.value,
      htwTableInstalled: profile.effective.htwTable.installed
    },
    skillMatch,
    readFirst: createReadFirstList(profile),
    rules: createRuleList(profile),
    specs: {
      root: "specs/",
      instruction: "Use the active numbered feature spec under specs/. Create one with `npx azi spec create <feature-name>` if the task is not yet specified."
    },
    commands: createCommandList(
      profile.effective.commands,
      profile.effective.htwTable.installed,
      profile.effective.packageManager.value
    ),
    guardrails: createGuardrails(profile),
    doctor: {
      initialized: doctor.initialized,
      errors: doctor.errors,
      warnings: doctor.warnings
    }
  };
}

async function readProjectProfile(root: string): Promise<ProjectProfile> {
  const value = await readJsonObject(root, ".harness/project.json");
  if (!isProjectProfile(value)) {
    throw new Error("Missing or invalid `.harness/project.json`. Run `npx azi setup . --yes` first.");
  }
  return value;
}

function createReadFirstList(profile: ProjectProfile): string[] {
  const files = [
    "AGENTS.md",
    ".harness/project.json",
    ".harness/skill-map.json",
    ".harness/skill-catalog.json",
    ".harness/docs/skill-hub.md",
    ".agents/skills/README.md",
    "specs/README.md",
    ".harness/rules/project-conventions.md",
    ".harness/rules/quality.md"
  ];

  if (profile.effective.ruoyi.value) {
    files.push(".harness/rules/ruoyi.md");
  }
  if (profile.effective.htwTable.installed) {
    files.push(".harness/rules/htw-table.md");
  }

  files.push(".harness/rules/figma.md");
  return files;
}

function createRuleList(profile: ProjectProfile): string[] {
  const rules = [
    "Follow current project facts from `.harness/project.json`.",
    "Use matched installed Skills first; if none match, follow project rules and specs directly.",
    "Do not copy external Skill bodies into the project.",
    "Do not read or apply `.windsurfrules`.",
    "Do not guess APIs, permission keys, dictionary types, or backend fields.",
    "Run `npx azi check` before delivery."
  ];

  if (profile.effective.ruoyi.value) {
    rules.push("For RuoYi work, reuse request, router, permission, dictionary, pagination, feedback, and download conventions from this project.");
  }

  if (profile.effective.htwTable.installed) {
    rules.push("Before using HTWTable, run `npx azi htw inspect --write-doc` and follow the installed package API evidence.");
  }

  return rules;
}

function createCommandList(
  commands: CommandFacts,
  htwTableInstalled: boolean,
  packageManager: PackageManager
): ContextDocument["commands"] {
  return {
    check: "npx azi check",
    htwInspect: htwTableInstalled ? "npx azi htw inspect --write-doc" : null,
    lint: formatScript(commands.lint[0] ?? null, packageManager),
    test: formatScript(commands.test[0] ?? null, packageManager),
    build: formatScript(commands.build[0] ?? null, packageManager)
  };
}

function createGuardrails(profile: ProjectProfile): string[] {
  const guardrails = [
    "Keep changes scoped to the active task and existing project boundaries.",
    "Record unknown business facts in the spec instead of inventing them.",
    "Treat missing checks as skipped with reasons, not as passed."
  ];

  if (profile.effective.framework.vueMajor.value === 2) {
    guardrails.push("Do not use Vue 3 APIs in this Vue 2 project.");
  } else if (profile.effective.framework.vueMajor.value === 3) {
    guardrails.push("Do not use Vue 2 bootstrap or plugin APIs in this Vue 3 project.");
  }

  return guardrails;
}

function formatScript(script: string | null, packageManager: PackageManager): string | null {
  if (script === null) {
    return null;
  }

  switch (packageManager) {
    case "pnpm":
      return `pnpm run ${script}`;
    case "yarn":
      return `yarn run ${script}`;
    case "bun":
      return `bun run ${script}`;
    case "npm":
    case "unknown":
      return `npm run ${script}`;
  }
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  return isRecord(value)
    && value.schemaVersion === "1"
    && isRecord(value.detected)
    && isRecord(value.effective)
    && Array.isArray(value.overridesApplied);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
