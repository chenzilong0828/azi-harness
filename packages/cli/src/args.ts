export interface DetectArguments {
  root: string;
  json: boolean;
  explain: boolean;
}

export interface InitArguments {
  root: string;
  yes: boolean;
  dryRun: boolean;
}

export interface SyncArguments {
  root: string;
  yes: boolean;
  dryRun: boolean;
}

export interface SetupArguments {
  root: string;
  yes: boolean;
  dryRun: boolean;
}

export interface DoctorArguments {
  root: string;
  json: boolean;
  writeProposals: boolean;
}

export interface CheckArguments {
  root: string;
  json: boolean;
  quick: boolean;
  writeProposals: boolean;
}

export interface ContextArguments {
  root: string;
  task: string;
  json: boolean;
  includeAvoided: boolean;
}

export interface TaskArguments {
  root: string;
  task: string;
  json: boolean;
  apply: boolean;
  includeAvoided: boolean;
}

export interface HtwInspectArguments {
  root: string;
  json: boolean;
  writeDoc: boolean;
}

export interface SkillMatchArguments {
  root: string;
  task: string;
  json: boolean;
  limit: number;
  includeAvoided: boolean;
}

export interface SkillListArguments {
  root: string;
  json: boolean;
  category: string | null;
  enabledOnly: boolean;
}

export interface SkillSearchArguments {
  root: string;
  keyword: string;
  json: boolean;
}

export interface SkillDoctorArguments {
  root: string;
  json: boolean;
}

export interface SkillSourcesArguments {
  root: string;
  json: boolean;
}

export interface SkillInstallGuideArguments {
  root: string;
  sourceId: string;
  json: boolean;
}

export interface WorkflowStartArguments {
  root: string;
  featureName: string;
  task: string;
  slug: string | null;
  json: boolean;
  dryRun: boolean;
  yes: boolean;
  includeAvoided: boolean;
}

export interface WorkflowStatusArguments {
  root: string;
  json: boolean;
}

export interface WorkflowAdvanceArguments {
  root: string;
  target: string;
  to: string;
  force: boolean;
  reason: string | null;
  json: boolean;
}

export interface WorkflowLogArguments {
  root: string;
  target: string;
  json: boolean;
}

export interface ReviewArguments {
  root: string;
  target?: string;
  json: boolean;
  write: boolean;
  ci: boolean;
  quick: boolean;
  diff: boolean;
  evidence: boolean;
  suggestPatch: boolean;
}

export interface SddArguments {
  root: string;
  target: string;
  json: boolean;
  write: boolean;
}

export interface FigmaSpecArguments {
  root: string;
  target: string;
  url: string;
  json: boolean;
  write: boolean;
}

export interface FigmaImportArguments {
  root: string;
  url: string;
  featureName: string | null;
  slug: string | null;
  yes: boolean;
  apply: boolean;
  json: boolean;
  includeAvoided: boolean;
}

export interface FigmaTargetArguments {
  root: string;
  target: string;
  json: boolean;
}

export interface FigmaFallbackArguments {
  root: string;
  target: string;
  source: "figma-export" | "screenshot" | "legacy-page";
  reference: string;
  retriedAt: string | null;
  notes: string | null;
  json: boolean;
  write: boolean;
}

export interface SpecCreateArguments {
  root: string;
  featureName: string;
  dryRun: boolean;
  yes: boolean;
}

export interface SpecValidateArguments {
  root: string;
  target?: string;
  json: boolean;
}

export function parseDetectArguments(args: string[]): DetectArguments {
  let root = ".";
  let json = false;
  let explain = false;

  for (const argument of args) {
    if (argument === "--json") {
      json = true;
    } else if (argument === "--explain") {
      explain = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root !== ".") {
      throw new Error("detect accepts only one project path");
    } else {
      root = argument;
    }
  }

  return { root, json, explain };
}

export function parseInitArguments(args: string[]): InitArguments {
  return parseRootYesDryRunArguments(args, "init");
}

export function parseSyncArguments(args: string[]): SyncArguments {
  return parseRootYesDryRunArguments(args, "sync");
}

export function parseSetupArguments(args: string[]): SetupArguments {
  return parseRootYesDryRunArguments(args, "setup");
}

function parseRootYesDryRunArguments(
  args: string[],
  command: "init" | "sync" | "setup"
): {
  root: string;
  yes: boolean;
  dryRun: boolean;
} {
  let root = ".";
  let yes = false;
  let dryRun = false;

  for (const argument of args) {
    if (argument === "--yes" || argument === "-y") {
      yes = true;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root !== ".") {
      throw new Error(`${command} accepts only one project path`);
    } else {
      root = argument;
    }
  }

  return { root, yes, dryRun };
}

