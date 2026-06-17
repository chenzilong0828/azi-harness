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

export interface HtwInspectArguments {
  root: string;
  json: boolean;
  writeDoc: boolean;
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
