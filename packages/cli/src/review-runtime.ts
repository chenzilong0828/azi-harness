import { readFile } from "node:fs/promises";
import path from "node:path";

import { runIntegratedChecks, type IntegratedCheckReport } from "@azi-harness/checks";
import {
  applyRuntimeWritePlan,
  createAppendOnlyPatch,
  createRuntimeWritePlan,
  resolveInsideRoot,
  type RuntimeFileIntent
} from "@azi-harness/core";
import { detectProject } from "@azi-harness/detectors";

import {
  createAuditFindings,
  inspectGitReviewState,
  inspectReviewSpec,
  type GitReviewState,
  type ReviewFinding,
  type ReviewSpecAudit
} from "./review-audit.js";
import {
  runRuntimeDoctor,
  type DoctorReport
} from "./doctor-runtime.js";
import { createRuoyiGuardFindings } from "./ruoyi-guard.js";
import { runSpecValidation } from "./spec-runtime.js";

export type { GitReviewState, ReviewFinding, ReviewFindingSeverity } from "./review-audit.js";

export interface ReviewReport {
  root: string;
  generatedAt: string;
  target: string | null;
  recommendation: "blocked" | "needs-review" | "ready";
  options: {
    includeDiff: boolean;
    requireEvidence: boolean;
    ci: boolean;
  };
  doctor: DoctorReport;
  checks: IntegratedCheckReport;
  targetSpec: Awaited<ReturnType<typeof runSpecValidation>> | null;
  specAudit: ReviewSpecAudit | null;
  git: GitReviewState;
  findings: ReviewFinding[];
  nextActions: string[];
}

export interface CreateReviewOptions {
  root: string;
  target?: string;
  quick: boolean;
  ci?: boolean;
  diff?: boolean;
  evidence?: boolean;
  generatedAt?: string;
}

export interface ReviewProposalWriteReport {
  root: string;
  written: string[];
  skipped: string[];
}

export async function createReviewReport(options: CreateReviewOptions): Promise<ReviewReport> {
  const root = path.resolve(options.root);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const ci = options.ci ?? false;
  const includeDiff = ci ? true : options.diff ?? false;
  const requireEvidence = ci ? true : options.evidence ?? false;
  const doctor = await runRuntimeDoctor(root);
  const checks = await runIntegratedChecks(root, {
    quick: options.quick,
    env: process.env
  });
  const profile = await detectProject(root);
  const targetSpec = options.target === undefined
    ? null
    : await runSpecValidation(root, options.target);
  const git = await inspectGitReviewState(root, includeDiff);
  const specAudit = options.target === undefined
    ? null
    : await inspectReviewSpec(root, options.target, git, checks);
  const ruoyiFindings = profile.effective.ruoyi.value
    ? await createRuoyiGuardFindings({
      root,
      git,
      target: options.target ?? null
    })
    : [];
  const findings = deduplicateFindings([
    ...createBaseFindings(doctor, checks, targetSpec, options.target ?? null),
    ...git.warnings.map((warning) => finding("warning", "git", "git-command-warning", warning)),
    ...ruoyiFindings,
    ...createAuditFindings({
      target: options.target ?? null,
      git,
      spec: specAudit,
      requireEvidence
    })
  ]);
  if (findings.length === 0) {
    findings.push(finding(
      "info",
      "review",
      "review-no-automated-blockers",
      "未发现自动化阻塞项，仍需人工确认业务事实、视觉对照和验收记录。"
    ));
  }
  const recommendation = recommend(findings);

  return {
    root,
    generatedAt,
    target: options.target ?? null,
    recommendation,
    options: { includeDiff, requireEvidence, ci },
    doctor,
    checks,
    targetSpec,
    specAudit,
    git,
    findings,
    nextActions: createNextActions(recommendation, options.target ?? null, git, specAudit)
  };
}

