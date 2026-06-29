#!/usr/bin/env node

import { createHash } from "node:crypto";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { runIntegratedChecks, type IntegratedCheckReport } from "@azi-harness/checks";
import type { DetectedValue, Evidence, ProjectProfile } from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  parseCheckArguments,
  parseContextArguments,
  parseDetectArguments,
  parseDoctorArguments,
  parseFigmaFallbackArguments,
  parseFigmaImportArguments,
  parseFigmaSpecArguments,
  parseFigmaTargetArguments,
  parseHtwInspectArguments,
  parseInitArguments,
  parseReviewArguments,
  parseSddArguments,
  parseSetupArguments,
  parseSkillDoctorArguments,
  parseSkillInstallGuideArguments,
  parseSkillListArguments,
  parseSkillMatchArguments,
  parseSkillSearchArguments,
  parseSkillSourcesArguments,
  parseSpecCreateArguments,
  parseSpecValidateArguments,
  parseSyncArguments,
  parseTaskArguments,
  parseWorkflowAdvanceArguments,
  parseWorkflowLogArguments,
  parseWorkflowStartArguments,
  parseWorkflowStatusArguments
} from "./args.js";
import {
  createContextDocument,
  type ContextDocument
} from "./context-runtime.js";
import { runRuntimeDoctor } from "./doctor-runtime.js";
import {
  applyPreparedFigmaWrite,
  deriveFigmaFeature,
  downloadFigmaSvgAssets,
  getFigmaCacheStatus,
  prepareFigmaFallback,
  prepareFigmaSpec,
  type FigmaAssetDownloadReport,
  type FigmaCacheStatus,
  type PreparedFigmaWrite
} from "./figma-runtime.js";
import {
  createReviewMarkdown,
  createReviewReport,
  writeReviewReport,
  writeReviewSuggestion,
  type ReviewReport
} from "./review-runtime.js";
import {
  createSddStatus,
  isSddPhase,
  prepareSddArtifact,
  writeSddArtifact,
  type SddArtifactReport,
  type SddStatusReport
} from "./sdd-runtime.js";
import {
  writeSuggestedRuntimeProposals,
  type ProposalWriteReport
} from "./proposal-runtime.js";
import {
  inspectHtwTable,
  writeHtwInspectionDocument,
  type HtwInspectReport
} from "./htw-runtime.js";
import {
  createImplementationPatchCandidate,
  createImplementationContext,
  type ImplementationContextReport,
  type ImplementationPatchReport
} from "./implementation-runtime.js";
import { prepareRuntimeSetup } from "./setup-runtime.js";
import {
  runSkillDoctor,
  runSkillInstallGuide,
  runSkillList,
  runSkillMatch,
  runSkillSearch,
  runSkillSources,
  type SkillDoctorReport,
  type SkillInstallGuideReport,
  type SkillListReport,
  type SkillMatchReport,
  type SkillSearchReport,
  type SkillSourcesReport
} from "./skill-runtime.js";
import { prepareRuntimeSynchronization } from "./sync-runtime.js";
import {
  applyPreparedSpecCreation,
  prepareFeatureSpecCreation,
  runSpecValidation
} from "./spec-runtime.js";
import {
  applyPreparedWorkflowStart,
  advanceWorkflow,
  getWorkflowLog,
  getWorkflowStatus,
  isWorkflowStageId,
  prepareWorkflowStart,
  type PreparedWorkflowStart,
  type WorkflowLogReport,
  type WorkflowStageId,
  type WorkflowState,
  type WorkflowStatusReport
} from "./workflow-runtime.js";

const CLI_VERSION = "0.1.2";

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

  if (command === "workflow") {
    await runWorkflow(args);
    return;
  }

  if (command === "review") {
    await runReview(args);
    return;
  }

  if (command === "sdd") {
    await runSdd(args);
    return;
  }

  if (command === "context") {
    await runContext(args);
    return;
  }

  if (command === "task" || command === "go") {
    await runTask(args);
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

  if (command === "figma") {
    await runFigma(args);
    return;
  }

  if (command === "skill") {
    await runSkill(args);
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

async function runContext(args: string[]): Promise<void> {
  const options = parseContextArguments(args);
  const context = await createContextDocument(options);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(context, null, 2)}\n`);
  } else {
    printContext(context);
  }

  process.exitCode = context.doctor.errors.length === 0 ? 0 : 2;
}

async function runWorkflow(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === "start") {
    await runWorkflowStart(rest);
    return;
  }
  if (subcommand === "status") {
    await runWorkflowStatus(rest);
    return;
  }
  if (subcommand === "advance") {
    await runWorkflowAdvance(rest);
    return;
  }
  if (subcommand === "log") {
    await runWorkflowLog(rest);
    return;
  }
  throw new Error("Usage: azi workflow <start|status|advance|log> ...");
}

async function runWorkflowStart(args: string[]): Promise<void> {
  const options = parseWorkflowStartArguments(args);
  const prepared = await prepareWorkflowStart(options);

  if (!options.json) {
    printWorkflowStart(prepared);
  }

  if (prepared.spec.plan?.hasConflicts === true) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ...prepared, applied: false, written: [] }, null, 2)}\n`);
    } else {
      process.stdout.write("\nWorkflow start stopped because spec files have conflicts.\n");
    }
    process.exitCode = 2;
    return;
  }

  if (prepared.spec.status === "existing" && prepared.workflowPlan === null) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ...prepared, applied: false, written: [] }, null, 2)}\n`);
    } else {
      process.stdout.write("\nSpec already exists. No files were changed.\n");
    }
    return;
  }

  if (options.dryRun) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ...prepared, applied: false, written: [] }, null, 2)}\n`);
    } else {
      process.stdout.write("\nDry run only. No files were changed.\n");
    }
    return;
  }

  let confirmed = options.yes;
  if (!confirmed && !options.json && process.stdin.isTTY && process.stdout.isTTY) {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const answer = await readline.question("\nCreate this workflow spec? [y/N] ");
    readline.close();
    confirmed = /^y(es)?$/i.test(answer.trim());
  }

  if (!confirmed) {
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ ...prepared, applied: false, written: [] }, null, 2)}\n`);
    } else {
      process.stdout.write("\nNo files were changed. Re-run with --yes to apply non-interactively.\n");
    }
    return;
  }

  const written = await applyPreparedWorkflowStart(prepared);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ...prepared, applied: true, written }, null, 2)}\n`);
  } else {
    process.stdout.write(`\nCreated ${written.length} workflow files for ${prepared.spec.relativePath}.\n`);
  }
}

async function runWorkflowStatus(args: string[]): Promise<void> {
  const options = parseWorkflowStatusArguments(args);
  const report = await getWorkflowStatus(options.root);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printWorkflowStatus(report);
  }
}

