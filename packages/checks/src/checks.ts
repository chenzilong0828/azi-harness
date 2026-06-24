import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { PackageManager, ProjectProfile } from "@azi-harness/core";
import {
  applyProjectConfig,
  isRecord,
  pathExists,
  readJsonObject,
  readUtf8File,
  resolveInsideRoot,
  scanProjectFiles
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";
import {
  summarizeSpecValidation,
  validateSpecs,
  type SpecValidationReport
} from "@azi-harness/spec-kit";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue"]);
const COMMAND_ROLES = ["lint", "test", "build"] as const;

type CommandRole = typeof COMMAND_ROLES[number];
type CommandSource = "config" | "detected" | "missing";
type CommandStatus = "passed" | "failed" | "skipped";
type CommandScope = "all" | "changed-source";

export interface RuleFinding {
  ruleId: string;
  file: string;
  message: string;
}

export interface SpecCheckReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reports: SpecValidationReport[];
}

export interface RuleCheckReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  findings: RuleFinding[];
}

export interface ProjectCommandResult {
  role: CommandRole;
  status: CommandStatus;
  command: string;
  script: string | null;
  source: CommandSource;
  reason: string | null;
  exitCode: number | null;
  durationMs: number;
  output: string | null;
}

export interface CommandCheckReport {
  skipped: boolean;
  skipReason: string | null;
  valid: boolean;
  errors: string[];
  warnings: string[];
  packageManager: PackageManager | "unknown";
  results: ProjectCommandResult[];
}

export interface IntegratedCheckReport {
  root: string;
  quick: boolean;
  valid: boolean;
  errors: number;
  warnings: number;
  specs: SpecCheckReport;
  rules: RuleCheckReport;
  commands: CommandCheckReport;
}

export interface IntegratedCheckOptions {
  quick?: boolean;
  env?: NodeJS.ProcessEnv;
}

export async function runIntegratedChecks(
  rootInput: string,
  options: IntegratedCheckOptions = {}
): Promise<IntegratedCheckReport> {
  const root = path.resolve(rootInput);
  const quick = options.quick ?? false;
  const profile = await loadCurrentProjectProfile(root);

  const specs = await runSpecChecks(root);
  const rules = profile === null
    ? {
        valid: true,
        errors: [],
        warnings: ["Skipped project rule checks because `.harness/project.json` is unavailable."],
        findings: []
      }
    : await runRuleChecks(root, profile);
  const commands = quick
    ? createSkippedCommandReport("Project commands were skipped by `azi check --quick`.")
    : profile === null
      ? createSkippedCommandReport("Project commands were skipped because `.harness/project.json` is unavailable.")
      : await runProjectCommandChecks(root, profile, options.env ?? process.env);

  const errorCount = specs.errors.length + rules.errors.length + commands.errors.length;
  const warningCount = specs.warnings.length + rules.warnings.length + commands.warnings.length;

  return {
    root,
    quick,
    valid: errorCount === 0,
    errors: errorCount,
    warnings: warningCount,
    specs,
    rules,
    commands
  };
}

async function runSpecChecks(root: string): Promise<SpecCheckReport> {
  const specsRoot = resolveInsideRoot(root, "specs");
  if (!(await pathExists(specsRoot))) {
    return {
      valid: true,
      errors: [],
      warnings: ["No `specs/` directory was found."],
      reports: []
    };
  }

  const entries = await readdir(specsRoot, { withFileTypes: true });
  const specDirectories = entries.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name));
  if (specDirectories.length === 0) {
    return {
      valid: true,
      errors: [],
      warnings: ["No numbered feature specs were found under `specs/`."],
      reports: []
    };
  }

  const reports = await validateSpecs(root, "specs");
  const summary = summarizeSpecValidation(reports);

  return {
    valid: summary.valid,
    errors: reports.flatMap((report) => report.errors),
    warnings: reports.flatMap((report) => report.warnings),
    reports
  };
}