export async function writeReviewReport(report: ReviewReport): Promise<string> {
  const relativePath = `.harness/reviews/${reportStamp(report)}-${targetSuffix(report)}.md`;
  const intent: RuntimeFileIntent = {
    path: relativePath,
    content: createReviewMarkdown(report),
    ownership: "seeded",
    templateVersion: "2"
  };
  const plan = await createRuntimeWritePlan(report.root, [intent]);
  if (plan.hasConflicts) {
    throw new Error(`Review report already exists: ${relativePath}`);
  }
  const written = await applyRuntimeWritePlan(plan);
  return written[0] ?? relativePath;
}

export async function writeReviewSuggestion(
  report: ReviewReport
): Promise<ReviewProposalWriteReport> {
  if (report.target === null || report.specAudit === null) {
    return {
      root: report.root,
      written: [],
      skipped: ["未指定目标规格，无法生成 acceptance.md 建议补丁。"]
    };
  }

  const candidates = report.findings.filter((item) => item.severity !== "info");
  if (candidates.length === 0) {
    return {
      root: report.root,
      written: [],
      skipped: ["没有 error 或 warning 级问题，无需生成建议补丁。"]
    };
  }

  const acceptanceRelative = path.posix.join(report.target, "acceptance.md");
  const acceptancePath = resolveInsideRoot(report.root, acceptanceRelative);
  const existing = await readFile(acceptancePath, "utf8");
  const addition = createSuggestionSection(report, candidates);
  const proposalPath = `.harness/proposals/${reportStamp(report)}-${targetSuffix(report)}-review.patch`;
  const intent: RuntimeFileIntent = {
    path: proposalPath,
    content: createAppendOnlyPatch(acceptanceRelative, existing, addition),
    ownership: "seeded",
    templateVersion: "1"
  };
  const plan = await createRuntimeWritePlan(report.root, [intent]);
  if (plan.hasConflicts) {
    throw new Error(`Review proposal already exists: ${proposalPath}`);
  }
  const written = await applyRuntimeWritePlan(plan);
  return {
    root: report.root,
    written,
    skipped: written.length === 0 ? [`相同建议补丁已存在：${proposalPath}`] : []
  };
}

export function createReviewMarkdown(report: ReviewReport): string {
  return [
    "# azi-harness Review 报告",
    "",
    `- 生成时间：${report.generatedAt}`,
    `- 项目根目录：${report.root}`,
    `- 目标规格：${report.target ?? "未指定"}`,
    `- 建议结论：${formatRecommendation(report.recommendation)}`,
    `- CI 模式：${report.options.ci ? "已启用" : "未启用"}`,
    `- 检查模式：${report.checks.quick ? "quick" : "full"}`,
    `- Diff 证据：${report.options.includeDiff ? "已启用" : "未启用"}`,
    `- 严格验收证据：${report.options.requireEvidence ? "已启用" : "未启用"}`,
    "",
    "## 审查发现",
    "",
    ...formatFindings(report.findings),
    "",
    "## 规格意图与追踪",
    "",
    ...formatSpecAudit(report.specAudit),
    "",
    "## 变更范围",
    "",
    ...formatScope(report.specAudit),
    "",
    "## 验收证据",
    "",
    ...formatEvidence(report.specAudit),
    "",
    "## Git 变更",
    "",
    `- Git 可用：${report.git.available ? "是" : "否"}`,
    `- 变更文件数：${report.git.changedFiles.length}`,
    `- 已暂存：${report.git.stagedFiles.length}`,
    `- 未暂存：${report.git.unstagedFiles.length}`,
    `- 未跟踪：${report.git.untrackedFiles.length}`,
    "",
    "```text",
    report.git.status || "(no status output)",
    "```",
    "",
    "```text",
    report.git.diffStat || "(no diff stat)",
    "```",
    ...(report.options.includeDiff ? [
      "",
      "### Diff 摘要",
      "",
      "```diff",
      report.git.diff || "(no tracked diff output; untracked files are listed above)",
      "```"
    ] : []),
    "",
    "## Runtime Doctor",
    "",
    `- Initialized：${report.doctor.initialized ? "yes" : "no"}`,
    `- Errors：${report.doctor.errors.length}`,
    `- Warnings：${report.doctor.warnings.length}`,
    "",
    "## Check 摘要",
    "",
    `- Valid：${report.checks.valid ? "yes" : "no"}`,
    `- Errors：${report.checks.errors}`,
    `- Warnings：${report.checks.warnings}`,
    `- Specs：${report.checks.specs.valid ? "ok" : "failed"}`,
    `- Rules：${report.checks.rules.valid ? "ok" : "failed"}`,
    `- Commands：${report.checks.commands.skipped ? "skipped" : report.checks.commands.valid ? "ok" : "failed"}`,
    "",
    "## 下一步",
    "",
    ...report.nextActions.map((action) => `- [ ] ${action}`),
    ""
  ].join("\n");
}

