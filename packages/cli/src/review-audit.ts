import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { IntegratedCheckReport, ProjectCommandResult } from "@azi-harness/checks";
import {
  pathExists,
  resolveInsideRoot
} from "@azi-harness/core";
import {
  analyzeSpecTraceability,
  type SpecTraceabilityReport
} from "@azi-harness/spec-kit";

const MAX_DIFF_CHARACTERS = 120_000;
const COMMAND_ROLES = ["lint", "test", "build"] as const;

export type ReviewFindingSeverity = "error" | "warning" | "info";

export interface ReviewFinding {
  severity: ReviewFindingSeverity;
  area: string;
  code: string;
  message: string;
  intent?: string;
  evidence?: string;
  suggestion?: string;
}

export interface GitFileChange {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface GitReviewState {
  available: boolean;
  status: string;
  diffStat: string;
  changedFiles: string[];
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
  changes: GitFileChange[];
  diff: string;
  diffTruncated: boolean;
  warnings: string[];
}

export type RecordedCommandStatus = "passed" | "failed" | "skipped" | "pending" | "unknown" | "missing";

export interface ReviewCommandEvidence {
  role: typeof COMMAND_ROLES[number];
  recorded: string | null;
  recordedStatus: RecordedCommandStatus;
  actualStatus: ProjectCommandResult["status"] | "not-run";
  actualCommand: string | null;
  actualReason: string | null;
}

export interface ReviewEvidenceAudit {
  acceptanceTotal: number;
  acceptanceChecked: number;
  evidenceEntries: string[];
  evidenceFiles: string[];
  missingEvidenceFiles: string[];
  commands: ReviewCommandEvidence[];
}

export interface ReviewScopeAudit {
  declaredFiles: string[];
  ambiguousDeclarations: string[];
  implementationFiles: string[];
  supportingFiles: string[];
  inScopeFiles: string[];
  outOfScopeFiles: string[];
  sensitiveOutOfScopeFiles: string[];
}

export interface ReviewSpecAudit {
  target: string;
  traceability: SpecTraceabilityReport;
  scope: ReviewScopeAudit;
  evidence: ReviewEvidenceAudit;
  htwTableDecision: string | null;
}

export async function inspectGitReviewState(
  root: string,
  includeDiff: boolean
): Promise<GitReviewState> {
  const status = await runGit(root, ["status", "--short", "--untracked-files=all"]);
  if (!status.ok) {
    return emptyGitState(status.output);
  }

  const porcelain = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const changes = porcelain.ok ? parsePorcelainZ(porcelain.output) : [];
  const diffStat = await runGit(root, ["diff", "--stat", "HEAD", "--"]);
  const combinedDiff = includeDiff
    ? await readCombinedDiff(root)
    : { output: "", warnings: [] as string[] };
  const changedFiles = uniqueSorted(changes.map((change) => change.path));

  return {
    available: true,
    status: status.output,
    diffStat: diffStat.ok ? diffStat.output : "",
    changedFiles,
    stagedFiles: uniqueSorted(changes.filter((change) => change.staged).map((change) => change.path)),
    unstagedFiles: uniqueSorted(changes.filter((change) => change.unstaged).map((change) => change.path)),
    untrackedFiles: uniqueSorted(changes.filter((change) => change.untracked).map((change) => change.path)),
    changes,
    diff: combinedDiff.output.slice(0, MAX_DIFF_CHARACTERS),
    diffTruncated: combinedDiff.output.length > MAX_DIFF_CHARACTERS,
    warnings: [
      ...(porcelain.ok ? [] : [porcelain.output]),
      ...(diffStat.ok ? [] : [diffStat.output]),
      ...combinedDiff.warnings
    ].filter((warning) => warning.trim() !== "")
  };
}

export async function inspectReviewSpec(
  root: string,
  target: string,
  git: GitReviewState,
  checks: IntegratedCheckReport
): Promise<ReviewSpecAudit> {
  const normalizedTarget = normalizeTarget(root, target);
  const specDirectory = resolveInsideRoot(root, normalizedTarget);
  const requirements = await readOptional(path.join(specDirectory, "requirements.md"));
  const tasks = await readOptional(path.join(specDirectory, "tasks.md"));
  const acceptance = await readOptional(path.join(specDirectory, "acceptance.md"));
  const design = await readOptional(path.join(specDirectory, "design.md"));
  const declarations = extractDeclaredFiles(tasks);

  return {
    target: normalizedTarget,
    traceability: analyzeSpecTraceability({
      specPath: normalizedTarget,
      requirements,
      tasks,
      acceptance
    }),
    scope: analyzeScope(
      normalizedTarget,
      git.changedFiles,
      declarations.declaredFiles,
      declarations.ambiguousDeclarations
    ),
    evidence: await analyzeEvidence(root, normalizedTarget, acceptance, checks),
    htwTableDecision: extractFieldValue(design, "HTWTable evaluation / HTWTable 评估：")
  };
}

export function createAuditFindings(input: {
  target: string | null;
  git: GitReviewState;
  spec: ReviewSpecAudit | null;
  requireEvidence: boolean;
}): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  if (input.target === null) {
    findings.push({
      severity: "warning",
      area: "scope",
      code: "review-target-missing",
      message: "未指定目标规格，无法判断代码变更是否符合功能范围。",
      intent: "每次功能交付应关联一个 `specs/<id-feature>` 目录。",
      evidence: `${input.git.changedFiles.length} 个 Git 变更文件没有规格目标。`,
      suggestion: "使用 `--target specs/<id-feature>` 重新运行 Review。"
    });
  }