async function runRuleChecks(root: string, profile: ProjectProfile): Promise<RuleCheckReport> {
  const warnings: string[] = [];
  const findings: RuleFinding[] = [];
  const scan = await scanProjectFiles(root, { maxFiles: 10_000 });
  warnings.push(...scan.warnings);

  const vueMajor = profile.effective.framework.vueMajor.value;
  const patterns = vueMajor === 2
    ? [
        {
          ruleId: "vue2-no-createapp",
          regex: /\bcreateApp\s*\(/,
          message: "Vue 2 project appears to use the Vue 3 `createApp` API."
        },
        {
          ruleId: "vue2-no-script-setup",
          regex: /<script\s+setup\b/,
          message: "Vue 2 project appears to use `<script setup>`."
        }
      ]
    : vueMajor === 3
      ? [
          {
            ruleId: "vue3-no-new-vue",
            regex: /\bnew\s+Vue\s*\(/,
            message: "Vue 3 project appears to use the legacy `new Vue(...)` bootstrap pattern."
          },
          {
            ruleId: "vue3-no-vue-use",
            regex: /\bVue\.use\s*\(/,
            message: "Vue 3 project appears to use the Vue 2 `Vue.use(...)` plugin pattern."
          }
        ]
      : [];

  if (patterns.length === 0) {
    warnings.push("Skipped Vue API boundary checks because the Vue major version is unknown.");
  } else {
    for (const file of scan.files) {
      if (!isSourceFile(file.relativePath)) {
        continue;
      }

      const content = await readUtf8File(file);
      if (content === null) {
        continue;
      }

      for (const pattern of patterns) {
        if (!pattern.regex.test(content)) {
          continue;
        }

        findings.push({
          ruleId: pattern.ruleId,
          file: file.relativePath,
          message: pattern.message
        });
        warnings.push(`${file.relativePath}: ${pattern.message}`);
      }
    }
  }

  if (profile.effective.ruoyi.value && profile.effective.framework.vueMajor.value === 3) {
    warnings.push(...await findHtwPlaceholderWarnings(root));
  }

  return {
    valid: true,
    errors: [],
    warnings,
    findings
  };
}

async function runProjectCommandChecks(
  root: string,
  profile: ProjectProfile,
  env: NodeJS.ProcessEnv
): Promise<CommandCheckReport> {
  const config = await readJsonObject(root, ".harness/config.json");
  const projectPackage = await readJsonObject(root, "package.json");
  const scripts = isRecord(projectPackage?.scripts) ? projectPackage.scripts : {};
  const checksConfig = isRecord(config?.checks) ? config.checks : {};
  const runProjectCommands = typeof checksConfig.runProjectCommands === "boolean"
    ? checksConfig.runProjectCommands
    : true;
  const packageManager = normalizePackageManager(profile.effective.packageManager.value);

  if (!runProjectCommands) {
    const results = COMMAND_ROLES.map((role) => createSkippedCommandResult(
      role,
      resolveCommandSelection(role, profile, config),
      "Project command execution is disabled in `.harness/config.json`.",
      packageManager
    ));

    return {
      skipped: false,
      skipReason: null,
      valid: true,
      errors: [],
      warnings: [],
      packageManager,
      results
    };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const results: ProjectCommandResult[] = [];
  const changedSourceFilesByRole = new Map<CommandRole, string[]>();

  for (const role of COMMAND_ROLES) {
    const selection = resolveCommandSelection(role, profile, config);
    if (!selection.enabled) {
      if (selection.reason === null) {
        warnings.push(`Disabled ${role} command is missing a reason in \`.harness/config.json\`.`);
      }
      results.push(createSkippedCommandResult(
        role,
        selection,
        selection.reason ?? `The ${role} command is disabled in \`.harness/config.json\`.`,
        packageManager
      ));
      continue;
    }

    if (selection.script === null) {
      results.push(createSkippedCommandResult(
        role,
        selection,
        `No ${role} command was detected or configured.`,
        packageManager
      ));
      continue;
    }

    if (!(selection.script in scripts)) {
      warnings.push(`Configured ${role} command \`${selection.script}\` does not exist in package.json scripts.`);
      results.push(createSkippedCommandResult(
        role,
        selection,
        `package.json does not define the script \`${selection.script}\`.`,
        packageManager
      ));
      continue;
    }

    const extraArgs = await resolveCommandArguments(root, role, selection.scope, changedSourceFilesByRole);
    if (selection.scope === "changed-source" && extraArgs.length === 0) {
      results.push(createSkippedCommandResult(
        role,
        selection,
        `No changed source files were found for the ${role} command.`,
        packageManager
      ));
      continue;
    }

    const command = formatPackageManagerCommand(packageManager, selection.script, extraArgs);
    const execution = await runPackageScript(root, packageManager, selection.script, env, extraArgs);
    const result: ProjectCommandResult = {
      role,
      status: execution.exitCode === 0 ? "passed" : "failed",
      command,
      script: selection.script,
      source: selection.source,
      reason: null,
      exitCode: execution.exitCode,
      durationMs: execution.durationMs,
      output: execution.output
    };

    if (result.status === "failed") {
      errors.push(`${role} command failed: ${command}`);
    }

    results.push(result);
  }

  return {
    skipped: false,
    skipReason: null,
    valid: errors.length === 0,
    errors,
    warnings,
    packageManager,
    results
  };
}

function resolveCommandSelection(
  role: CommandRole,
  profile: ProjectProfile,
  config: Record<string, unknown> | null
): {
  script: string | null;
  source: CommandSource;
  enabled: boolean;
  reason: string | null;
  scope: CommandScope;
} {
  const commandConfig = isRecord(config?.commands) ? config.commands : {};
  const checksConfig = isRecord(config?.checks) ? config.checks : {};
  const commandChecks = isRecord(checksConfig.commands) ? checksConfig.commands : {};
  const commandCheck = isRecord(commandChecks[role]) ? commandChecks[role] : null;
  const configuredScript = typeof commandConfig[role] === "string" ? commandConfig[role] : null;
  const detectedScript = profile.effective.commands[role][0] ?? null;
  const enabled = commandCheck?.enabled === false ? false : true;
  const reason = typeof commandCheck?.reason === "string" && commandCheck.reason.trim() !== ""
    ? commandCheck.reason.trim()
    : null;
  const scope = commandCheck?.scope === "changed-source" ? "changed-source" : "all";

  if (configuredScript !== null) {
    return {
      script: configuredScript,
      source: "config",
      enabled,
      reason,
      scope
    };
  }

  if (detectedScript !== null) {
    return {
      script: detectedScript,
      source: "detected",
      enabled,
      reason,
      scope
    };
  }

  return {
    script: null,
    source: "missing",
    enabled,
    reason,
    scope
  };
}

function createSkippedCommandReport(reason: string): CommandCheckReport {
  return {
    skipped: true,
    skipReason: reason,
    valid: true,
    errors: [],
    warnings: [],
    packageManager: "unknown",
    results: []
  };
}

function createSkippedCommandResult(
  role: CommandRole,
  selection: {
    script: string | null;
    source: CommandSource;
  },
  reason: string,
  packageManager: PackageManager | "unknown"
): ProjectCommandResult {
  const command = selection.script === null
    ? `${packageManager === "unknown" ? "npm" : packageManager} run <missing-${role}>`
    : formatPackageManagerCommand(packageManager, selection.script);

  return {
    role,
    status: "skipped",
    command,
    script: selection.script,
    source: selection.source,
    reason,
    exitCode: null,
    durationMs: 0,
    output: null
  };
}

async function findHtwPlaceholderWarnings(root: string): Promise<string[]> {
  const specsRoot = resolveInsideRoot(root, "specs");
  if (!(await pathExists(specsRoot))) {
    return [];
  }

  const entries = await readdir(specsRoot, { withFileTypes: true });
  const warnings: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d{3}-/.test(entry.name)) {
      continue;
    }

    const designPath = path.join(specsRoot, entry.name, "design.md");
    if (!(await pathExists(designPath))) {
      continue;
    }

    const design = await readFile(designPath, "utf8");
    if (/^- HTWTable evaluation:\s*$/m.test(design) || /^- HTWTable evaluation \/ HTWTable 评估：\s*$/m.test(design)) {
      warnings.push(`specs/${entry.name}/design.md still has an empty HTWTable evaluation entry.`);
    }
  }

  return warnings;
}

async function runPackageScript(
  root: string,
  packageManager: PackageManager | "unknown",
  script: string,
  env: NodeJS.ProcessEnv,
  extraArgs: string[] = []
): Promise<{
  exitCode: number | null;
  durationMs: number;
  output: string | null;
}> {
  const spawnCommand = createSpawnCommand(packageManager, script, extraArgs);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(spawnCommand.file, spawnCommand.args, {
      cwd: root,
      env,
      shell: false,
      windowsHide: true
    });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: null,
        durationMs: Date.now() - startedAt,
        output: truncateOutput(String(error))
      });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: code,
        durationMs: Date.now() - startedAt,
        output: truncateOutput([stdout, stderr].filter((value) => value.trim() !== "").join("\n"))
      });
    });
  });
}