function createBaseFindings(
  doctor: DoctorReport,
  checks: IntegratedCheckReport,
  targetSpec: Awaited<ReturnType<typeof runSpecValidation>> | null,
  target: string | null
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  findings.push(...doctor.errors.map((message) => finding("error", "doctor", "doctor-error", message)));
  findings.push(...doctor.warnings.map((message) => finding("warning", "doctor", "doctor-warning", message)));

  if (target === null) {
    findings.push(...checks.specs.errors.map((message) => finding("error", "specs", "spec-error", message)));
    findings.push(...checks.specs.warnings.map((message) => finding("warning", "specs", "spec-warning", message)));
  } else if (targetSpec !== null) {
    for (const report of targetSpec.reports) {
      findings.push(...report.errors.map((message) => finding("error", "target-spec", "target-spec-error", message)));
      findings.push(...report.warnings.map((message) => finding("warning", "target-spec", "target-spec-warning", message)));
    }
  }

  for (const rule of checks.rules.findings) {
    const severity = rule.ruleId.startsWith("vue2-") || rule.ruleId.startsWith("vue3-")
      ? "error"
      : "warning";
    findings.push(finding(severity, "rules", rule.ruleId, `${rule.file}: ${rule.message}`, {
      evidence: rule.file,
      suggestion: "按目标项目 Vue 版本和运行时规则修正后重新检查。"
    }));
  }
  findings.push(...checks.commands.errors.map((message) => finding("error", "commands", "command-error", message)));
  findings.push(...checks.commands.warnings.map((message) => finding("warning", "commands", "command-warning", message)));
  if (checks.commands.skipped) {
    findings.push(finding(
      "info",
      "commands",
      "commands-skipped",
      checks.commands.skipReason ?? "项目命令检查已跳过。"
    ));
  }
  return findings;
}

function recommend(findings: ReviewFinding[]): ReviewReport["recommendation"] {
  if (findings.some((item) => item.severity === "error")) {
    return "blocked";
  }
  if (findings.some((item) => item.severity === "warning")) {
    return "needs-review";
  }
  return "ready";
}

function createNextActions(
  recommendation: ReviewReport["recommendation"],
  target: string | null,
  git: GitReviewState,
  specAudit: ReviewSpecAudit | null
): string[] {
  const actions: string[] = [];
  if (recommendation === "blocked") {
    actions.push("先处理 error 级问题，再重新运行 `npx azi review`。");
  } else if (recommendation === "needs-review") {
    actions.push("人工复核 warning 级问题并记录处理结论。");
  } else {
    actions.push("补齐人工 Review 记录后再准备提交。");
  }
  if (target === null) {
    actions.push("使用 `--target specs/<id-feature>` 建立规格意图与实现证据的对应关系。");
  } else {
    actions.push(`确认 ${target}/acceptance.md 记录的是本次真实执行结果。`);
  }
  if (specAudit?.scope.outOfScopeFiles.length) {
    actions.push("处理超出 tasks.md 声明范围的文件，或更新规格并说明原因。");
  }
  if (git.available && git.changedFiles.length > 0) {
    actions.push("人工逐文件复核 staged、unstaged 和 untracked 变更后再提交。");
  }
  return actions;
}

