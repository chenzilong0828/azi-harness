import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
  applyRuntimeWritePlan,
  createRuntimeWritePlan,
  pathExists,
  resolveInsideRoot,
  type RuntimeFileIntent,
  type RuntimeWritePlan
} from "@azi-harness/core";
import {
  analyzeSpecTraceability,
  summarizeSpecValidation,
  validateSpecs,
  type SpecTraceabilityReport,
  type SpecValidationReport
} from "@azi-harness/spec-kit";

export const SDD_PHASES = [
  "clarify",
  "prd",
  "issues",
  "tasks",
  "acceptance",
  "retrospective"
] as const;

export type SddPhase = typeof SDD_PHASES[number];

export interface SddCommandOptions {
  root: string;
  target: string;
  phase: SddPhase;
}

export interface SddStatusOptions {
  root: string;
  target: string;
}

export interface SddStatusReport {
  root: string;
  target: string;
  specPath: string;
  valid: boolean;
  stage: "draft" | "ready-for-implementation";
  validation: {
    valid: boolean;
    errors: number;
    warnings: number;
    reports: SpecValidationReport[];
  };
  traceability: SpecTraceabilityReport;
  blockingIssues: string[];
  warnings: string[];
  nextActions: string[];
}

export interface SddArtifactReport {
  root: string;
  target: string;
  phase: SddPhase;
  specPath: string;
  artifactPath: string;
  content: string;
  plan: RuntimeWritePlan;
  written: string[];
  status: SddStatusReport;
}

export function isSddPhase(value: string): value is SddPhase {
  return (SDD_PHASES as readonly string[]).includes(value);
}

export async function createSddStatus(options: SddStatusOptions): Promise<SddStatusReport> {
  const root = path.resolve(options.root);
  const spec = await resolveSpecTarget(root, options.target);
  const documents = await readSpecDocuments(spec.absolutePath);
  const traceability = analyzeSpecTraceability({
    specPath: spec.specPath,
    requirements: documents.requirements,
    tasks: documents.tasks,
    acceptance: documents.acceptance
  });
  const validationReports = await validateSpecs(root, spec.specPath);
  const validationSummary = summarizeSpecValidation(validationReports);
  const blockingIssues = [
    ...validationReports.flatMap((report) => report.errors.map((error) => `${report.specPath}: ${error}`)),
    ...traceability.errors.filter((error) => !validationReports.some((report) => report.errors.includes(error)))
  ];
  const warnings = [
    ...validationReports.flatMap((report) => report.warnings.map((warning) => `${report.specPath}: ${warning}`)),
    ...traceability.warnings.filter((warning) => !validationReports.some((report) => report.warnings.includes(warning)))
  ];
  const valid = blockingIssues.length === 0;

  return {
    root,
    target: options.target,
    specPath: spec.specPath,
    valid,
    stage: valid ? "ready-for-implementation" : "draft",
    validation: {
      valid: validationSummary.valid,
      errors: validationSummary.errors,
      warnings: validationSummary.warnings,
      reports: validationReports
    },
    traceability,
    blockingIssues,
    warnings,
    nextActions: createNextActions(blockingIssues, warnings, traceability)
  };
}

export async function prepareSddArtifact(options: SddCommandOptions): Promise<SddArtifactReport> {
  const root = path.resolve(options.root);
  const spec = await resolveSpecTarget(root, options.target);
  const status = await createSddStatus({ root, target: spec.specPath });
  const artifactPath = path.posix.join(spec.specPath, "sdd", `${options.phase}.md`);
  const content = createSddArtifactContent(options.phase, status);
  const plan = await createRuntimeWritePlan(root, [seeded(artifactPath, content)]);
  return {
    root,
    target: options.target,
    phase: options.phase,
    specPath: spec.specPath,
    artifactPath,
    content,
    plan,
    written: [],
    status
  };
}

export async function writeSddArtifact(report: SddArtifactReport): Promise<SddArtifactReport> {
  const written = await applyRuntimeWritePlan(report.plan);
  return {
    ...report,
    written
  };
}

function createSddArtifactContent(phase: SddPhase, status: SddStatusReport): string {
  switch (phase) {
    case "clarify":
      return renderClarify(status);
    case "prd":
      return renderPrd(status);
    case "issues":
      return renderIssues(status);
    case "tasks":
      return renderTasks(status);
    case "acceptance":
      return renderAcceptance(status);
    case "retrospective":
      return renderRetrospective(status);
  }
}