  if (!input.git.available) {
    findings.push({
      severity: "warning",
      area: "git",
      code: "git-unavailable",
      message: "Git 状态不可用，无法建立实现变更证据。",
      evidence: input.git.warnings.join("; ") || "git status 执行失败。",
      suggestion: "确认目标目录是 Git 工作区，并重新运行 Review。"
    });
  } else if (input.git.status.trim() === "") {
    findings.push({
      severity: "info",
      area: "git",
      code: "git-clean",
      message: "当前工作区没有未提交变更。"
    });
  }

  if (input.git.diffTruncated) {
    findings.push({
      severity: "warning",
      area: "git",
      code: "git-diff-truncated",
      message: `Git diff 超过 ${MAX_DIFF_CHARACTERS} 字符，报告只保留前半部分。`,
      suggestion: "缩小提交范围或按功能拆分后重新审查。"
    });
  }

  if (input.spec === null) {
    return findings;
  }

  const { scope, evidence, traceability } = input.spec;
  if (!traceability.valid) {
    findings.push(...traceability.errors.map((message) => ({
      severity: "error" as const,
      area: "traceability",
      code: "spec-traceability-invalid",
      message,
      intent: "每个 TASK 和 ACC 必须关联已定义且唯一的 REQ。",
      suggestion: "先运行 `npx azi sdd status --target <spec-path>` 修复追踪关系。"
    })));
  }

  if (scope.implementationFiles.length > 0 && scope.declaredFiles.length === 0) {
    findings.push({
      severity: "warning",
      area: "scope",
      code: "scope-files-undeclared",
      message: "规格任务没有声明具体文件，无法证明实现范围符合计划。",
      intent: `${input.spec.target}/tasks.md 应在 \`Files / 文件\` 字段声明实现路径。`,
      evidence: `实际变更：${scope.implementationFiles.join(", ")}`,
      suggestion: "在 tasks.md 中补充具体文件后重新运行 Review。"
    });
  }

  if (scope.outOfScopeFiles.length > 0) {
    findings.push({
      severity: scope.sensitiveOutOfScopeFiles.length > 0 ? "error" : "warning",
      area: "scope",
      code: scope.sensitiveOutOfScopeFiles.length > 0
        ? "scope-sensitive-files-unplanned"
        : "scope-files-unplanned",
      message: "发现规格任务未声明的实现文件。",
      intent: `声明范围：${scope.declaredFiles.join(", ") || "未声明"}`,
      evidence: `超范围变更：${scope.outOfScopeFiles.join(", ")}`,
      suggestion: "确认这些变更是否必要；必要时更新 tasks.md，否则移出本次交付。"
    });
  }

  if (input.spec.htwTableDecision === null) {
    findings.push({
      severity: "warning",
      area: "components",
      code: "htwtable-decision-missing",
      message: "design.md 未记录 HTWTable 使用或例外结论。",
      intent: "普通 Vue3 后台列表应评估目标项目实际安装版本的 HTWTable。",
      suggestion: "补充 HTWTable 适配结果或明确例外原因。"
    });
  }

  findings.push(...createEvidenceFindings(input.spec, input.requireEvidence));
  return findings;
}