export function parseDoctorArguments(args: string[]): DoctorArguments {
  let root = ".";
  let json = false;
  let writeProposals = false;

  for (const argument of args) {
    if (argument === "--json") {
      json = true;
    } else if (argument === "--write-proposals") {
      writeProposals = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root !== ".") {
      throw new Error("doctor accepts only one project path");
    } else {
      root = argument;
    }
  }

  return { root, json, writeProposals };
}

export function parseCheckArguments(args: string[]): CheckArguments {
  let root = ".";
  let json = false;
  let quick = false;
  let writeProposals = false;

  for (const argument of args) {
    if (argument === "--json") {
      json = true;
    } else if (argument === "--quick") {
      quick = true;
    } else if (argument === "--write-proposals") {
      writeProposals = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root !== ".") {
      throw new Error("check accepts only one project path");
    } else {
      root = argument;
    }
  }

  return { root, json, quick, writeProposals };
}

export function parseContextArguments(args: string[]): ContextArguments {
  let root = ".";
  let task: string | null = null;
  let json = false;
  let includeAvoided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--include-avoided") {
      includeAvoided = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (task === null) {
      task = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("context accepts a task description and an optional root path");
    }
  }

  if (task === null) {
    throw new Error("Usage: azi context <task-description> [root] [--json] [--include-avoided]");
  }

  return { root, task, json, includeAvoided };
}

export function parseTaskArguments(args: string[]): TaskArguments {
  let root = ".";
  let task: string | null = null;
  let json = false;
  let apply = false;
  let includeAvoided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--apply") {
      apply = true;
    } else if (argument === "--include-avoided") {
      includeAvoided = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (task === null) {
      task = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("task accepts a user task and an optional project path");
    }
  }

  if (task === null || task.trim() === "") {
    throw new Error("Usage: azi task <user-task> [root] [--apply] [--json] [--include-avoided]");
  }

  return { root, task, json, apply, includeAvoided };
}

export function parseHtwInspectArguments(args: string[]): HtwInspectArguments {
  let root = ".";
  let json = false;
  let writeDoc = false;

  for (const argument of args) {
    if (argument === "--json") {
      json = true;
    } else if (argument === "--write-doc") {
      writeDoc = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root !== ".") {
      throw new Error("htw inspect accepts only one project path");
    } else {
      root = argument;
    }
  }

  return { root, json, writeDoc };
}

export function parseSkillMatchArguments(args: string[]): SkillMatchArguments {
  let root = ".";
  let task: string | null = null;
  let json = false;
  let limit = 5;
  let includeAvoided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--include-avoided") {
      includeAvoided = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--limit") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --limit");
      }
      limit = parsePositiveInteger(value, "--limit");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (task === null) {
      task = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("skill match accepts a task description and an optional root path");
    }
  }

  if (task === null) {
    throw new Error("Usage: azi skill match <task-description> [root] [--json] [--limit <n>] [--include-avoided]");
  }

  return { root, task, json, limit, includeAvoided };
}

export function parseSkillListArguments(args: string[]): SkillListArguments {
  let root = ".";
  let json = false;
  let category: string | null = null;
  let enabledOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--enabled-only") {
      enabledOnly = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument === "--category") {
      category = readOptionValue(args, index, "--category");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("skill list accepts only one project path");
    }
  }
  return { root, json, category, enabledOnly };
}

export function parseSkillSearchArguments(args: string[]): SkillSearchArguments {
  const parsed = parseSkillValueArguments(args, "search", "keyword");
  return { root: parsed.root, keyword: parsed.value, json: parsed.json };
}

export function parseSkillDoctorArguments(args: string[]): SkillDoctorArguments {
  return parseRootJsonArguments(args, "skill doctor");
}

export function parseSkillSourcesArguments(args: string[]): SkillSourcesArguments {
  return parseRootJsonArguments(args, "skill sources");
}

export function parseSkillInstallGuideArguments(args: string[]): SkillInstallGuideArguments {
  const parsed = parseSkillValueArguments(args, "install-guide", "source-id");
  return { root: parsed.root, sourceId: parsed.value, json: parsed.json };
}