async function runWorkflowAdvance(args: string[]): Promise<void> {
  const options = parseWorkflowAdvanceArguments(args);
  if (!isWorkflowStageId(options.to)) {
    throw new Error(`Unknown workflow stage: ${options.to}`);
  }

  const result = await advanceWorkflow({
    root: options.root,
    target: options.target,
    to: options.to,
    force: options.force,
    reason: options.reason
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printWorkflowAdvance(result.workflow, result.changed, result.warnings);
  }
}

async function runWorkflowLog(args: string[]): Promise<void> {
  const options = parseWorkflowLogArguments(args);
  const report = await getWorkflowLog(options.root, options.target);

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printWorkflowLog(report);
  }
}

async function runReview(args: string[]): Promise<void> {
  const options = parseReviewArguments(args);
  const report = await createReviewReport(options);
  const written = options.write ? await writeReviewReport(report) : null;
  const proposal = options.suggestPatch ? await writeReviewSuggestion(report) : null;

  if (options.json) {
    process.stdout.write(`${JSON.stringify({
      ...report,
      ...(written === null ? {} : { written }),
      ...(proposal === null ? {} : { proposal })
    }, null, 2)}\n`);
  } else if (options.write || options.suggestPatch) {
    printReview(report);
    if (written !== null) {
      process.stdout.write(`\nWrote ${written}\n`);
    }
    if (proposal !== null) {
      for (const file of proposal.written) {
        process.stdout.write(`\nProposal ${file}\n`);
      }
      for (const reason of proposal.skipped) {
        process.stdout.write(`\nProposal skipped: ${reason}\n`);
      }
    }
  } else {
    process.stdout.write(createReviewMarkdown(report));
  }

  process.exitCode = options.ci
    ? report.recommendation === "ready" ? 0 : 2
    : report.recommendation === "blocked" ? 2 : 0;
}

async function runSdd(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === "status") {
    const options = parseSddArguments(rest, subcommand);
    if (options.write) {
      throw new Error("azi sdd status does not accept --write.");
    }
    const report = await createSddStatus({
      root: options.root,
      target: options.target
    });
    printJsonOr(report, options.json, printSddStatus);
    process.exitCode = report.valid ? 0 : 2;
    return;
  }

  if (subcommand !== undefined && isSddPhase(subcommand)) {
    const options = parseSddArguments(rest, subcommand);
    const prepared = await prepareSddArtifact({
      root: options.root,
      target: options.target,
      phase: subcommand
    });
    const report = options.write && !prepared.plan.hasConflicts
      ? await writeSddArtifact(prepared)
      : prepared;
    printJsonOr(report, options.json, printSddArtifact);
    if (report.plan.hasConflicts) {
      process.exitCode = 2;
    }
    return;
  }

  throw new Error("Usage: azi sdd <clarify|prd|issues|tasks|acceptance|retrospective|status> [root] --target <spec-path> [--write] [--json]");
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

async function runFigma(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand !== undefined && /^https?:\/\//iu.test(subcommand)) {
    const options = parseFigmaImportArguments(args);
    await runFigmaImport(options);
    return;
  }

  if (subcommand === "spec") {
    const options = parseFigmaSpecArguments(rest);
    const prepared = await prepareFigmaSpec({
      root: options.root,
      target: options.target,
      url: options.url
    });
    const written = options.write && !prepared.plan.hasConflicts
      ? await applyPreparedFigmaWrite(prepared)
      : [];
    const report = { ...prepared, written };
    printJsonOr(report, options.json, printFigmaWrite);
    if (prepared.plan.hasConflicts) {
      process.exitCode = 2;
    }
    return;
  }

  if (subcommand === "fallback") {
    const options = parseFigmaFallbackArguments(rest);
    const prepared = await prepareFigmaFallback({
      root: options.root,
      target: options.target,
      source: options.source,
      reference: options.reference,
      retriedAt: options.retriedAt,
      notes: options.notes
    });
    const written = options.write && !prepared.plan.hasConflicts
      ? await applyPreparedFigmaWrite(prepared)
      : [];
    const report = { ...prepared, written };
    printJsonOr(report, options.json, printFigmaWrite);
    if (prepared.plan.hasConflicts) {
      process.exitCode = 2;
    }
    return;
  }

  if (subcommand === "cache" || subcommand === "status") {
    const options = parseFigmaTargetArguments(rest, subcommand);
    const report = await getFigmaCacheStatus(options.root, options.target);
    printJsonOr(report, options.json, printFigmaCacheStatus);
    process.exitCode = report.warnings.length === 0 ? 0 : 2;
    return;
  }

  throw new Error("Usage: azi figma <spec|cache|status|fallback> ...");
}