function createEvidenceFindings(
  spec: ReviewSpecAudit,
  requireEvidence: boolean
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const { evidence } = spec;

  if (evidence.acceptanceTotal > evidence.acceptanceChecked) {
    findings.push({
      severity: requireEvidence ? "error" : "warning",
      area: "evidence",
      code: "acceptance-incomplete",
      message: `${evidence.acceptanceTotal - evidence.acceptanceChecked} 个 ACC 验收项尚未勾选。`,
      intent: "交付前所有适用 ACC 都应有真实验收结论。",
      evidence: `${evidence.acceptanceChecked}/${evidence.acceptanceTotal} 已勾选。`,
      suggestion: "完成验收并记录证据；不适用项应写明原因。"
    });
  }

  if (requireEvidence && evidence.evidenceEntries.length === 0 && evidence.evidenceFiles.length === 0) {
    findings.push({
      severity: "error",
      area: "evidence",
      code: "acceptance-evidence-missing",
      message: "没有找到验收证据记录。",
      intent: "acceptance.md 或 evidence/ 应记录命令输出、截图、Review 报告或人工确认。",
      suggestion: "补充真实证据路径或人工确认记录，不要填写虚构结果。"
    });
  }

  if (evidence.missingEvidenceFiles.length > 0) {
    findings.push({
      severity: "error",
      area: "evidence",
      code: "acceptance-evidence-file-missing",
      message: "acceptance.md 引用了不存在的证据文件。",
      evidence: evidence.missingEvidenceFiles.join(", "),
      suggestion: "修正引用或补充对应证据文件。"
    });
  }

  for (const command of evidence.commands) {
    if (command.recordedStatus === "passed" && command.actualStatus !== "passed") {
      findings.push({
        severity: "error",
        area: "commands",
        code: "command-claim-unverified",
        message: `acceptance.md 声称 ${command.role} 已通过，但本次 Review 没有对应通过结果。`,
        intent: "未实际执行的检查不能写成已通过。",
        evidence: `记录：${command.recorded ?? "无"}；实际：${command.actualStatus}${command.actualReason === null ? "" : `（${command.actualReason}）`}`,
        suggestion: `执行 ${command.actualCommand ?? command.role}，或把 acceptance.md 改为真实状态和原因。`
      });
    } else if (command.actualStatus === "passed" && command.recordedStatus !== "passed") {
      findings.push({
        severity: "warning",
        area: "commands",
        code: "command-evidence-not-recorded",
        message: `${command.role} 已实际通过，但 acceptance.md 尚未记录该结果。`,
        evidence: command.actualCommand ?? command.role,
        suggestion: "把本次真实执行结果和时间回填到 acceptance.md。"
      });
    } else if (command.recordedStatus === "failed") {
      findings.push({
        severity: "error",
        area: "commands",
        code: "command-failure-recorded",
        message: `acceptance.md 记录 ${command.role} 检查失败。`,
        evidence: command.recorded ?? "失败",
        suggestion: "修复失败项并重新执行，不得在失败状态下交付。"
      });
    } else if (
      requireEvidence
      && (command.actualStatus === "skipped" || command.actualStatus === "not-run")
      && !(command.recordedStatus === "skipped" && command.actualReason !== null)
    ) {
      findings.push({
        severity: "warning",
        area: "commands",
        code: "command-check-skipped",
        message: `${command.role} 检查未在本次 Review 中执行。`,
        evidence: command.actualReason ?? "未记录跳过原因。",
        suggestion: "交付前执行该检查，或记录可信的跳过原因和人工验收。"
      });
    }
  }

  return findings;
}

function analyzeScope(
  target: string,
  changedFiles: string[],
  declaredFiles: string[],
  ambiguousDeclarations: string[]
): ReviewScopeAudit {
  const supportingFiles: string[] = [];
  const implementationFiles: string[] = [];
  for (const file of changedFiles) {
    if (isSupportingReviewFile(file, target)) {
      supportingFiles.push(file);
    } else {
      implementationFiles.push(file);
    }
  }
  const inScopeFiles = implementationFiles.filter((file) => declaredFiles.some((declared) => matchesDeclaration(file, declared)));
  const outOfScopeFiles = declaredFiles.length === 0
    ? []
    : implementationFiles.filter((file) => !inScopeFiles.includes(file));

  return {
    declaredFiles,
    ambiguousDeclarations,
    implementationFiles,
    supportingFiles,
    inScopeFiles,
    outOfScopeFiles,
    sensitiveOutOfScopeFiles: outOfScopeFiles.filter(isSensitiveFile)
  };
}