function createSpawnCommand(
  packageManager: PackageManager | "unknown",
  script: string,
  extraArgs: string[] = []
): {
  file: string;
  args: string[];
} {
  const executable = packageManagerExecutable(packageManager);
  const args = packageManagerArguments(script, extraArgs);

  if (process.platform !== "win32") {
    return {
      file: executable,
      args
    };
  }

  const commandLine = [executable, ...args].map(quoteForCmd).join(" ");
  return {
    file: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", commandLine]
  };
}

function packageManagerExecutable(packageManager: PackageManager | "unknown"): string {
  if (process.platform === "win32") {
    if (packageManager === "bun") {
      return "bun.exe";
    }
    return `${packageManager === "unknown" ? "npm" : packageManager}.cmd`;
  }

  return packageManager === "unknown" ? "npm" : packageManager;
}

function packageManagerArguments(script: string, extraArgs: string[] = []): string[] {
  return extraArgs.length === 0 ? ["run", script] : ["run", script, "--", ...extraArgs];
}

function quoteForCmd(value: string): string {
  const escaped = value.replace(/"/g, "\"\"");
  return /[\s"]/u.test(value) ? `"${escaped}"` : escaped;
}

function formatPackageManagerCommand(
  packageManager: PackageManager | "unknown",
  script: string,
  extraArgs: string[] = []
): string {
  const base = `${packageManager === "unknown" ? "npm" : packageManager} run ${script}`;
  return extraArgs.length === 0 ? base : `${base} -- ${extraArgs.join(" ")}`;
}

function normalizePackageManager(value: PackageManager): PackageManager | "unknown" {
  return value;
}

function truncateOutput(output: string): string | null {
  const normalized = output.trim();
  if (normalized === "") {
    return null;
  }

  return normalized.length <= 4_000 ? normalized : `${normalized.slice(0, 4_000)}\n... output truncated ...`;
}

function isSourceFile(relativePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

async function resolveCommandArguments(
  root: string,
  role: CommandRole,
  scope: CommandScope,
  cache: Map<CommandRole, string[]>
): Promise<string[]> {
  if (scope === "all") {
    return [];
  }

  if (role !== "lint") {
    return [];
  }

  const cached = cache.get(role);
  if (cached !== undefined) {
    return cached;
  }

  const files = await listChangedSourceFiles(root);
  cache.set(role, files);
  return files;
}

async function listChangedSourceFiles(root: string): Promise<string[]> {
  const tracked = await runGitLines(root, ["diff", "--name-only", "--diff-filter=ACMR", "HEAD", "--"]);
  const untracked = await runGitLines(root, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])]
    .filter((file) => isSourceFile(file))
    .map((file) => file.replace(/\\/g, "/"))
    .sort((left, right) => left.localeCompare(right));
}