function renderClarify(status: SddStatusReport): string {
  return [
    `# SDD 澄清：${path.posix.basename(status.specPath)}`,
    "",
    "## 使用方式",
    "",
    "- 本文件只用于澄清和记录问题，不会替代 `requirements.md`。",
    "- 不要猜接口、权限、字典、字段或后端行为；未知项必须保留为待确认。",
    "- 确认后的事实应回填到 `requirements.md`、`screens.yaml` 和 `design.md`。",
    "",
    "## 必答问题",
    "",
    "- [ ] REQ-001 的业务目标是什么？",
    "- [ ] 本次包含和不包含的范围分别是什么？",
    "- [ ] 页面来源是什么：Figma 节点、导出图、截图，还是同项目同类页面？",
    "- [ ] 接口、权限、字典是否已有确认来源？",
    "- [ ] 若为 Vue3 普通列表，HTWTable 是否适配？例外原因是什么？",
    "",
    "## 当前阻塞",
    "",
    ...formatList(status.blockingIssues, "暂无阻塞错误。"),
    "",
    "## 下一步",
    "",
    ...status.nextActions.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

function renderPrd(status: SddStatusReport): string {
  return [
    `# SDD PRD 草案：${path.posix.basename(status.specPath)}`,
    "",
    "## 原则",
    "",
    "- 本文件提供 PRD 草案结构，不凭空补业务事实。",
    "- 确认后的内容应回填到 `requirements.md`。",
    "",
    "## 需求追踪",
    "",
    ...formatIds(status.traceability.requirementIds, "REQ"),
    "",
    "## 建议补充到 requirements.md 的内容",
    "",
    "- 背景与目标：补充业务背景、用户目标、业务目标。",
    "- 用户角色：补充可操作此功能的角色。",
    "- 范围：明确 in scope / out of scope。",
    "- 业务规则：补充查询、状态、权限、数据边界。",
    "- 已确认事实：接口、权限、字典必须写明来源。",
    "- 未知项：无未知项时写 `- 无。`，不要保留模板占位。",
    "",
    "## 当前校验结果",
    "",
    ...formatStatus(status),
    ""
  ].join("\n");
}

function renderIssues(status: SddStatusReport): string {
  return [
    `# SDD Issue 切片：${path.posix.basename(status.specPath)}`,
    "",
    "## 切片原则",
    "",
    "- 每个 Issue 应能映射到至少一个 `REQ-###`。",
    "- 每个 Issue 要写清涉及文件、前置条件、验证方式。",
    "- 共享组件、请求封装、路由、权限基础能力变更必须单独列为人工确认点。",
    "",
    "## 建议 Issue",
    "",
    ...status.traceability.requirementIds.map((id, index) => [
      `- ISSUE-${String(index + 1).padStart(3, "0")}：实现 ${id}`,
      `  - Requirement / 需求：${id}`,
      `  - Tasks / 任务：${formatInlineRelation(status.traceability.requirementToTasks[id])}`,
      `  - Acceptance / 验收：${formatInlineRelation(status.traceability.requirementToAcceptance[id])}`,
      "  - Scope / 范围：待人工确认",
      "  - Files / 文件：待人工确认",
      "  - Verify / 验证：azi spec validate && azi check"
    ].join("\n")),
    ...(status.traceability.requirementIds.length === 0 ? ["- 暂无 REQ，先运行 `azi sdd clarify` 并补齐 `requirements.md`。"] : []),
    "",
    "## 当前追踪缺口",
    "",
    ...formatList(status.blockingIssues, "暂无阻塞错误。"),
    ""
  ].join("\n");
}

function renderTasks(status: SddStatusReport): string {
  return [
    `# SDD 任务拆分：${path.posix.basename(status.specPath)}`,
    "",
    "## 任务写法",
    "",
    "每个任务建议使用以下结构：",
    "",
    "```text",
    "- [ ] TASK-001 任务标题",
    "  - Requirement / 需求：REQ-001",
    "  - Files / 文件：src/...",
    "  - Depends on / 前置：...",
    "  - Verify / 验证：azi spec validate",
    "```",
    "",
    "## 当前任务",
    "",
    ...formatIds(status.traceability.taskIds, "TASK"),
    "",
    "## 需求到任务映射",
    "",
    ...formatRelation(status.traceability.requirementToTasks, "暂无需求到任务映射。"),
    ""
  ].join("\n");
}

function renderAcceptance(status: SddStatusReport): string {
  return [
    `# SDD 验收证据：${path.posix.basename(status.specPath)}`,
    "",
    "## 验收写法",
    "",
    "每个验收项建议使用以下结构：",
    "",
    "```text",
    "- [ ] ACC-001 验收项标题",
    "  - Requirement / 需求：REQ-001",
    "  - Evidence / 证据：命令输出、截图、Review 报告或人工确认记录",
    "```",
    "",
    "## 当前验收项",
    "",
    ...formatIds(status.traceability.acceptanceIds, "ACC"),
    "",
    "## 需求到验收映射",
    "",
    ...formatRelation(status.traceability.requirementToAcceptance, "暂无需求到验收映射。"),
    "",
    "## 必须覆盖",
    "",
    "- 权限：`v-hasPermi` / `hasPermi` 或项目实际能力。",
    "- 分页：`pageNum`、`pageSize`、`rows`、`total`。",
    "- 页面状态：loading、empty、error、normal。",
    "- 视觉来源：Figma、截图、导出图或同项目同类页面。",
    "- 检查结果：lint/test/build 或跳过原因。",
    ""
  ].join("\n");
}

function renderRetrospective(status: SddStatusReport): string {
  return [
    `# SDD 复盘：${path.posix.basename(status.specPath)}`,
    "",
    "## 记录原则",
    "",
    "- 只记录真实发生的结果，不把计划写成完成事实。",
    "- 检查未执行时必须写明原因，不能标记为通过。",
    "- 复盘结论应能追踪到 REQ、TASK、ACC 或 evidence 文件。",
    "",
    "## 目标达成",
    "",
    ...formatRelation(status.traceability.requirementToAcceptance, "暂无需求到验收映射。"),
    "",
    "## 做得好的地方",
    "",
    "- 待人工填写。",
    "",
    "## 偏差与问题",
    "",
    "- 计划外变更：待人工填写。",
    "- 未完成验收：待人工填写。",
    "- 技术债与风险：待人工填写。",
    "",
    "## 后续行动",
    "",
    "- [ ] ACTION-001 待人工填写负责人、截止时间和验证方式。",
    "",
    "## 证据",
    "",
    `- 规格：\`${status.specPath}\``,
    `- 工作流：\`.harness/workflows/${path.posix.basename(status.specPath)}.json\``,
    `- 验收证据：\`${status.specPath}/evidence/\``,
    ""
  ].join("\n");
}

function formatStatus(status: SddStatusReport): string[] {
  return [
    `- 状态：${status.stage}`,
    `- 规格错误：${status.validation.errors}`,
    `- 规格警告：${status.validation.warnings}`,
    `- 追踪错误：${status.traceability.errors.length}`,
    `- 追踪警告：${status.traceability.warnings.length}`
  ];
}

function formatIds(ids: string[], label: string): string[] {
  return ids.length === 0 ? [`- 暂无 ${label} 编号。`] : ids.map((id) => `- ${id}`);
}

function formatRelation(map: Record<string, string[]>, emptyMessage: string): string[] {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return [`- ${emptyMessage}`];
  }
  return entries.map(([key, values]) => `- ${key} -> ${values.length === 0 ? "未关联" : values.join(", ")}`);
}

function formatInlineRelation(values: string[] | undefined): string {
  return values === undefined || values.length === 0 ? "待补充" : values.join(", ");
}

function formatList(items: string[], emptyMessage: string): string[] {
  return items.length === 0 ? [`- ${emptyMessage}`] : items.map((item) => `- ${item}`);
}

async function resolveSpecTarget(root: string, target: string): Promise<{
  specPath: string;
  absolutePath: string;
}> {
  const normalizedTarget = target.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
  const absoluteTarget = resolveInsideRoot(root, normalizedTarget);
  if (!(await pathExists(absoluteTarget))) {
    throw new Error(`SDD target does not exist: ${target}`);
  }

  const targetStat = await stat(absoluteTarget);
  const specDirectory = targetStat.isDirectory() ? absoluteTarget : path.dirname(absoluteTarget);
  const specPath = path.relative(root, specDirectory).split(path.sep).join("/");
  if (!/^specs\/\d{3}-[^/]+$/u.test(specPath)) {
    throw new Error("SDD target must be a numbered spec directory such as `specs/001-feature`.");
  }
  return {
    specPath,
    absolutePath: specDirectory
  };
}

async function readSpecDocuments(specDirectory: string): Promise<{
  requirements: string;
  tasks: string;
  acceptance: string;
}> {
  return {
    requirements: await readOptionalText(path.join(specDirectory, "requirements.md")),
    tasks: await readOptionalText(path.join(specDirectory, "tasks.md")),
    acceptance: await readOptionalText(path.join(specDirectory, "acceptance.md"))
  };
}

async function readOptionalText(filePath: string): Promise<string> {
  if (!(await pathExists(filePath))) {
    return "";
  }
  return readFile(filePath, "utf8");
}

function createNextActions(
  blockingIssues: string[],
  warnings: string[],
  traceability: SpecTraceabilityReport
): string[] {
  const actions = [];
  if (traceability.requirementIds.length === 0) {
    actions.push("在 `requirements.md` 中补充 `REQ-001` 形式的需求编号。");
  }
  if (traceability.taskIds.length === 0) {
    actions.push("在 `tasks.md` 中补充 `TASK-001` 形式的任务编号，并关联 `REQ-001`。");
  }
  if (traceability.acceptanceIds.length === 0) {
    actions.push("在 `acceptance.md` 中补充 `ACC-001` 形式的验收编号，并关联 `REQ-001`。");
  }
  if (blockingIssues.length > 0) {
    actions.push("先处理 blocking issue，再推进到 coding 阶段。");
  }
  if (warnings.length > 0) {
    actions.push("复核 warning，确认是否影响交付或需要人工备注。");
  }
  if (actions.length === 0) {
    actions.push("规格追踪已满足 MVP 要求，可以进入实现前复核。");
  }
  return actions;
}

function seeded(pathname: string, content: string): RuntimeFileIntent {
  return {
    path: pathname,
    content,
    ownership: "seeded",
    templateVersion: "1"
  };
}