async function analyzeEvidence(
  root: string,
  target: string,
  acceptance: string,
  checks: IntegratedCheckReport
): Promise<ReviewEvidenceAudit> {
  const acceptanceItems = [...acceptance.matchAll(/^-\s*\[([ xX])\]\s+ACC-\d{3}\b/gmu)];
  const evidenceEntries = [...acceptance.matchAll(/^\s*-\s*Evidence \/ 证据：\s*(.+)$/gmu)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((value) => value !== "" && !isPlaceholder(value));
  const evidenceFiles = await listEvidenceFiles(root, target);
  const referencedFiles = extractEvidenceReferences(acceptance, target);
  const missingEvidenceFiles: string[] = [];
  for (const reference of referencedFiles) {
    if (!(await pathExists(resolveInsideRoot(root, reference)))) {
      missingEvidenceFiles.push(reference);
    }
  }

  return {
    acceptanceTotal: acceptanceItems.length,
    acceptanceChecked: acceptanceItems.filter((match) => match[1]?.toLowerCase() === "x").length,
    evidenceEntries,
    evidenceFiles,
    missingEvidenceFiles: uniqueSorted(missingEvidenceFiles),
    commands: COMMAND_ROLES.map((role) => createCommandEvidence(role, acceptance, checks))
  };
}

function createCommandEvidence(
  role: typeof COMMAND_ROLES[number],
  acceptance: string,
  checks: IntegratedCheckReport
): ReviewCommandEvidence {
  const recorded = extractFieldValue(acceptance, `${role}：`)
    ?? extractFieldValue(acceptance, `${role}:`);
  const actual = checks.commands.results.find((result) => result.role === role);
  return {
    role,
    recorded,
    recordedStatus: classifyRecordedStatus(recorded),
    actualStatus: actual?.status ?? "not-run",
    actualCommand: actual?.command ?? null,
    actualReason: actual?.reason ?? checks.commands.skipReason
  };
}

function classifyRecordedStatus(value: string | null): RecordedCommandStatus {
  if (value === null || value.trim() === "") {
    return "missing";
  }
  if (/待执行|未执行|pending|todo/iu.test(value)) {
    return "pending";
  }
  if (/跳过|skipped?/iu.test(value)) {
    return "skipped";
  }
  if (/失败|failed?|error/iu.test(value)) {
    return "failed";
  }
  if (/通过|passed?|success|exit\s*code\s*0/iu.test(value)) {
    return "passed";
  }
  return "unknown";
}

function extractDeclaredFiles(tasks: string): {
  declaredFiles: string[];
  ambiguousDeclarations: string[];
} {
  const values = [...tasks.matchAll(/^\s*-\s*Files \/ 文件：\s*(.+)$/gmu)]
    .flatMap((match) => (match[1] ?? "").split(/[,，]/u))
    .map(cleanPathValue)
    .filter((value) => value !== "");
  return {
    declaredFiles: uniqueSorted(values.filter(isConcreteDeclaration)),
    ambiguousDeclarations: uniqueSorted(values.filter((value) => !isConcreteDeclaration(value)))
  };
}

function cleanPathValue(value: string): string {
  return value.trim().replace(/^`|`$/g, "").replace(/^\.\//u, "").replace(/\\/g, "/").replace(/[。；;]+$/u, "");
}

function isConcreteDeclaration(value: string): boolean {
  return (value.includes("/") || /^[a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+$/u.test(value))
    && !/待|业务代码|相关文件|\.\.\.|…|unknown|tbd/iu.test(value);
}

function matchesDeclaration(file: string, declaration: string): boolean {
  const normalizedFile = file.replace(/\\/g, "/");
  const normalizedDeclaration = declaration.replace(/\\/g, "/");
  if (normalizedDeclaration.includes("*")) {
    const pattern = normalizedDeclaration
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "::DOUBLE_STAR::")
      .replace(/\*/g, "[^/]*")
      .replace(/::DOUBLE_STAR::/g, ".*");
    return new RegExp(`^${pattern}$`, "u").test(normalizedFile);
  }
  return normalizedFile === normalizedDeclaration
    || normalizedFile.startsWith(`${normalizedDeclaration.replace(/\/$/u, "")}/`);
}

function isSupportingReviewFile(file: string, target: string): boolean {
  const workflowName = path.posix.basename(target);
  return file === target
    || file.startsWith(`${target}/`)
    || file === `.harness/workflows/${workflowName}.json`
    || file.startsWith(".harness/reviews/")
    || file.startsWith(".harness/proposals/");
}

function isSensitiveFile(file: string): boolean {
  return /(^|\/)(package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|vite\.config\.|vue\.config\.|src\/(?:router|store|permission|auth|components|directive|plugins)(?:\/|\.)|src\/utils\/request\.)/iu.test(file);
}

async function listEvidenceFiles(root: string, target: string): Promise<string[]> {
  const evidenceRelative = path.posix.join(target, "evidence");
  const evidenceRoot = resolveInsideRoot(root, evidenceRelative);
  if (!(await pathExists(evidenceRoot))) {
    return [];
  }
  const results: string[] = [];
  await walkEvidence(evidenceRoot, evidenceRelative, results);
  return uniqueSorted(results.filter((file) => !file.endsWith("/.gitkeep") && file !== `${evidenceRelative}/.gitkeep`));
}

async function walkEvidence(directory: string, relativeDirectory: string, results: string[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await walkEvidence(path.join(directory, entry.name), relativePath, results);
    } else if (entry.isFile()) {
      results.push(relativePath);
    }
  }
}

function extractEvidenceReferences(acceptance: string, target: string): string[] {
  const references = [...acceptance.matchAll(/(?:specs\/[a-zA-Z0-9_./-]+\/)?evidence\/[a-zA-Z0-9_./-]+/gu)]
    .map((match) => match[0].replace(/[).,，。；;]+$/u, ""))
    .map((reference) => reference.startsWith("specs/") ? reference : path.posix.join(target, reference));
  return uniqueSorted(references);
}