async function runTask(args: string[]): Promise<void> {
  const options = parseTaskArguments(args);
  const figmaUrl = extractFigmaUrl(options.task);
  if (figmaUrl !== null) {
    const apply = options.apply || taskExplicitlyAllowsApply(options.task);
    if (!options.json) {
      process.stdout.write([
        "azi-harness task",
        "",
        "Route: figma",
        `Task:  ${options.task}`,
        `Apply: ${apply ? "yes" : "no"}`,
        ""
      ].join("\n"));
    }
    await runFigmaImport({
      root: options.root,
      url: figmaUrl,
      featureName: null,
      slug: null,
      yes: true,
      apply,
      json: options.json,
      includeAvoided: options.includeAvoided
    });
    return;
  }

  if (taskLooksLikeHtwInspection(options.task)) {
    const report = await inspectHtwTable(options.root);
    const writtenDoc = await writeHtwInspectionDocument(options.root, report);
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ route: "htw", report, writtenDoc }, null, 2)}\n`);
    } else {
      process.stdout.write([
        "azi-harness task",
        "",
        "Route: htw",
        `Task:  ${options.task}`,
        ""
      ].join("\n"));
      printHtwInspection(report, writtenDoc);
      process.stdout.write("\nNext actions:\n");
      process.stdout.write("- 使用 `.harness/docs/htw-table-api.md` 中的公开 API 证据，不要猜 HTWTable props/events。\n");
      process.stdout.write("- 若依字典、权限、请求封装和分页仍以项目事实与相似页面为准。\n");
    }
    process.exitCode = report.packageInstalled ? 0 : 2;
    return;
  }

  if (taskLooksLikeQualityCheck(options.task)) {
    const doctor = await runRuntimeDoctor(options.root);
    const checks = await runIntegratedChecks(options.root, {
      quick: true,
      env: process.env
    });
    const valid = doctor.errors.length === 0 && checks.valid;
    if (options.json) {
      process.stdout.write(`${JSON.stringify({ route: "check", valid, doctor, checks }, null, 2)}\n`);
    } else {
      process.stdout.write([
        "azi-harness task",
        "",
        "Route: check",
        `Task:  ${options.task}`,
        `Valid: ${valid ? "yes" : "no"}`,
        ""
      ].join("\n"));
      printDoctorSection(doctor);
      printSpecSection(checks.specs);
      printRuleSection(checks.rules);
      printCommandSection(checks.commands);
      process.stdout.write("Next actions:\n");
      process.stdout.write("- 先处理 error，再处理 warning；缺失业务事实不要从代码或 Figma 猜。\n");
      process.stdout.write("- 交付前运行 `npx azi review --target specs/<id-feature> --full --diff --evidence --write`。\n");
    }
    process.exitCode = valid ? 0 : 2;
    return;
  }

  if (taskLooksLikeFeatureWork(options.task)) {
    const feature = deriveTaskFeature(options.task);
    const workflow = await prepareWorkflowStart({
      root: options.root,
      featureName: feature.featureName,
      slug: feature.slug,
      task: options.task,
      includeAvoided: options.includeAvoided
    });

    if (workflow.spec.plan?.hasConflicts === true || workflow.workflowPlan?.hasConflicts === true) {
      if (options.json) {
        process.stdout.write(`${JSON.stringify({ route: "workflow", feature, workflow, written: [], quickCheck: null }, null, 2)}\n`);
      } else {
        process.stdout.write([
          "azi-harness task",
          "",
          "Route: workflow",
          `Task:  ${options.task}`,
          ""
        ].join("\n"));
        printWorkflowStart(workflow);
        process.stdout.write("\nWorkflow start stopped because spec files have conflicts.\n");
      }
      process.exitCode = 2;
      return;
    }

    const written = await applyPreparedWorkflowStart(workflow);
    const quickCheck = await runIntegratedChecks(workflow.root, {
      quick: true,
      env: process.env
    });

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ route: "workflow", feature, workflow, written, quickCheck }, null, 2)}\n`);
    } else {
      process.stdout.write([
        "azi-harness task",
        "",
        "Route: workflow",
        `Task:  ${options.task}`,
        ""
      ].join("\n"));
      printWorkflowStart(workflow);
      process.stdout.write(`\nWrote ${written.length} workflow files for ${workflow.spec.relativePath}.\n`);
      process.stdout.write("\nQuick check:\n");
      process.stdout.write(`- status: ${quickCheck.valid ? "ok" : "failed"}\n`);
      process.stdout.write(`- errors: ${quickCheck.errors}\n`);
      process.stdout.write(`- warnings: ${quickCheck.warnings}\n`);
      for (const error of [
        ...quickCheck.specs.errors,
        ...quickCheck.rules.errors,
        ...quickCheck.commands.errors
      ].slice(0, 5)) {
        process.stdout.write(`- error: ${error}\n`);
      }
      for (const warning of [
        ...quickCheck.specs.warnings,
        ...quickCheck.rules.warnings,
        ...quickCheck.commands.warnings
      ].slice(0, 5)) {
        process.stdout.write(`- warning: ${warning}\n`);
      }
      process.stdout.write("\nNext actions:\n");
      process.stdout.write(`- 读取 ${workflow.spec.relativePath} 与 ${workflow.workflowState.statePath} 后再做最小补丁。\n`);
      process.stdout.write("- 权限、字典、请求封装、分页、路由、菜单和 HTWTable 必须从项目事实与相似页面读取。\n");
      process.stdout.write("- 不覆盖已有业务页面；缺失接口、权限、字典或字段时输出阻塞项。\n");
    }
    process.exitCode = quickCheck.valid ? 0 : 2;
    return;
  }

  const context = await createContextDocument({
    root: options.root,
    task: options.task,
    includeAvoided: options.includeAvoided
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ route: "context", context }, null, 2)}\n`);
  } else {
    process.stdout.write([
      "azi-harness task",
      "",
      "Route: context",
      "Figma URL: not detected",
      "No workflow files were changed.",
      ""
    ].join("\n"));
    printContext(context);
  }
  process.exitCode = context.doctor.errors.length === 0 ? 0 : 2;
}

async function runFigmaImport(options: {
  root: string;
  url: string;
  featureName: string | null;
  slug: string | null;
  yes: boolean;
  apply: boolean;
  json: boolean;
  includeAvoided: boolean;
}): Promise<void> {
  const confirmed = options.yes || options.apply;
  const derived = deriveFigmaFeature(options.url);
  const featureName = options.featureName ?? derived.featureName;
  const slug = options.slug ?? derived.slug;
  const workflow = await prepareWorkflowStart({
    root: options.root,
    featureName,
    slug,
    task: `根据 Figma 节点生成规格：${options.url}`,
    includeAvoided: options.includeAvoided
  });

  if (workflow.workflowPlan?.hasConflicts === true) {
    const report = {
      root: workflow.root,
      url: options.url,
      featureName,
      slug,
      workflow,
      figma: null,
      assets: null,
      implementation: null,
      implementationPatch: null,
      quickCheck: null,
      written: [] as string[],
      nextActions: ["先处理 workflow start 写入计划冲突，再重新运行 `azi figma <url> --yes`。"]
    };
    printJsonOr(report, options.json, printFigmaImport);
    process.exitCode = 2;
    return;
  }

  const workflowWritten = confirmed
    ? await applyPreparedWorkflowStart(workflow)
    : [];
  const figma = confirmed || workflow.spec.status === "existing"
    ? await prepareFigmaSpec({
      root: options.root,
      target: workflow.spec.relativePath,
      url: options.url
    })
    : null;
  const figmaWritten = confirmed && figma !== null && !figma.plan.hasConflicts
    ? await applyPreparedFigmaWrite(figma)
    : [];
  const assets = confirmed && figma !== null && !figma.plan.hasConflicts
    ? await downloadFigmaSvgAssets({
      root: options.root,
      target: workflow.spec.relativePath,
      url: options.url,
      token: process.env.FIGMA_TOKEN
    })
    : null;
  const implementation = confirmed && figma !== null && !figma.plan.hasConflicts
    ? await createImplementationContext({
      root: options.root,
      specPath: workflow.spec.relativePath,
      featureName,
      slug,
      figma,
      assets,
      write: true
    })
    : null;
  const implementationPatch = confirmed && implementation !== null
    ? await createImplementationPatchCandidate({
      root: options.root,
      specPath: workflow.spec.relativePath,
      featureName,
      slug,
      context: implementation,
      write: true,
      apply: options.apply
    })
    : null;
  const quickCheck = confirmed && figma !== null && !figma.plan.hasConflicts
    ? await runIntegratedChecks(options.root, {
      quick: true,
      env: process.env
    })
    : null;
  const report = {
    root: workflow.root,
    url: options.url,
    featureName,
    slug,
    workflow,
    figma,
    assets,
    implementation,
    implementationPatch,
    quickCheck,
    written: [
      ...workflowWritten,
      ...figmaWritten,
      ...(implementation?.written === null || implementation?.written === undefined ? [] : [implementation.written]),
      ...(implementationPatch?.written === null || implementationPatch?.written === undefined ? [] : [implementationPatch.written]),
      ...(implementationPatch?.applied === null || implementationPatch?.applied === undefined ? [] : [implementationPatch.applied])
    ],
    nextActions: createFigmaImportNextActions(confirmed, workflow.spec.relativePath, figma, implementation, implementationPatch)
  };
  printJsonOr(report, options.json, printFigmaImport);
  if (figma?.plan.hasConflicts === true || quickCheck?.valid === false) {
    process.exitCode = 2;
  }
}

function extractFigmaUrl(task: string): string | null {
  const match = task.match(/https?:\/\/(?:www\.)?figma\.com\/[^\s"'<>]+/iu);
  if (match === null) {
    return null;
  }
  return match[0].replace(/[),，。；;]+$/u, "");
}

function taskExplicitlyAllowsApply(task: string): boolean {
  if (/不要\s*(?:--apply|应用|创建)|禁止\s*(?:--apply|应用|创建)|不(?:要|允许).*创建/u.test(task)) {
    return false;
  }
  return /--apply|允许使用\s*--apply|明确允许.*apply|可以直接创建缺失页面|直接创建缺失页面/u.test(task);
}

function taskLooksLikeHtwInspection(task: string): boolean {
  return /\bHTWTable\b|\bhtw-table\b|HTW\s*Table|表格组件|表格\s*API|使用\s*HTW|核对\s*HTW/u.test(task);
}

function taskLooksLikeQualityCheck(task: string): boolean {
  return /自检|检查项目|跑检查|质量检查|质检|交付前检查|review\s*前|审查前|quick\s*check|azi\s*check/u.test(task);
}

function taskLooksLikeFeatureWork(task: string): boolean {
  if (/是什么|为什么|原理|解释|总结|评价|有哪些|怎么用|如何用|help|帮助|\?/iu.test(task)) {
    return false;
  }
  return /开发|实现|新增|新建|创建|改造|修改|修复|优化|调整|接入|适配|补齐|页面|功能|列表|表单|详情|弹窗|菜单|路由|CRUD|bug|需求/iu.test(task);
}

function deriveTaskFeature(task: string): { featureName: string; slug: string } {
  const featureName = task
    .replace(/https?:\/\/\S+/giu, "")
    .replace(/^(?:请|帮我|帮忙|麻烦|继续|接着|然后|现在|我要|需要)\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 64) || "自然语言任务";
  const ascii = featureName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
  const hash = createHash("sha256").update(task).digest("hex").slice(0, 8);
  const slug = ascii.length >= 3 ? ascii.slice(0, 40).replace(/-+$/u, "") : `task-${hash}`;
  return { featureName, slug };
}

async function runSkill(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;
  if (subcommand === "match") {
    const options = parseSkillMatchArguments(rest);
    const report = await runSkillMatch(options);
    printJsonOr(report, options.json, printSkillMatch);
    return;
  }
  if (subcommand === "list") {
    const options = parseSkillListArguments(rest);
    const report = await runSkillList({
      root: options.root,
      ...(options.category === null ? {} : { category: options.category }),
      enabledOnly: options.enabledOnly
    });
    printJsonOr(report, options.json, printSkillList);
    return;
  }
  if (subcommand === "search") {
    const options = parseSkillSearchArguments(rest);
    const report = await runSkillSearch(options.root, options.keyword);
    printJsonOr(report, options.json, printSkillSearch);
    return;
  }
  if (subcommand === "doctor") {
    const options = parseSkillDoctorArguments(rest);
    const report = await runSkillDoctor(options.root);
    printJsonOr(report, options.json, printSkillDoctor);
    process.exitCode = report.valid ? 0 : 2;
    return;
  }
  if (subcommand === "sources") {
    const options = parseSkillSourcesArguments(rest);
    const report = await runSkillSources(options.root);
    printJsonOr(report, options.json, printSkillSources);
    return;
  }
  if (subcommand === "install-guide") {
    const options = parseSkillInstallGuideArguments(rest);
    const report = await runSkillInstallGuide(options.root, options.sourceId);
    printJsonOr(report, options.json, printSkillInstallGuide);
    return;
  }
  throw new Error("Usage: azi skill <list|search|match|doctor|sources|install-guide> ...");
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
    "  azi workflow start <feature-name> [root] [--task <description>] [--slug <feature-slug>] [--dry-run] [--yes] [--json]",
    "  azi workflow status [root] [--json]",
    "  azi workflow advance [root] --target <spec-path> --to <stage> [--force --reason <text>] [--json]",
    "  azi workflow log [root] --target <spec-path> [--json]",
    "  azi review [path] [--target <spec-path>] [--ci] [--diff] [--evidence] [--suggest-patch] [--write] [--json] [--full]",
    "  azi sdd <clarify|prd|issues|tasks|acceptance|retrospective|status> [root] --target <spec-path> [--write] [--json]",
    "  azi figma <figma-node-url> [root] [--feature <name>] [--slug <feature-slug>] [--yes] [--apply] [--json]",
    "  azi figma spec [root] --target <spec-path> --url <figma-node-url> [--write] [--json]",
    "  azi figma cache [root] --target <spec-path> [--json]",
    "  azi figma status [root] --target <spec-path> [--json]",
    "  azi figma fallback [root] --target <spec-path> --source <figma-export|screenshot|legacy-page> --reference <path-or-url> [--retried-at <time>] [--notes <text>] [--write] [--json]",
    "  azi task <user-task> [root] [--apply] [--json] [--include-avoided]",
    "  azi go <user-task> [root] [--apply] [--json] [--include-avoided]",
    "  azi context <task-description> [root] [--json] [--include-avoided]",
    "  azi htw inspect [path] [--json] [--write-doc]",
    "  azi skill list [root] [--category <name>] [--enabled-only] [--json]",
    "  azi skill search <keyword> [root] [--json]",
    "  azi skill match <task-description> [root] [--json] [--limit <n>] [--include-avoided]",
    "  azi skill doctor [root] [--json]",
    "  azi skill sources [root] [--json]",
    "  azi skill install-guide <source-id> [root] [--json]",
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
    "  workflow Start, inspect, advance, and audit feature workflows",
    "  review   Generate a delivery review report",
    "  sdd      Generate SDD prompts and check REQ/TASK/ACC traceability",
    "  figma   Cache Figma node sources and create reviewable or applied page patches",
    "  task    Route natural-language tasks to Figma, HTWTable, checks, or context",
    "  go      Alias for task",
    "  context  Print an AI startup context for a task",
    "  htw      Inspect the installed HTWTable public API signals",
    "  skill    Browse, validate, and match the project Skill Hub",
    "  spec     Create or validate feature specifications",
    "",
    "Options:",
    "  --json      Print the complete project profile as JSON",
    "  --explain   Print evidence and conflicts",
    "  --quick     Skip project lint/test/build commands during `azi check`",
    "  --include-avoided  Include sources rejected by avoidWhenAny rules",
    "  --write-proposals  Write reviewable patches into `.harness/proposals/`",
    "  --write     Write generated review or SDD auxiliary output",
    "  --full      Run project commands during `azi review`",
    "  --ci        Fail on blocked or needs-review findings; implies --diff and --evidence",
    "  --diff      Include a bounded tracked Git diff in the Review report",
    "  --evidence  Require acceptance and command execution evidence",
    "  --suggest-patch  Write a reviewable acceptance suggestion patch",
    "  --apply    Apply direct Figma import page creation when the target file is missing",
    "  --write-doc  Write an inspection document into `.harness/docs/`",
    "  --limit     Limit the number of returned skill matches",
    "  --dry-run   Preview initialization without writing files",
    "  --yes, -y   Apply initialization without an interactive prompt",
    "  --help      Show this help",
    "  --version   Show the CLI version",
    ""
  ].join("\n"));
}

function printWorkflowStart(prepared: PreparedWorkflowStart): void {
  process.stdout.write([
    "azi-harness workflow start",
    "",
    `Root:      ${prepared.root}`,
    `Feature:   ${prepared.featureName}`,
    `Slug:      ${prepared.slug}`,
    `Task:      ${prepared.task}`,
    `Spec:      ${prepared.spec.relativePath} (${prepared.spec.status})`,
    `Stage:     ${prepared.workflowState.currentStage}`,
    `State:     ${prepared.workflowState.statePath}`,
    ""
  ].join("\n"));

  if (prepared.spec.plan !== null) {
    process.stdout.write("Spec plan:\n");
    for (const entry of prepared.spec.plan.entries) {
      process.stdout.write(`${entry.action.toUpperCase().padEnd(8)} ${entry.intent.path}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write("Skill match:\n");
  if (prepared.context.skillMatch.matches.length === 0) {
    process.stdout.write(`- none: ${prepared.context.skillMatch.fallback.message}\n`);
  } else {
    for (const match of prepared.context.skillMatch.matches) {
      process.stdout.write(`- ${match.sourceId}: ${match.recommendedSkills.join(", ")}\n`);
    }
  }

  process.stdout.write("\nRead first:\n");
  for (const file of prepared.context.readFirst) {
    process.stdout.write(`- ${file}\n`);
  }

  if (prepared.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of prepared.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  process.stdout.write("\nNext steps:\n");
  for (const step of prepared.nextSteps) {
    process.stdout.write(`- ${step}\n`);
  }
}