export function parseWorkflowStartArguments(args: string[]): WorkflowStartArguments {
  let root = ".";
  let featureName: string | null = null;
  let task: string | null = null;
  let slug: string | null = null;
  let json = false;
  let dryRun = false;
  let yes = false;
  let includeAvoided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--yes" || argument === "-y") {
      yes = true;
    } else if (argument === "--include-avoided") {
      includeAvoided = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--task") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --task");
      }
      task = value;
      index += 1;
    } else if (argument === "--slug") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --slug");
      }
      slug = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (featureName === null) {
      featureName = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("workflow start accepts a feature name and an optional root path");
    }
  }

  if (featureName === null) {
    throw new Error("Usage: azi workflow start <feature-name> [root] [--task <description>] [--slug <feature-slug>] [--dry-run] [--yes] [--json]");
  }

  return {
    root,
    featureName,
    task: task ?? featureName,
    slug,
    json,
    dryRun,
    yes,
    includeAvoided
  };
}

export function parseWorkflowStatusArguments(args: string[]): WorkflowStatusArguments {
  let root = ".";
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("workflow status accepts only one project path");
    }
  }

  return { root, json };
}

export function parseWorkflowAdvanceArguments(args: string[]): WorkflowAdvanceArguments {
  let root = ".";
  let target: string | null = null;
  let to: string | null = null;
  let force = false;
  let reason: string | null = null;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--force") {
      force = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--target") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --target");
      }
      target = value;
      index += 1;
    } else if (argument === "--to") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --to");
      }
      to = value;
      index += 1;
    } else if (argument === "--reason") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --reason");
      }
      reason = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("workflow advance accepts one optional project path plus --target and --to");
    }
  }

  if (target === null || to === null) {
    throw new Error("Usage: azi workflow advance [root] --target <spec-path> --to <stage> [--force --reason <text>] [--json]");
  }

  return { root, target, to, force, reason, json };
}

export function parseWorkflowLogArguments(args: string[]): WorkflowLogArguments {
  let root = ".";
  let target: string | null = null;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--target") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --target");
      }
      target = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("workflow log accepts one optional project path plus --target <spec-path>");
    }
  }

  if (target === null) {
    throw new Error("Usage: azi workflow log [root] --target <spec-path> [--json]");
  }

  return { root, target, json };
}

export function parseReviewArguments(args: string[]): ReviewArguments {
  let root = ".";
  let target: string | undefined;
  let json = false;
  let write = false;
  let ci = false;
  let quick = true;
  let diff = false;
  let evidence = false;
  let suggestPatch = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--ci") {
      ci = true;
      diff = true;
      evidence = true;
    } else if (argument === "--full") {
      quick = false;
    } else if (argument === "--diff") {
      diff = true;
    } else if (argument === "--evidence") {
      evidence = true;
    } else if (argument === "--suggest-patch") {
      suggestPatch = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--target") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --target");
      }
      target = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("review accepts only one project path plus --target <spec-path>");
    }
  }

  return target === undefined
    ? { root, json, write, ci, quick, diff, evidence, suggestPatch }
    : { root, target, json, write, ci, quick, diff, evidence, suggestPatch };
}

export function parseSddArguments(args: string[], subcommand: string): SddArguments {
  let root = ".";
  let target: string | null = null;
  let json = false;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument === "--target") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --target");
      }
      target = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error(`sdd ${subcommand} accepts one optional project path plus --target <spec-path>`);
    }
  }

  if (target === null) {
    throw new Error(`Usage: azi sdd ${subcommand} [root] --target <spec-path> [--write] [--json]`);
  }

  return { root, target, json, write };
}

export function parseFigmaSpecArguments(args: string[]): FigmaSpecArguments {
  let root = ".";
  let target: string | null = null;
  let url: string | null = null;
  let json = false;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument === "--target") {
      target = readOptionValue(args, index, "--target");
      index += 1;
    } else if (argument === "--url") {
      url = readOptionValue(args, index, "--url");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("figma spec accepts one optional project path plus --target and --url");
    }
  }

  if (target === null || url === null) {
    throw new Error("Usage: azi figma spec [root] --target <spec-path> --url <figma-node-url> [--write] [--json]");
  }
  return { root, target, url, json, write };
}

