#!/usr/bin/env node

import path from "node:path";
import { createInterface } from "node:readline/promises";

import { runIntegratedChecks } from "@azi-harness/checks";
import type { DetectedValue, Evidence, ProjectProfile } from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  parseCheckArguments,
  parseDetectArguments,
  parseDoctorArguments,
  parseHtwInspectArguments,
  parseInitArguments,
  parseSetupArguments,
  parseSpecCreateArguments,
  parseSpecValidateArguments,
  parseSyncArguments
} from "./args.js";
import { runRuntimeDoctor } from "./doctor-runtime.js";
import {
  writeSuggestedRuntimeProposals,
  type ProposalWriteReport
} from "./proposal-runtime.js";
import {
  inspectHtwTable,
  writeHtwInspectionDocument,
  type HtwInspectReport
} from "./htw-runtime.js";
import { prepareRuntimeSetup } from "./setup-runtime.js";
import { prepareRuntimeSynchronization } from "./sync-runtime.js";
import {
  applyPreparedSpecCreation,
  prepareFeatureSpecCreation,
  runSpecValidation
} from "./spec-runtime.js";

const CLI_VERSION = "0.1.0-dev.0";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === undefined || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    process.stdout.write(`azi-harness ${CLI_VERSION}\n`);
    return;
  }

  if (command === "detect") {
    await runDetect(args);
    return;
  }

  if (command === "init") {
    await runInit(args);
    return;
  }

  if (command === "setup") {
    await runSetup(args);
    return;
  }

  if (command === "sync") {
    await runSync(args);
    return;
  }

  if (command === "doctor") {
    await runDoctor(args);
    return;
  }

  if (command === "check") {
    await runCheck(args);
    return;
  }

  if (command === "spec") {
    await runSpec(args);
    return;
  }

  if (command === "htw") {
    await runHtw(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function runDetect(args: string[]): Promise<void> {
  const options = parseDetectArguments(args);
  const profile = await detectProject(options.root);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
    return;
  }

  printSummary(profile, path.resolve(options.root));
  if (options.explain) {
    printExplanation(profile);
  }
}

async function runInit(args: string[]): Promise<void> {
  const options = parseInitArguments(args);
  const prepared = await prepareRuntimeInitialization(options.root);

  if (prepared.status === "already-initialized") {
    process.stdout.write(`azi-harness is already initialized in ${prepared.root}\n`);
    process.stdout.write("No files were changed. Use `azi sync` for runtime updates.\n");
    return;
  }

  const plan = prepared.plan;
  if (plan === null || prepared.profile === null) {
    throw new Error("Initialization plan was not created");
  }

  process.stdout.write([
    "azi-harness initialization plan",
    "",
    `Root:         ${prepared.root}`,
    `Project type: ${prepared.profile.effective.projectType.value}`,
    ""
  ].join("\n"));

  for (const entry of plan.entries) {
    process.stdout.write(`${entry.action.toUpperCase().padEnd(8)} ${entry.intent.path}\n`);
  }

  if (plan.hasConflicts) {
    process.stdout.write("\nInitialization stopped because existing files conflict.\n");
    process.exitCode = 2;
    return;
  }

  if (options.dryRun) {
    process.stdout.write("\nDry run only. No files were changed.\n");
    return;
  }

  let confirmed = options.yes;
  if (!confirmed && process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await readline.question("\nCreate these files? [y/N] ");
    readline.close();
    confirmed = /^y(es)?$/i.test(answer.trim());
  }

  if (!confirmed) {
    process.stdout.write("\nNo files were changed. Re-run with --yes to apply non-interactively.\n");
    return;
  }

  const created = await applyPreparedInitialization(prepared);
  process.stdout.write(`\nCreated ${created.length} files.\n`);
  process.stdout.write("Run `npx azi detect --explain` to inspect project evidence.\n");

  const doctor = await runRuntimeDoctor(prepared.root);
  process.stdout.write("\nPost-init doctor\n\n");
  printDoctorSection(doctor);
  if (doctor.errors.length > 0) {
    process.exitCode = 2;
  }
}

async function runSetup(args: string[]): Promise<void> {
  const options = parseSetupArguments(args);
  const prepared = await prepareRuntimeSetup(options.root);
  const plan = prepared.plan;

  process.stdout.write([
    `azi-harness setup plan (${prepared.mode})`,
    "",
    `Root:         ${prepared.root}`,
    `Project type: ${prepared.profile.effective.projectType.value}`,
    ""
  ].join("\n"));

  for (const entry of plan.entries) {
    process.stdout.write(`${entry.action.toUpperCase().padEnd(8)} ${entry.intent.path}\n`);
  }

  if (plan.hasConflicts) {
    process.stdout.write("\nSetup stopped because runtime files have conflicts.\n");
    process.exitCode = 2;
    return;
  }

  if (options.dryRun) {
    process.stdout.write("\nDry run only. No files were changed.\n");
    return;
  }

  const changes = plan.entries.filter(
    (entry) => entry.action === "create" || entry.action === "update" || entry.action === "delete"
  );

  let confirmed = options.yes;
  if (!confirmed && changes.length > 0 && process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await readline.question("\nApply setup changes? [y/N] ");
    readline.close();
    confirmed = /^y(es)?$/i.test(answer.trim());
  }

  if (!confirmed && changes.length > 0) {
    process.stdout.write("\nNo files were changed. Re-run with --yes to apply non-interactively.\n");
    return;
  }

  if (changes.length === 0) {
    process.stdout.write("\nRuntime is already up to date.\n");
  } else {
    const written = await applyPreparedInitialization({
      status: "ready",
      root: prepared.root,
      profile: prepared.profile,
      plan
    });
    process.stdout.write(
      prepared.mode === "init"
        ? `\nInitialized azi-harness with ${written.length} files.\n`
        : `\nApplied ${written.length} runtime file changes.\n`
    );
  }

  const doctor = await runRuntimeDoctor(prepared.root);
  process.stdout.write("\nPost-setup doctor\n\n");
  printDoctorSection(doctor);
  if (doctor.errors.length > 0) {
    process.exitCode = 2;
  }
}

async function runSync(args: string[]): Promise<void> {
  const options = parseSyncArguments(args);
  const prepared = await prepareRuntimeSynchronization(options.root);

  if (prepared.status === "not-initialized") {
    process.stdout.write(`azi-harness is not initialized in ${prepared.root}\n`);
    process.stdout.write("Run `npx azi init` first.\n");
    process.exitCode = 2;
    return;
  }

  const plan = prepared.plan;
  if (plan === null || prepared.profile === null) {
    throw new Error("Synchronization plan was not created");
  }

  process.stdout.write([
    "azi-harness synchronization plan",
    "",
    `Root:         ${prepared.root}`,
    `Project type: ${prepared.profile.effective.projectType.value}`,
    ""
  ].join("\n"));

  for (const entry of plan.entries) {
    process.stdout.write(`${entry.action.toUpperCase().padEnd(8)} ${entry.intent.path}\n`);
  }

  if (plan.hasConflicts) {
    process.stdout.write("\nSynchronization stopped because managed files have conflicts.\n");
    process.exitCode = 2;
    return;
  }

  if (options.dryRun) {
    process.stdout.write("\nDry run only. No files were changed.\n");
    return;
  }

  const changes = plan.entries.filter(
    (entry) => entry.action === "create" || entry.action === "update" || entry.action === "delete"
  );
  if (changes.length === 0) {
    process.stdout.write("\nRuntime is already up to date.\n");
    return;
  }

  let confirmed = options.yes;
  if (!confirmed && process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await readline.question("\nApply these runtime updates? [y/N] ");
    readline.close();
    confirmed = /^y(es)?$/i.test(answer.trim());
  }

  if (!confirmed) {
    process.stdout.write("\nNo files were changed. Re-run with --yes to apply non-interactively.\n");
    return;
  }

  const written = await applyPreparedInitialization({
    status: "ready",
    root: prepared.root,
    profile: prepared.profile,
    plan
  });
  process.stdout.write(`\nApplied ${written.length} file changes.\n`);
}

async function runDoctor(args: string[]): Promise<void> {
  const options = parseDoctorArguments(args);
  const report = await runRuntimeDoctor(options.root);
  const proposals = options.writeProposals
    ? await writeSuggestedRuntimeProposals(options.root)
    : null;

  if (options.json) {
    process.stdout.write(`${JSON.stringify(
      proposals === null ? report : { ...report, proposals },
      null,
      2
    )}\n`);
  } else {
    process.stdout.write([
      "azi-harness doctor",
      "",
      `Root:         ${report.root}`,
      `Initialized:  ${report.initialized ? "yes" : "no"}`,
      `Errors:       ${report.errors.length}`,
      `Warnings:     ${report.warnings.length}`,
      ""
    ].join("\n"));

    if (report.errors.length > 0) {
      process.stdout.write("Errors:\n");
      for (const error of report.errors) {
        process.stdout.write(`- ${error}\n`);
      }
    }

    if (report.warnings.length > 0) {
      process.stdout.write("Warnings:\n");
      for (const warning of report.warnings) {
        process.stdout.write(`- ${warning}\n`);
      }
    }

    if (report.errors.length === 0 && report.warnings.length === 0) {
      process.stdout.write("No issues found.\n");
    }

    printProposalSection(proposals);
  }

  process.exitCode = report.errors.length > 0 ? 2 : 0;
}

async function runCheck(args: string[]): Promise<void> {
  const options = parseCheckArguments(args);
  const doctor = await runRuntimeDoctor(options.root);
  const checks = await runIntegratedChecks(options.root, {
    quick: options.quick,
    env: process.env
  });
  const proposals = options.writeProposals
    ? await writeSuggestedRuntimeProposals(options.root)
    : null;
  const valid = doctor.errors.length === 0 && checks.valid;
  const errorCount = doctor.errors.length + checks.errors;
  const warningCount = doctor.warnings.length + checks.warnings;

  if (options.json) {
    const output = {
      root: path.resolve(options.root),
      valid,
      errors: errorCount,
      warnings: warningCount,
      quick: options.quick,
      doctor,
      checks
    };
    process.stdout.write(`${JSON.stringify(
      proposals === null ? output : { ...output, proposals },
      null,
      2
    )}\n`);
    process.exitCode = valid ? 0 : 2;
    return;
  }

  process.stdout.write([
    "azi-harness check",
    "",
    `Root:      ${path.resolve(options.root)}`,
    `Valid:     ${valid ? "yes" : "no"}`,
    `Errors:    ${errorCount}`,
    `Warnings:  ${warningCount}`,
    `Quick:     ${options.quick ? "yes" : "no"}`,
    ""
  ].join("\n"));

  printDoctorSection(doctor);
  printSpecSection(checks.specs);
  printRuleSection(checks.rules);
  printCommandSection(checks.commands);
  printProposalSection(proposals);

  process.exitCode = valid ? 0 : 2;
}

async function runSpec(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === "create") {
    await runSpecCreate(rest);
    return;
  }
  if (subcommand === "validate") {
    await runSpecValidate(rest);
    return;
  }
  throw new Error("Usage: azi spec <create|validate> ...");
}