function printWorkflowStatus(report: WorkflowStatusReport): void {
  process.stdout.write([
    "azi-harness workflow status",
    "",
    `Root:       ${report.root}`,
    `Workflows:  ${report.workflows.length}`,
    ""
  ].join("\n"));

  if (report.workflows.length === 0) {
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
    return;
  }

  for (const workflow of report.workflows) {
    const current = workflow.stages.find((stage) => stage.id === workflow.currentStage);
    process.stdout.write(`- ${workflow.specPath}\n`);
    process.stdout.write(`  feature: ${workflow.featureName}\n`);
    process.stdout.write(`  stage: ${workflow.currentStage}${current === undefined ? "" : ` (${current.title})`}\n`);
    process.stdout.write(`  status: ${workflow.status}\n`);
    process.stdout.write(`  updated: ${workflow.updatedAt}\n`);
    process.stdout.write(`  next: ${workflow.nextStep}\n`);
    if (workflow.blockers.length > 0) {
      process.stdout.write("  blockers:\n");
      for (const blocker of workflow.blockers) {
        process.stdout.write(`  - ${blocker}\n`);
      }
    }
  }
}

function printWorkflowAdvance(
  workflow: WorkflowState,
  changed: string[],
  warnings: string[]
): void {
  const current = workflow.stages.find((stage) => stage.id === workflow.currentStage);
  process.stdout.write([
    "azi-harness workflow advance",
    "",
    `Spec:      ${workflow.specPath}`,
    `Stage:     ${workflow.currentStage}${current === undefined ? "" : ` (${current.title})`}`,
    `Status:    ${workflow.status}`,
    `Updated:   ${workflow.updatedAt}`,
    ""
  ].join("\n"));

  if (warnings.length > 0) {
    process.stdout.write("Warnings:\n");
    for (const warning of warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
    process.stdout.write("\n");
  }

  if (changed.length > 0) {
    process.stdout.write("Updated files:\n");
    for (const file of changed) {
      process.stdout.write(`- ${file}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write("Next:\n");
  process.stdout.write(`- ${workflow.nextStep}\n`);
}

function printWorkflowLog(report: WorkflowLogReport): void {
  process.stdout.write([
    "azi-harness workflow log",
    "",
    `Root:   ${report.root}`,
    `Spec:   ${report.workflow.specPath}`,
    `Stage:  ${report.workflow.currentStage}`,
    ""
  ].join("\n"));

  for (const entry of report.workflow.logs) {
    const from = entry.from === null ? "none" : entry.from;
    const force = entry.forced ? " force" : "";
    const reason = entry.reason === null ? "" : ` reason=${entry.reason}`;
    process.stdout.write(`- ${entry.at} ${from} -> ${entry.to}${force}${reason}\n`);
    process.stdout.write(`  ${entry.note}\n`);
  }
}

function printReview(report: ReviewReport): void {
  process.stdout.write([
    "azi-harness review",
    "",
    `Root:       ${report.root}`,
    `Target:     ${report.target ?? "none"}`,
    `Result:     ${report.recommendation}`,
    `Findings:   ${report.findings.length}`,
    ""
  ].join("\n"));

  for (const finding of report.findings) {
    process.stdout.write(`- [${finding.severity}] ${finding.area}/${finding.code}: ${finding.message}\n`);
  }
}

function printSddStatus(report: SddStatusReport): void {
  process.stdout.write([
    "azi-harness sdd status",
    "",
    `Root:      ${report.root}`,
    `Spec:      ${report.specPath}`,
    `Stage:     ${report.stage}`,
    `Valid:     ${report.valid ? "yes" : "no"}`,
    ""
  ].join("\n"));

  process.stdout.write("Traceability:\n");
  process.stdout.write(`- requirements: ${report.traceability.requirementIds.join(", ") || "none"}\n`);
  process.stdout.write(`- tasks: ${report.traceability.taskIds.join(", ") || "none"}\n`);
  process.stdout.write(`- acceptance: ${report.traceability.acceptanceIds.join(", ") || "none"}\n`);
  for (const [requirement, tasks] of Object.entries(report.traceability.requirementToTasks)) {
    process.stdout.write(`- ${requirement} tasks: ${tasks.join(", ") || "none"}\n`);
  }
  for (const [requirement, acceptance] of Object.entries(report.traceability.requirementToAcceptance)) {
    process.stdout.write(`- ${requirement} acceptance: ${acceptance.join(", ") || "none"}\n`);
  }

  if (report.blockingIssues.length > 0) {
    process.stdout.write("\nBlocking issues:\n");
    for (const issue of report.blockingIssues) {
      process.stdout.write(`- ${issue}\n`);
    }
  }

  if (report.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  process.stdout.write("\nNext actions:\n");
  for (const action of report.nextActions) {
    process.stdout.write(`- ${action}\n`);
  }
}

function printSddArtifact(report: SddArtifactReport): void {
  process.stdout.write([
    `azi-harness sdd ${report.phase}`,
    "",
    `Root:      ${report.root}`,
    `Spec:      ${report.specPath}`,
    `Artifact:  ${report.artifactPath}`,
    `Written:   ${report.written.length === 0 ? "no" : report.written.join(", ")}`,
    ""
  ].join("\n"));

  if (report.plan.hasConflicts) {
    process.stdout.write("Write plan has conflicts. Existing files were not overwritten:\n");
    for (const entry of report.plan.entries.filter((entry) => entry.action === "conflict")) {
      process.stdout.write(`- ${entry.intent.path}: ${entry.reason}\n`);
    }
    process.stdout.write("\n");
  }

  if (report.written.length === 0) {
    process.stdout.write(report.content);
    if (!report.content.endsWith("\n")) {
      process.stdout.write("\n");
    }
  }
}

function printFigmaWrite(report: PreparedFigmaWrite & { written: string[] }): void {
  process.stdout.write([
    "azi-harness figma",
    "",
    `Root:       ${report.root}`,
    `Spec:       ${report.specPath}`,
    `Cache:      ${report.cachePath}`,
    `Source:     ${report.source.source.type}`,
    `Status:     ${report.source.source.status}`,
    `Node:       ${report.source.source.nodeId || "none"}`,
    `Cache reuse: ${report.cacheReuse.status} (${report.cacheReuse.cacheKey})`,
    `Proposal:   ${report.proposalPath}`,
    `Written:    ${report.written.length === 0 ? "no" : report.written.join(", ")}`,
    ""
  ].join("\n"));

  if (report.plan.hasConflicts) {
    process.stdout.write("Write plan has conflicts. Existing files were not overwritten:\n");
    for (const entry of report.plan.entries.filter((entry) => entry.action === "conflict")) {
      process.stdout.write(`- ${entry.intent.path}: ${entry.reason}\n`);
    }
    process.stdout.write("\n");
  } else if (report.written.length === 0) {
    process.stdout.write("Preview only. Re-run with --write to create cache files and the reviewable spec patch.\n\n");
  }

  process.stdout.write("Cache:\n");
  process.stdout.write(`- ${report.cacheReuse.message}\n`);
  if (report.cacheReuse.matchedCachePath !== null) {
    process.stdout.write(`- matched: ${report.cacheReuse.matchedCachePath}\n`);
  }
  process.stdout.write("\n");

  if (report.warnings.length > 0) {
    process.stdout.write("Warnings:\n");
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write("Next actions:\n");
  for (const action of report.nextActions) {
    process.stdout.write(`- ${action}\n`);
  }
}

function printFigmaImport(report: {
  root: string;
  url: string;
  featureName: string;
  slug: string;
  workflow: PreparedWorkflowStart;
  figma: PreparedFigmaWrite | null;
  assets: FigmaAssetDownloadReport | null;
  implementation: ImplementationContextReport | null;
  implementationPatch: ImplementationPatchReport | null;
  quickCheck: IntegratedCheckReport | null;
  written: string[];
  nextActions: string[];
}): void {
  process.stdout.write([
    "azi-harness figma import",
    "",
    `Root:       ${report.root}`,
    `URL:        ${report.url}`,
    `Feature:    ${report.featureName}`,
    `Slug:       ${report.slug}`,
    `Spec:       ${report.workflow.spec.relativePath}`,
    `Workflow:   ${report.workflow.spec.status}`,
    `Cache:      ${report.figma?.cachePath ?? "pending"}`,
    `Cache reuse: ${report.figma === null ? "pending" : `${report.figma.cacheReuse.status} (${report.figma.cacheReuse.cacheKey})`}`,
    `Proposal:   ${report.figma?.proposalPath ?? "pending"}`,
    `Assets:     ${report.assets === null ? "pending" : `${report.assets.status} (${report.assets.icons.length} svg)`}`,
    `Asset cache: ${report.assets === null ? "pending" : report.assets.cacheReuse.status}`,
    `Context:    ${report.implementation?.contextPath ?? "pending"}`,
    `Target:     ${report.implementation?.suggestedTarget ?? "pending"}`,
    `Patch:      ${report.implementationPatch?.proposalPath ?? "pending"} (${report.implementationPatch?.status ?? "pending"})`,
    `Check:      ${report.quickCheck === null ? "pending" : report.quickCheck.valid ? "ok" : `failed (${report.quickCheck.errors} errors)`}`,
    `Written:    ${report.written.length === 0 ? "no" : report.written.join(", ")}`,
    ""
  ].join("\n"));

  if (report.workflow.workflowPlan?.hasConflicts === true) {
    process.stdout.write("Workflow write plan has conflicts. Existing files were not overwritten:\n");
    for (const entry of report.workflow.workflowPlan.entries.filter((entry) => entry.action === "conflict")) {
      process.stdout.write(`- ${entry.intent.path}: ${entry.reason}\n`);
    }
    process.stdout.write("\n");
  } else if (report.figma?.plan.hasConflicts === true) {
    process.stdout.write("Figma write plan has conflicts. Existing files were not overwritten:\n");
    for (const entry of report.figma.plan.entries.filter((entry) => entry.action === "conflict")) {
      process.stdout.write(`- ${entry.intent.path}: ${entry.reason}\n`);
    }
    process.stdout.write("\n");
  } else if (report.written.length === 0) {
    process.stdout.write("Preview only. Re-run with --yes to create the workflow, cache, and proposal files.\n\n");
  }

  if (report.figma !== null) {
    process.stdout.write("Figma cache:\n");
    process.stdout.write(`- ${report.figma.cacheReuse.message}\n`);
    if (report.figma.cacheReuse.matchedCachePath !== null) {
      process.stdout.write(`- matched: ${report.figma.cacheReuse.matchedCachePath}\n`);
    }
    process.stdout.write("\n");
  }

  if (report.assets !== null) {
    process.stdout.write("Asset cache:\n");
    process.stdout.write(`- ${report.assets.cacheReuse.message}\n`);
    if (report.assets.cacheReuse.matchedCachePath !== null) {
      process.stdout.write(`- matched: ${report.assets.cacheReuse.matchedCachePath}\n`);
    }
    process.stdout.write("\n");
  }

  if (report.assets !== null && (report.assets.skipped.length > 0 || report.assets.warnings.length > 0)) {
    process.stdout.write("Assets:\n");
    for (const skipped of report.assets.skipped) {
      process.stdout.write(`- skipped: ${skipped}\n`);
    }
    for (const warning of report.assets.warnings) {
      process.stdout.write(`- warning: ${warning}\n`);
    }
    if (report.assets.retriedAt !== "") {
      process.stdout.write(`- retriedAt: ${report.assets.retriedAt}\n`);
    }
    process.stdout.write("\n");
  }

  if (report.implementation !== null) {
    process.stdout.write("Similar pages:\n");
    if (report.implementation.similarPages.length === 0) {
      process.stdout.write("- none\n");
    } else {
      for (const page of report.implementation.similarPages) {
        process.stdout.write(`- ${page.path} (score ${page.score})\n`);
      }
    }
    process.stdout.write("\n");
  }

  if (report.implementationPatch !== null) {
    process.stdout.write("Implementation patch:\n");
    process.stdout.write(`- status: ${report.implementationPatch.status}\n`);
    process.stdout.write(`- target: ${report.implementationPatch.targetPath}\n`);
    process.stdout.write(`- proposal: ${report.implementationPatch.proposalPath}\n`);
    if (report.implementationPatch.applied !== null) {
      process.stdout.write(`- applied: ${report.implementationPatch.applied}\n`);
    }
    if (report.implementationPatch.sourcePath !== null) {
      process.stdout.write(`- source: ${report.implementationPatch.sourcePath}\n`);
    }
    if (report.implementationPatch.reason !== null) {
      process.stdout.write(`- reason: ${report.implementationPatch.reason}\n`);
    }
    for (const warning of report.implementationPatch.warnings) {
      process.stdout.write(`- warning: ${warning}\n`);
    }
    process.stdout.write("\n");
  }

  if (report.quickCheck !== null) {
    process.stdout.write("Quick check:\n");
    process.stdout.write(`- status: ${report.quickCheck.valid ? "ok" : "failed"}\n`);
    process.stdout.write(`- errors: ${report.quickCheck.errors}\n`);
    process.stdout.write(`- warnings: ${report.quickCheck.warnings}\n`);
    process.stdout.write(`- commands: ${report.quickCheck.commands.skipped ? "skipped" : report.quickCheck.commands.valid ? "ok" : "failed"}\n`);
    const quickErrors = [
      ...report.quickCheck.specs.errors,
      ...report.quickCheck.rules.errors,
      ...report.quickCheck.commands.errors
    ].slice(0, 5);
    const quickWarnings = [
      ...report.quickCheck.specs.warnings,
      ...report.quickCheck.rules.warnings,
      ...report.quickCheck.commands.warnings
    ].slice(0, 5);
    for (const error of quickErrors) {
      process.stdout.write(`- error: ${error}\n`);
    }
    for (const warning of quickWarnings) {
      process.stdout.write(`- warning: ${warning}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write("Next actions:\n");
  for (const action of report.nextActions) {
    process.stdout.write(`- ${action}\n`);
  }
}

function createFigmaImportNextActions(
  applied: boolean,
  specPath: string,
  figma: PreparedFigmaWrite | null,
  implementation: ImplementationContextReport | null,
  implementationPatch: ImplementationPatchReport | null
): string[] {
  if (!applied) {
    return ["确认自动识别的功能名和规格目录无误后，重新运行 `azi figma <figma-node-url> --yes`。"];
  }
  if (figma?.plan.hasConflicts === true) {
    return ["处理 `.harness/figma-cache/` 或 `.harness/proposals/` 的冲突后重新运行。"];
  }
  const actions = [
    implementation?.contextPath === undefined
      ? "生成 Codex 实现上下文后，再进入代码修改。"
      : `把 ${implementation.contextPath} 作为 Codex 实现上下文，直接开始最小补丁。`,
    implementationPatch?.applied !== null && implementationPatch?.applied !== undefined
      ? `已创建 ${implementationPatch.applied}，继续补齐真实接口、权限、字典和字段事实。`
      : implementationPatch?.written === null || implementationPatch?.written === undefined
      ? "目标页面已存在或缺少相似页时，按上下文手动做最小补丁。"
      : `审查候选实现补丁 ${implementationPatch.written}，确认后再应用。`,
    `审查并按需应用 ${figma?.proposalPath ?? ".harness/proposals/*-figma-source.patch"}。`,
    `运行 \`npx azi spec validate ${specPath}\` 检查规格阻塞项。`,
    "补齐接口、权限、字典和后端字段事实；不要从 Figma 推断这些内容。"
  ];
  if (process.env.FIGMA_TOKEN === undefined || process.env.FIGMA_TOKEN.trim() === "") {
    actions.unshift("如需自动下载 SVG icon，设置 `FIGMA_TOKEN` 后重新运行；已有缓存不会重复请求 Figma。");
  }
  return actions;
}

function printFigmaCacheStatus(report: FigmaCacheStatus): void {
  process.stdout.write([
    "azi-harness figma status",
    "",
    `Root:    ${report.root}`,
    `Spec:    ${report.specPath}`,
    `Cache:   ${report.cachePath}`,
    `Exists:  ${report.exists ? "yes" : "no"}`,
    ""
  ].join("\n"));

  process.stdout.write("Files:\n");
  if (report.files.length === 0) {
    process.stdout.write("- none\n");
  } else {
    for (const file of report.files) {
      process.stdout.write(`- ${file}\n`);
    }
  }

  if (report.source !== null) {
    process.stdout.write("\nSource:\n");
    process.stdout.write(`- type: ${report.source.source.type}\n`);
    process.stdout.write(`- status: ${report.source.source.status}\n`);
    process.stdout.write(`- node: ${report.source.source.nodeId || "none"}\n`);
    process.stdout.write(`- fallback: ${report.source.source.fallback || "none"}\n`);
    process.stdout.write(`- retriedAt: ${report.source.source.retriedAt || "none"}\n`);
  }

  if (report.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }

  process.stdout.write("\nNext actions:\n");
  for (const action of report.nextActions) {
    process.stdout.write(`- ${action}\n`);
  }
}

function printContext(context: ContextDocument): void {
  process.stdout.write([
    "azi-harness context",
    "",
    `Root:         ${context.root}`,
    `Task:         ${context.task}`,
    `Project type: ${context.project.projectType}`,
    `Package mgr:  ${context.project.packageManager}`,
    `Vue major:    ${context.project.vueMajor ?? "unknown"}`,
    `UI:           ${context.project.ui ?? "unknown"}`,
    `RuoYi:        ${context.project.ruoyi ? "yes" : "no"}`,
    `HTWTable:     ${context.project.htwTableInstalled ? "found" : "not found"}`,
    ""
  ].join("\n"));

  process.stdout.write("Skill match:\n");
  if (context.skillMatch.matches.length === 0) {
    process.stdout.write(`- none: ${context.skillMatch.fallback.message}\n`);
  } else {
    for (const match of context.skillMatch.matches) {
      process.stdout.write(`- ${match.sourceId} (${match.confidence}, score ${match.score})\n`);
      process.stdout.write(`  skills: ${match.recommendedSkills.join(", ")}\n`);
      for (const reason of match.reasons) {
        process.stdout.write(`  reason: ${reason}\n`);
      }
    }
  }

  process.stdout.write("\nRead first:\n");
  for (const file of context.readFirst) {
    process.stdout.write(`- ${file}\n`);
  }

  process.stdout.write("\nRules:\n");
  for (const rule of context.rules) {
    process.stdout.write(`- ${rule}\n`);
  }

  process.stdout.write("\nSpecs:\n");
  process.stdout.write(`- ${context.specs.instruction}\n`);

  process.stdout.write("\nCommands:\n");
  process.stdout.write(`- check: ${context.commands.check}\n`);
  if (context.commands.htwInspect !== null) {
    process.stdout.write(`- htw: ${context.commands.htwInspect}\n`);
  }
  printNullableCommand("lint", context.commands.lint);
  printNullableCommand("test", context.commands.test);
  printNullableCommand("build", context.commands.build);

  process.stdout.write("\nGuardrails:\n");
  for (const guardrail of context.guardrails) {
    process.stdout.write(`- ${guardrail}\n`);
  }

  process.stdout.write("\nDoctor:\n");
  process.stdout.write(`- initialized: ${context.doctor.initialized ? "yes" : "no"}\n`);
  if (context.doctor.errors.length === 0 && context.doctor.warnings.length === 0) {
    process.stdout.write("- status: ok\n");
    return;
  }
  for (const error of context.doctor.errors) {
    process.stdout.write(`- error: ${error}\n`);
  }
  for (const warning of context.doctor.warnings) {
    process.stdout.write(`- warning: ${warning}\n`);
  }
}

function printNullableCommand(label: string, command: string | null): void {
  process.stdout.write(`- ${label}: ${command ?? "not detected"}\n`);
}

function printSkillMatch(report: SkillMatchReport): void {
  process.stdout.write([
    "azi-harness skill match",
    "",
    `Root:      ${report.root}`,
    `Skill map: ${report.skillMapPath}`,
    `Catalog:   ${report.skillCatalogPath}`,
    `Task:      ${report.task}`,
    ""
  ].join("\n"));

  if (report.matches.length === 0) {
    process.stdout.write("Matches: none\n");
    process.stdout.write(`Fallback: ${report.fallback.message}\n`);
  } else {
    process.stdout.write("Matches:\n");
    for (const match of report.matches) {
      process.stdout.write(
        `- ${match.sourceId} (${match.confidence}, score ${match.score})`
      );
      if (match.category !== null) {
        process.stdout.write(` [${match.category}]`);
      }
      process.stdout.write("\n");
      process.stdout.write(`  skills: ${match.recommendedSkills.join(", ")}\n`);
      for (const reason of match.reasons) {
        process.stdout.write(`  reason: ${reason}\n`);
      }
      for (const constraint of match.constraints) {
        process.stdout.write(`  constraint: ${constraint}\n`);
      }
      const detail = report.sourceDetails.find((source) => source.id === match.sourceId);
      if (detail !== undefined) {
        process.stdout.write(`  source: ${detail.sourceUrl}\n`);
        process.stdout.write(`  installation: ${detail.installation.mode} (status not verified)\n`);
      }
    }
    process.stdout.write(`Fallback: ${report.fallback.message}\n`);
  }

  if (report.avoided.length > 0) {
    process.stdout.write("\nAvoided:\n");
    for (const avoided of report.avoided) {
      process.stdout.write(`- ${avoided.sourceId}`);
      if (avoided.avoidedWhenAny.length > 0) {
        process.stdout.write(
          `: ${avoided.avoidedWhenAny.map((match) => match.phrase).join(", ")}`
        );
      }
      process.stdout.write("\n");
    }
  }

  if (report.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of report.warnings) {
      process.stdout.write(`- ${warning}\n`);
    }
  }
}

function printSkillList(report: SkillListReport): void {
  process.stdout.write(`azi-harness skill list\n\nCatalog: ${report.skillCatalogPath}\nTotal: ${report.total}\n\n`);
  for (const source of report.sources) {
    const tools = Object.entries(source.tools)
      .filter(([, value]) => value.supported)
      .map(([tool]) => tool)
      .join(", ");
    process.stdout.write(`- ${source.id} [${source.category}] ${source.enabled ? "enabled" : "disabled"}\n`);
    process.stdout.write(`  ${source.description}\n`);
    process.stdout.write(`  source: ${source.sourceUrl}\n`);
    process.stdout.write(`  recommended: ${source.recommendedScenarios.join(", ") || "none"}\n`);
    process.stdout.write(`  avoid: ${source.avoidScenarios.join(", ") || "none"}\n`);
    process.stdout.write(`  tools: ${tools}\n`);
    process.stdout.write(
      `  install: ${source.installation.mode}; manual=${source.installation.manualInstallRequired ? "yes" : "no"}; global=${source.installation.globallyReusable ? "yes" : "no"}; index-only=${source.installation.indexOnly ? "yes" : "no"}; status not verified\n`
    );
  }
}

function printSkillSearch(report: SkillSearchReport): void {
  process.stdout.write(`azi-harness skill search\n\nKeyword: ${report.keyword}\nMatches: ${report.matches.length}\n\n`);
  for (const match of report.matches) {
    process.stdout.write(`- ${match.source.id} [${match.source.category}] score ${match.score}\n`);
    process.stdout.write(`  matched fields: ${match.matchedFields.join(", ")}\n`);
    process.stdout.write(`  ${match.source.description}\n`);
  }
  if (report.matches.length === 0) {
    process.stdout.write("No catalog source matched. Fall back to `.harness/rules/` and `specs/`.\n");
  }
}

function printSkillDoctor(report: SkillDoctorReport): void {
  process.stdout.write(`azi-harness skill doctor\n\nStatus: ${report.valid ? "ok" : "failed"}\n`);
  for (const error of report.errors) {
    process.stdout.write(`- error: ${error}\n`);
  }
  for (const warning of report.warnings) {
    process.stdout.write(`- warning: ${warning}\n`);
  }
  for (const note of report.notes) {
    process.stdout.write(`- note: ${note}\n`);
  }
}

function printSkillSources(report: SkillSourcesReport): void {
  process.stdout.write(`azi-harness skill sources\n\nInstallation status: ${report.installationStatusPolicy}\n\n`);
  for (const source of report.sources) {
    process.stdout.write(`- ${source.id}: ${source.sourceUrl}\n`);
  }
}

function printSkillInstallGuide(report: SkillInstallGuideReport): void {
  process.stdout.write(`azi-harness skill install-guide\n\nSource: ${report.source.id}\nURL: ${report.source.sourceUrl}\n`);
  process.stdout.write(`Mode: ${report.source.installation.mode}\nNotice: ${report.installationStatusNotice}\n\nTools:\n`);
  for (const [tool, guide] of Object.entries(report.source.tools)) {
    process.stdout.write(`- ${tool}: ${guide.supported ? "supported" : "not declared"}; ${guide.status}\n`);
    if (guide.installHint !== null) {
      process.stdout.write(`  ${guide.installHint}\n`);
    }
  }
  if (report.source.constraints.length > 0) {
    process.stdout.write("\nConstraints:\n");
    for (const constraint of report.source.constraints) {
      process.stdout.write(`- ${constraint}\n`);
    }
  }
}

function printJsonOr<T>(report: T, json: boolean, printer: (value: T) => void): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  printer(report);
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