async function runGitLines(root: string, args: string[]): Promise<string[]> {
  const result = await runRawCommand(root, "git", args);
  if (result.exitCode !== 0 || result.output === null) {
    return [];
  }

  return result.output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

async function runRawCommand(
  root: string,
  file: string,
  args: string[]
): Promise<{
  exitCode: number | null;
  output: string | null;
}> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(file, args, {
      cwd: root,
      shell: false,
      windowsHide: true
    });

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ exitCode: null, output: String(error) });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: code,
        output: [stdout, stderr].filter((value) => value.trim() !== "").join("\n")
      });
    });
  });
}

async function readProjectProfile(root: string): Promise<ProjectProfile | null> {
  const value = await readJsonObject(root, ".harness/project.json");
  return isProjectProfile(value) ? value : null;
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  return isRecord(value)
    && value.schemaVersion === "1"
    && isRecord(value.detected)
    && isRecord(value.effective)
    && Array.isArray(value.overridesApplied);
}

async function loadCurrentProjectProfile(root: string): Promise<ProjectProfile | null> {
  const stored = await readProjectProfile(root);
  if (stored === null) {
    return null;
  }

  const detected = await detectProject(root);
  const config = await readJsonObject(root, ".harness/config.json");
  return applyProjectConfig(detected, config).profile;
}