async function runHtw(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand !== "inspect") {
    throw new Error("Usage: azi htw inspect [path] [--json] [--write-doc]");
  }

  const options = parseHtwInspectArguments(rest);
  const report = await inspectHtwTable(options.root);
  const writtenDoc = options.writeDoc
    ? await writeHtwInspectionDocument(options.root, report)
    : null;

  if (options.json) {
    process.stdout.write(`${JSON.stringify(
      writtenDoc === null ? report : { ...report, writtenDoc },
      null,
      2
    )}\n`);
  } else {
    printHtwInspection(report, writtenDoc);
  }

  process.exitCode = report.packageInstalled ? 0 : 2;
}

async function runSpecCreate(args: string[]): Promise<void> {
  const options = parseSpecCreateArguments(args);
  const prepared = await prepareFeatureSpecCreation(options.root, options.featureName);

  process.stdout.write([
    "azi-harness spec creation plan",
    "",
    `Root:      ${path.resolve(options.root)}`,
    `Spec:      ${prepared.spec.directoryName}`,
    ""
  ].join("\n"));

  for (const entry of prepared.plan.entries) {
    process.stdout.write(`${entry.action.toUpperCase().padEnd(8)} ${entry.intent.path}\n`);
  }

  if (prepared.plan.hasConflicts) {
    process.stdout.write("\nSpec creation stopped because files already exist with different content.\n");
    process.exitCode = 2;
    return;
  }

  if (options.dryRun) {
    process.stdout.write("\nDry run only. No files were changed.\n");
    return;
  }

  let confirmed = options.yes;
  if (!confirmed && process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await readline.question("\nCreate this spec directory? [y/N] ");
    readline.close();
    confirmed = /^y(es)?$/i.test(answer.trim());
  }

  if (!confirmed) {
    process.stdout.write("\nNo files were changed. Re-run with --yes to apply non-interactively.\n");
    return;
  }

  const written = await applyPreparedSpecCreation(prepared);
  process.stdout.write(`\nCreated ${written.length} files for ${prepared.spec.directoryName}.\n`);
}