function extractFieldValue(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^\\s*-\\s*${escaped}\\s*(.*)$`, "imu"));
  const value = match?.[1]?.trim();
  return value === undefined || value === "" || isPlaceholder(value) ? null : value;
}

function isPlaceholder(value: string): boolean {
  return /^(待|待补充|待确认|todo|tbd|无证据)$/iu.test(value.trim());
}

function normalizeTarget(root: string, target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//u, "").replace(/\/$/u, "");
  const absolute = resolveInsideRoot(root, normalized);
  const portable = path.relative(root, absolute).split(path.sep).join("/");
  if (!/^specs\/\d{3}-[^/]+$/u.test(portable)) {
    throw new Error("Review target must be a numbered spec directory such as `specs/001-feature`.");
  }
  return portable;
}

async function readOptional(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }
  return readFile(filePath, "utf8");
}

async function readCombinedDiff(root: string): Promise<{ output: string; warnings: string[] }> {
  const tracked = await runGit(root, ["diff", "--no-ext-diff", "--unified=1", "HEAD", "--"]);
  if (tracked.ok) {
    return { output: tracked.output, warnings: [] };
  }
  const unstaged = await runGit(root, ["diff", "--no-ext-diff", "--unified=1", "--"]);
  const staged = await runGit(root, ["diff", "--cached", "--no-ext-diff", "--unified=1", "--"]);
  return {
    output: [staged.ok ? staged.output : "", unstaged.ok ? unstaged.output : ""]
      .filter((value) => value !== "")
      .join("\n"),
    warnings: [tracked.output, ...(unstaged.ok ? [] : [unstaged.output]), ...(staged.ok ? [] : [staged.output])]
  };
}

function parsePorcelainZ(output: string): GitFileChange[] {
  const records = output.split("\0");
  const changes: GitFileChange[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length < 4) {
      continue;
    }
    const indexStatus = record[0] ?? " ";
    const worktreeStatus = record[1] ?? " ";
    const filePath = record.slice(3).replace(/\\/g, "/");
    const renamed = indexStatus === "R" || indexStatus === "C" || worktreeStatus === "R" || worktreeStatus === "C";
    if (renamed) {
      index += 1;
    }
    const untracked = indexStatus === "?" && worktreeStatus === "?";
    changes.push({
      path: filePath,
      indexStatus,
      worktreeStatus,
      staged: !untracked && indexStatus !== " " && indexStatus !== "?",
      unstaged: !untracked && worktreeStatus !== " " && worktreeStatus !== "?",
      untracked
    });
  }
  return changes;
}

function emptyGitState(warning: string): GitReviewState {
  return {
    available: false,
    status: "",
    diffStat: "",
    changedFiles: [],
    stagedFiles: [],
    unstagedFiles: [],
    untrackedFiles: [],
    changes: [],
    diff: "",
    diffTruncated: false,
    warnings: [warning]
  };
}

async function runGit(root: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn("git", args, { cwd: root, shell: false, windowsHide: true });
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        resolve({ ok: false, output: String(error) });
      }
    });
    child.on("close", (code) => {
      if (!settled) {
        settled = true;
        const preserveRawOutput = args.includes("-z") && stderr.trim() === "";
        resolve({
          ok: code === 0,
          output: preserveRawOutput
            ? stdout
            : [stdout, stderr].filter((value) => value.trim() !== "").join("\n").trim()
        });
      }
    });
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