function createSuggestionSection(report: ReviewReport, findings: ReviewFinding[]): string {
  return [
    "## azi-harness Review 建议",
    "",
    `- 生成时间：${report.generatedAt}`,
    "- 说明：以下内容来自自动审查建议，必须人工核实后再合并。",
    "",
    ...findings.flatMap((item, index) => [
      `- [ ] REVIEW-${String(index + 1).padStart(3, "0")} [${item.severity}] ${item.message}`,
      ...(item.evidence === undefined ? [] : [`  - Evidence / 证据：${item.evidence}`]),
      ...(item.suggestion === undefined ? [] : [`  - Action / 处理：${item.suggestion}`])
    ]),
    ""
  ].join("\n");
}

function formatFindings(findings: ReviewFinding[]): string[] {
  return findings.flatMap((item) => [
    `- [${item.severity}] ${item.area}/${item.code}: ${item.message}`,
    ...(item.intent === undefined ? [] : [`  - 意图：${item.intent}`]),
    ...(item.evidence === undefined ? [] : [`  - 实现证据：${item.evidence}`]),
    ...(item.suggestion === undefined ? [] : [`  - 建议：${item.suggestion}`])
  ]);
}

function formatSpecAudit(spec: ReviewSpecAudit | null): string[] {
  if (spec === null) {
    return ["- 未指定目标规格，无法建立意图模型。"];
  }
  return [
    `- REQ：${spec.traceability.requirementIds.join(", ") || "无"}`,
    `- TASK：${spec.traceability.taskIds.join(", ") || "无"}`,
    `- ACC：${spec.traceability.acceptanceIds.join(", ") || "无"}`,
    `- 追踪有效：${spec.traceability.valid ? "是" : "否"}`,
    `- HTWTable 决策：${spec.htwTableDecision ?? "未记录"}`
  ];
}

function formatScope(spec: ReviewSpecAudit | null): string[] {
  if (spec === null) {
    return ["- 未指定目标规格，所有变更都需要人工确认范围。"];
  }
  return [
    `- 规格声明文件：${formatList(spec.scope.declaredFiles)}`,
    `- 模糊声明：${formatList(spec.scope.ambiguousDeclarations)}`,
    `- 实现文件：${formatList(spec.scope.implementationFiles)}`,
    `- 范围内：${formatList(spec.scope.inScopeFiles)}`,
    `- 超范围：${formatList(spec.scope.outOfScopeFiles)}`,
    `- 规格与运行时辅助文件：${formatList(spec.scope.supportingFiles)}`
  ];
}

function formatEvidence(spec: ReviewSpecAudit | null): string[] {
  if (spec === null) {
    return ["- 未指定目标规格，无法检查 acceptance.md 和 evidence/。"];
  }
  return [
    `- ACC 完成：${spec.evidence.acceptanceChecked}/${spec.evidence.acceptanceTotal}`,
    `- 证据记录：${formatList(spec.evidence.evidenceEntries)}`,
    `- 证据文件：${formatList(spec.evidence.evidenceFiles)}`,
    `- 缺失证据文件：${formatList(spec.evidence.missingEvidenceFiles)}`,
    ...spec.evidence.commands.map((command) => (
      `- ${command.role}：记录=${command.recordedStatus}，实际=${command.actualStatus}`
    ))
  ];
}

function formatRecommendation(recommendation: ReviewReport["recommendation"]): string {
  switch (recommendation) {
    case "blocked":
      return "阻塞，先修复错误";
    case "needs-review":
      return "需要人工复核";
    case "ready":
      return "可以进入人工 Review";
  }
}

function finding(
  severity: ReviewFinding["severity"],
  area: string,
  code: string,
  message: string,
  details: Pick<ReviewFinding, "intent" | "evidence" | "suggestion"> = {}
): ReviewFinding {
  return { severity, area, code, message, ...details };
}

function deduplicateFindings(findings: ReviewFinding[]): ReviewFinding[] {
  const seen = new Set<string>();
  return findings.filter((item) => {
    const key = `${item.severity}\0${item.area}\0${item.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function reportStamp(report: ReviewReport): string {
  return report.generatedAt.replace(/\D/g, "").slice(0, 17).padEnd(17, "0");
}

function targetSuffix(report: ReviewReport): string {
  return report.target === null
    ? "workspace"
    : path.basename(report.target).replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function formatList(values: string[]): string {
  return values.length === 0 ? "无" : values.join(", ");
}