async function runSpecValidate(args: string[]): Promise<void> {
  const options = parseSpecValidateArguments(args);
  const result = await runSpecValidation(options.root, options.target);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write([
      "azi-harness spec validation",
      "",
      `Root:      ${path.resolve(options.root)}`,
      `Valid:     ${result.summary.valid ? "yes" : "no"}`,
      `Errors:    ${result.summary.errors}`,
      `Warnings:  ${result.summary.warnings}`,
      ""
    ].join("\n"));

    for (const report of result.reports) {
      process.stdout.write(`${report.valid ? "OK" : "FAIL"} ${report.specPath}\n`);
      for (const error of report.errors) {
        process.stdout.write(`- error: ${error}\n`);
      }
      for (const warning of report.warnings) {
        process.stdout.write(`- warning: ${warning}\n`);
      }
    }
  }

  process.exitCode = result.summary.valid ? 0 : 2;
}

function printSummary(profile: ProjectProfile, root: string): void {
  const facts = profile.effective;
  const lines = [
    "azi-harness project detection",
    "",
    `Root:            ${root}`,
    `Project type:    ${formatDetected(facts.projectType)}`,
    `Package manager: ${formatDetected(facts.packageManager)}`,
    `Vue:             ${formatDetected(facts.framework.vue)}`,
    `Vue major:       ${formatDetected(facts.framework.vueMajor)}`,
    `UI framework:    ${formatDetected(facts.framework.ui)}`,
    `uniapp:          ${formatDetected(facts.framework.uniapp)}`,
    `RuoYi:           ${formatDetected(facts.ruoyi)}`,
    `HTWTable:        ${facts.htwTable.installed ? "found" : "not found"}`,
    `Commands:        ${formatCommands(profile)}`,
    ""
  ];

  if (facts.htwTable.installed) {
    lines.push(
      `HTW package:     ${facts.htwTable.packageName ?? "unknown"}`,
      `HTW version:     ${facts.htwTable.versionSpec ?? "unknown"}`,
      `HTW docs:        ${facts.htwTable.documentationUrl}`,
      ""
    );
  }

  if (facts.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of facts.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  lines.push("Use --explain for evidence or --json for machine-readable output.");
  process.stdout.write(`${lines.join("\n")}\n`);
}

function printExplanation(profile: ProjectProfile): void {
  const facts = profile.detected;
  const sections: Array<[string, DetectedValue<unknown>]> = [
    ["Project type", facts.projectType],
    ["Package manager", facts.packageManager],
    ["Vue", facts.framework.vue],
    ["Vue major", facts.framework.vueMajor],
    ["UI framework", facts.framework.ui],
    ["uniapp", facts.framework.uniapp],
    ["RuoYi", facts.ruoyi],
    ["Permission", facts.capabilities.permission],
    ["Dictionary", facts.capabilities.dict],
    ["Request", facts.capabilities.request],
    ["Routing", facts.capabilities.routing],
    ["Pagination", facts.capabilities.pagination],
    ["Feedback", facts.capabilities.feedback]
  ];

  process.stdout.write("\nEvidence\n");
  process.stdout.write("========\n");
  for (const [title, value] of sections) {
    process.stdout.write(`\n${title}: ${stringify(value.value)} [${value.confidence}]\n`);
    printEvidence(value.evidence);
    for (const conflict of value.conflicts) {
      process.stdout.write(`  ! ${conflict}\n`);
    }
  }

  process.stdout.write(`\nHTWTable: ${facts.htwTable.installed ? "found" : "not found"}\n`);
  printEvidence(facts.htwTable.evidence);
  for (const conflict of facts.htwTable.conflicts) {
    process.stdout.write(`  ! ${conflict}\n`);
  }
}

function printEvidence(evidence: Evidence[]): void {
  for (const item of evidence) {
    process.stdout.write(`  - [${item.kind}] ${item.source}: ${item.detail}\n`);
  }
}

function formatDetected(value: DetectedValue<unknown>): string {
  return `${stringify(value.value)} (${value.confidence})`;
}

function stringify(value: unknown): string {
  if (value === null) {
    return "unknown";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : value.join(", ");
  }
  return String(value);
}

function formatCommands(profile: ProjectProfile): string {
  const commands = profile.effective.commands;
  const values = [
    ...commands.dev.map((name) => `dev:${name}`),
    ...commands.build.map((name) => `build:${name}`),
    ...commands.test.map((name) => `test:${name}`),
    ...commands.lint.map((name) => `lint:${name}`)
  ];
  return values.length === 0 ? "none" : values.join(", ");
}

function printHelp(): void {
  process.stdout.write([
    "azi-harness",
    "",
    "Usage:",
    "  azi detect [path] [--json] [--explain]",
    "  azi setup [path] [--dry-run] [--yes]",
    "  azi init [path] [--dry-run] [--yes]",
    "  azi sync [path] [--dry-run] [--yes]",
    "  azi doctor [path] [--json] [--write-proposals]",
    "  azi check [path] [--quick] [--json] [--write-proposals]",
    "  azi htw inspect [path] [--json] [--write-doc]",
    "  azi spec create <feature-name> [root] [--dry-run] [--yes]",
    "  azi spec validate [target] [--root <path>] [--json]",
    "",
    "Commands:",
    "  detect   Inspect a project without writing files",
    "  setup    One-command runtime install or refresh",
    "  init     Preview and install the project runtime",
    "  sync     Preview and update managed runtime files",
    "  doctor   Validate the installed runtime and tracked files",
    "  check    Run doctor, spec, rule, and project command checks",
    "  htw      Inspect the installed HTWTable public API signals",
    "  spec     Create or validate feature specifications",
    "",
    "Options:",
    "  --json      Print the complete project profile as JSON",
    "  --explain   Print evidence and conflicts",
    "  --quick     Skip project lint/test/build commands during `azi check`",
    "  --write-proposals  Write reviewable patches into `.harness/proposals/`",
    "  --write-doc  Write an inspection document into `.harness/docs/`",
    "  --dry-run   Preview initialization without writing files",
    "  --yes, -y   Apply initialization without an interactive prompt",
    "  --help      Show this help",
    "  --version   Show the CLI version",
    ""
  ].join("\n"));
}

function printHtwInspection(report: HtwInspectReport, writtenDoc: string | null): void {
  process.stdout.write([
    "azi-harness HTWTable inspection",
    "",
    `Root:        ${report.root}`,
    `Package:     ${report.packageName ?? "not declared"}`,
    `Declared:    ${report.declared ? "yes" : "no"}`,
    `Installed:   ${report.packageInstalled ? "yes" : "no"}`,
    `Version:     ${report.packageVersion ?? report.versionSpec ?? "unknown"}`,
    `Package dir: ${report.packageRoot ?? "unknown"}`,
    ""
  ].join("\n"));

  process.stdout.write("Entry files:\n");
  if (report.entryFiles.length === 0) {
    process.stdout.write("- none\n");
  } else {
    for (const entry of report.entryFiles) {
      process.stdout.write(`- ${entry.exists ? "found" : "missing"}: ${entry.path} (${entry.kind})\n`);
    }
  }

  process.stdout.write("\nPublic signals:\n");
  printSignalLine("exports", report.publicSignals.exports);
  printSignalLine("components", report.publicSignals.components);
  printSignalLine("props", report.publicSignals.props);
  printSignalLine("events", report.publicSignals.events);

  if (report.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  if (writtenDoc !== null) {
    process.stdout.write(`\nWrote ${writtenDoc}\n`);
  }
}

function printSignalLine(label: string, values: string[]): void {
  process.stdout.write(`- ${label}: ${values.length === 0 ? "none" : values.join(", ")}\n`);
}

function printProposalSection(report: ProposalWriteReport | null): void {
  if (report === null) {
    return;
  }

  process.stdout.write("\nProposals:\n");
  if (report.written.length === 0 && report.skipped.length === 0) {
    process.stdout.write("- status: none\n");
    return;
  }
  for (const written of report.written) {
    process.stdout.write(`- wrote: ${written}\n`);
  }
  for (const skipped of report.skipped) {
    process.stdout.write(`- skipped: ${skipped}\n`);
  }
}

function printDoctorSection(report: {
  initialized: boolean;
  errors: string[];
  warnings: string[];
}): void {
  process.stdout.write("Doctor:\n");
  process.stdout.write(`- initialized: ${report.initialized ? "yes" : "no"}\n`);

  if (report.errors.length === 0 && report.warnings.length === 0) {
    process.stdout.write("- status: ok\n\n");
    return;
  }

  for (const error of report.errors) {
    process.stdout.write(`- error: ${error}\n`);
  }
  for (const warning of report.warnings) {
    process.stdout.write(`- warning: ${warning}\n`);
  }
  process.stdout.write("\n");
}

function printSpecSection(report: {
  valid: boolean;
  errors: string[];
  warnings: string[];
  reports: Array<{
    specPath: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
}): void {
  process.stdout.write("Specs:\n");
  process.stdout.write(`- status: ${report.valid ? "ok" : "failed"}\n`);

  if (report.reports.length === 0) {
    for (const error of report.errors) {
      process.stdout.write(`- error: ${error}\n`);
    }
    for (const warning of report.warnings) {
      process.stdout.write(`- warning: ${warning}\n`);
    }
  }
  for (const spec of report.reports) {
    process.stdout.write(`- ${spec.valid ? "ok" : "fail"}: ${spec.specPath}\n`);
    for (const error of spec.errors) {
      process.stdout.write(`  error: ${error}\n`);
    }
    for (const warning of spec.warnings) {
      process.stdout.write(`  warning: ${warning}\n`);
    }
  }
  process.stdout.write("\n");
}

function printRuleSection(report: {
  valid: boolean;
  errors: string[];
  warnings: string[];
  findings: Array<{
    file: string;
    ruleId: string;
    message: string;
  }>;
}): void {
  process.stdout.write("Rules:\n");
  process.stdout.write(`- status: ${report.valid ? "ok" : "failed"}\n`);

  for (const error of report.errors) {
    process.stdout.write(`- error: ${error}\n`);
  }
  for (const warning of report.warnings) {
    process.stdout.write(`- warning: ${warning}\n`);
  }
  for (const finding of report.findings) {
    process.stdout.write(`- finding: [${finding.ruleId}] ${finding.file} - ${finding.message}\n`);
  }
  process.stdout.write("\n");
}

function printCommandSection(report: {
  skipped: boolean;
  skipReason: string | null;
  valid: boolean;
  errors: string[];
  warnings: string[];
  results: Array<{
    role: "lint" | "test" | "build";
    status: "passed" | "failed" | "skipped";
    command: string;
    source: "config" | "detected" | "missing";
    reason: string | null;
    exitCode: number | null;
    output: string | null;
  }>;
}): void {
  process.stdout.write("Commands:\n");
  process.stdout.write(`- status: ${report.skipped ? "skipped" : report.valid ? "ok" : "failed"}\n`);

  if (report.skipReason !== null) {
    process.stdout.write(`- reason: ${report.skipReason}\n`);
  }
  for (const error of report.errors) {
    process.stdout.write(`- error: ${error}\n`);
  }
  for (const warning of report.warnings) {
    process.stdout.write(`- warning: ${warning}\n`);
  }
  for (const result of report.results) {
    const suffix = result.reason === null ? "" : ` (${result.reason})`;
    const exitCode = result.exitCode === null ? "" : ` exit=${result.exitCode}`;
    process.stdout.write(`- ${result.role}: ${result.status} via ${result.command}${exitCode}${suffix}\n`);
    if (result.output !== null && result.status === "failed") {
      for (const line of result.output.split("\n").filter((item) => item.trim() !== "")) {
        process.stdout.write(`  ${line}\n`);
      }
    }
  }
  process.stdout.write("\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`azi: ${message}\n`);
  process.exitCode = 1;
});