export function parseFigmaImportArguments(args: string[]): FigmaImportArguments {
  let root = ".";
  let url: string | null = null;
  let featureName: string | null = null;
  let slug: string | null = null;
  let yes = false;
  let apply = false;
  let json = false;
  let includeAvoided = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--yes" || argument === "-y") {
      yes = true;
    } else if (argument === "--apply") {
      apply = true;
    } else if (argument === "--include-avoided") {
      includeAvoided = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument === "--feature") {
      featureName = readOptionValue(args, index, "--feature");
      index += 1;
    } else if (argument === "--slug") {
      slug = readOptionValue(args, index, "--slug");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (url === null) {
      url = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("figma import accepts a Figma URL and an optional project path");
    }
  }

  if (url === null) {
    throw new Error("Usage: azi figma <figma-node-url> [root] [--feature <name>] [--slug <feature-slug>] [--yes] [--apply] [--json]");
  }
  return { root, url, featureName, slug, yes, apply, json, includeAvoided };
}

export function parseFigmaTargetArguments(args: string[], subcommand: "cache" | "status"): FigmaTargetArguments {
  let root = ".";
  let target: string | null = null;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument === "--target") {
      target = readOptionValue(args, index, "--target");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error(`figma ${subcommand} accepts one optional project path plus --target`);
    }
  }

  if (target === null) {
    throw new Error(`Usage: azi figma ${subcommand} [root] --target <spec-path> [--json]`);
  }
  return { root, target, json };
}

export function parseFigmaFallbackArguments(args: string[]): FigmaFallbackArguments {
  let root = ".";
  let target: string | null = null;
  let source: FigmaFallbackArguments["source"] | null = null;
  let reference: string | null = null;
  let retriedAt: string | null = null;
  let notes: string | null = null;
  let json = false;
  let write = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--write") {
      write = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument === "--target") {
      target = readOptionValue(args, index, "--target");
      index += 1;
    } else if (argument === "--source") {
      const value = readOptionValue(args, index, "--source");
      if (value !== "figma-export" && value !== "screenshot" && value !== "legacy-page") {
        throw new Error("--source must be one of figma-export, screenshot, legacy-page");
      }
      source = value;
      index += 1;
    } else if (argument === "--reference") {
      reference = readOptionValue(args, index, "--reference");
      index += 1;
    } else if (argument === "--retried-at") {
      retriedAt = readOptionValue(args, index, "--retried-at");
      index += 1;
    } else if (argument === "--notes") {
      notes = readOptionValue(args, index, "--notes");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("figma fallback accepts one optional project path plus --target, --source, and --reference");
    }
  }

  if (target === null || source === null || reference === null) {
    throw new Error("Usage: azi figma fallback [root] --target <spec-path> --source <figma-export|screenshot|legacy-page> --reference <path-or-url> [--retried-at <time>] [--notes <text>] [--write] [--json]");
  }
  return { root, target, source, reference, retriedAt, notes, json, write };
}

export function parseSpecCreateArguments(args: string[]): SpecCreateArguments {
  let root = ".";
  let featureName: string | null = null;
  let dryRun = false;
  let yes = false;

  for (const argument of args) {
    if (argument === "--dry-run") {
      dryRun = true;
    } else if (argument === "--yes" || argument === "-y") {
      yes = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (featureName === null) {
      featureName = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error("spec create accepts only a feature name and an optional root path");
    }
  }

  if (featureName === null) {
    throw new Error("Usage: azi spec create <feature-name> [root] [--dry-run] [--yes]");
  }

  return { root, featureName, dryRun, yes };
}

export function parseSpecValidateArguments(args: string[]): SpecValidateArguments {
  let root = ".";
  let target: string | undefined;
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new Error("Missing value for --root");
      }
      root = value;
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (target === undefined) {
      target = argument;
    } else {
      throw new Error("spec validate accepts one optional target plus --root <path>");
    }
  }

  return target === undefined ? { root, json } : { root, target, json };
}

function parseRootJsonArguments(
  args: string[],
  command: string
): { root: string; json: boolean } {
  let root = ".";
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error(`${command} accepts only one project path`);
    }
  }
  return { root, json };
}

function parseSkillValueArguments(
  args: string[],
  command: "search" | "install-guide",
  valueLabel: "keyword" | "source-id"
): { root: string; value: string; json: boolean } {
  let root = ".";
  let value: string | null = null;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--json") {
      json = true;
    } else if (argument === "--root") {
      root = readOptionValue(args, index, "--root");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}`);
    } else if (value === null) {
      value = argument;
    } else if (root === ".") {
      root = argument;
    } else {
      throw new Error(`skill ${command} accepts one ${valueLabel} and an optional project path`);
    }
  }
  if (value === null || value.trim() === "") {
    throw new Error(`Usage: azi skill ${command} <${valueLabel}> [root] [--json]`);
  }
  return { root, value, json };
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parsePositiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}
