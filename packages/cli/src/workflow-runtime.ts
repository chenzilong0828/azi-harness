import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createRuntimeWritePlan,
  applyRuntimeWritePlan,
  pathExists,
  resolveInsideRoot,
  type RuntimeFileIntent,
  type RuntimeWritePlan
} from "@azi-harness/core";
import {
  summarizeSpecValidation,
  validateSpecs
} from "@azi-harness/spec-kit";

import {
  createContextDocument,
  type ContextDocument
} from "./context-runtime.js";
import {
  prepareFeatureSpecCreation,
  type PreparedSpecWrite
} from "./spec-runtime.js";

const FEATURE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WORKFLOW_SCHEMA_VERSION = "1";
const WORKFLOW_MARKER_START = "<!-- azi-harness:workflow:start -->";
const WORKFLOW_MARKER_END = "<!-- azi-harness:workflow:end -->";
const SPEC_READY_STAGES = new Set<WorkflowStageId>([
  "coding",
  "test",
  "quality",
  "review",
  "commit"
]);

export const WORKFLOW_STAGES = [
  "clarify",
  "plan",
  "prd",
  "issues",
  "coding",
  "test",
  "quality",
  "review",
  "commit"
] as const;

export type WorkflowStageId = typeof WORKFLOW_STAGES[number];

export interface WorkflowStageDefinition {
  id: WorkflowStageId;
  title: string;
  goal: string;
  readFirst: string[];
  recommendedSkills: string[];
  entryCriteria: string[];
  completionCriteria: string[];
  unknowns: string[];
  humanConfirmation: string[];
}

export interface WorkflowLogEntry {
  at: string;
  event: "started" | "advanced";
  from: WorkflowStageId | null;
  to: WorkflowStageId;
  actor: "azi";
  forced: boolean;
  reason: string | null;
  note: string;
}

export interface WorkflowState {
  schemaVersion: "1";
  featureName: string;
  slug: string;
  task: string;
  specPath: string;
  statePath: string;
  currentStage: WorkflowStageId;
  status: "active" | "completed";
  startedAt: string;
  updatedAt: string;
  stages: WorkflowStageDefinition[];
  logs: WorkflowLogEntry[];
  blockers: string[];
  nextStep: string;
}

export interface PrepareWorkflowStartOptions {
  root: string;
  featureName: string;
  task: string;
  slug: string | null;
  includeAvoided: boolean;
}

export interface WorkflowSpecState {
  status: "existing" | "planned";
  directoryName: string;
  relativePath: string;
  plan: RuntimeWritePlan | null;
}

export interface PreparedWorkflowStart {
  root: string;
  featureName: string;
  slug: string;
  task: string;
  spec: WorkflowSpecState;
  specCreation: PreparedSpecWrite | null;
  workflowState: WorkflowState;
  workflowPlan: RuntimeWritePlan | null;
  context: ContextDocument;
  nextSteps: string[];
  warnings: string[];
}

export interface WorkflowStatusReport {
  root: string;
  workflows: WorkflowState[];
  warnings: string[];
}

export interface WorkflowAdvanceOptions {
  root: string;
  target: string;
  to: WorkflowStageId;
  force: boolean;
  reason: string | null;
}

export interface WorkflowAdvanceResult {
  root: string;
  workflow: WorkflowState;
  changed: string[];
  warnings: string[];
}

export interface WorkflowLogReport {
  root: string;
  workflow: WorkflowState;
}

export async function prepareWorkflowStart(
  options: PrepareWorkflowStartOptions
): Promise<PreparedWorkflowStart> {
  const root = path.resolve(options.root);
  const slug = resolveFeatureSlug(options.featureName, options.slug);
  const existing = await findExistingSpecDirectory(root, slug);
  const context = await createContextDocument({
    root,
    task: options.task,
    includeAvoided: options.includeAvoided
  });

  if (existing !== null) {
    const relativePath = `specs/${existing}`;
    const existingState = await readWorkflowStateBySpecPath(root, relativePath);
    const state = existingState ?? createInitialWorkflowState({
      featureName: options.featureName,
      slug,
      task: options.task,
      specPath: relativePath,
      context,
      now: new Date().toISOString()
    });
    const workflowPlan = existingState === null
      ? await createRuntimeWritePlan(root, createWorkflowIntents(state))
      : null;
    return {
      root,
      featureName: options.featureName,
      slug,
      task: options.task,
      spec: {
        status: "existing",
        directoryName: existing,
        relativePath,
        plan: null
      },
      specCreation: null,
      workflowState: state,
      workflowPlan,
      context,
      nextSteps: createNextSteps(relativePath, context),
      warnings: existingState === null
        ? [`已存在功能规格 ${relativePath}，本次只补写工作流状态文件。`]
        : [`已存在功能规格 ${relativePath}，本次不会重复创建。`]
    };
  }

  const specCreation = await prepareFeatureSpecCreation(root, slug);
  const relativePath = `specs/${specCreation.spec.directoryName}`;
  const workflowState = createInitialWorkflowState({
    featureName: options.featureName,
    slug,
    task: options.task,
    specPath: relativePath,
    context,
    now: new Date().toISOString()
  });
  const workflowPlan = await createRuntimeWritePlan(root, [
    ...specCreation.spec.intents,
    ...createWorkflowIntents(workflowState)
  ]);
  return {
    root,
    featureName: options.featureName,
    slug,
    task: options.task,
    spec: {
      status: "planned",
      directoryName: specCreation.spec.directoryName,
      relativePath,
      plan: workflowPlan
    },
    specCreation,
    workflowState,
    workflowPlan,
    context,
    nextSteps: createNextSteps(relativePath, context),
    warnings: workflowPlan.hasConflicts
      ? ["规格创建计划存在冲突，已停止在写入前。"]
      : []
  };
}

export async function applyPreparedWorkflowStart(
  prepared: PreparedWorkflowStart
): Promise<string[]> {
  if (prepared.workflowPlan === null) {
    return [];
  }
  return applyRuntimeWritePlan(prepared.workflowPlan);
}

export async function getWorkflowStatus(rootInput: string): Promise<WorkflowStatusReport> {
  const root = path.resolve(rootInput);
  const workflows = await readAllWorkflowStates(root);
  return {
    root,
    workflows,
    warnings: workflows.length === 0
      ? ["当前项目没有 `.harness/workflows/*.json` 工作流状态文件。"]
      : []
  };
}

export async function advanceWorkflow(
  options: WorkflowAdvanceOptions
): Promise<WorkflowAdvanceResult> {
  const root = path.resolve(options.root);
  const state = await readWorkflowStateByTarget(root, options.target);
  const currentIndex = stageIndex(state.currentStage);
  const nextIndex = stageIndex(options.to);
  const warnings: string[] = [];

  if (nextIndex === currentIndex) {
    warnings.push(`工作流已经处于 ${options.to} 阶段。`);
    return { root, workflow: state, changed: [], warnings };
  }

  if (nextIndex < currentIndex && !options.force) {
    throw new Error("workflow advance cannot move backwards unless --force is used.");
  }

  if (nextIndex > currentIndex + 1 && !options.force) {
    throw new Error("workflow advance cannot skip stages unless --force is used.");
  }

  if (options.force && options.reason === null) {
    throw new Error("workflow advance --force requires --reason <text>.");
  }

  if (!options.force && SPEC_READY_STAGES.has(options.to)) {
    await assertSpecReadyForImplementation(root, state.specPath, options.to);
  }

  const now = new Date().toISOString();
  const next = {
    ...state,
    currentStage: options.to,
    status: options.to === "commit" ? "completed" as const : "active" as const,
    updatedAt: now,
    blockers: createStageDefinition(options.to).unknowns,
    nextStep: createNextStep(options.to),
    logs: [
      ...state.logs,
      {
        at: now,
        event: "advanced" as const,
        from: state.currentStage,
        to: options.to,
        actor: "azi" as const,
        forced: options.force,
        reason: options.reason,
        note: options.force
          ? `强制推进到 ${options.to}：${options.reason}`
          : `推进到 ${options.to}`
      }
    ]
  };

  const changed = await writeWorkflowArtifacts(root, next, state);
  return {
    root,
    workflow: next,
    changed,
    warnings
  };
}

export async function getWorkflowLog(
  rootInput: string,
  target: string
): Promise<WorkflowLogReport> {
  const root = path.resolve(rootInput);
  return {
    root,
    workflow: await readWorkflowStateByTarget(root, target)
  };
}

function resolveFeatureSlug(featureName: string, explicitSlug: string | null): string {
  const source = explicitSlug ?? featureName;
  const normalized = normalizeFeatureSlug(source);
  if (normalized === null) {
    throw new Error(
      "Feature slug must use lowercase letters, numbers, and hyphens. For Chinese task names, pass `--slug <feature-slug>`."
    );
  }
  return normalized;
}

function normalizeFeatureSlug(input: string): string | null {
  const direct = input.trim().toLowerCase();
  if (FEATURE_SLUG_PATTERN.test(direct)) {
    return direct;
  }

  const fallback = direct
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return FEATURE_SLUG_PATTERN.test(fallback) ? fallback : null;
}

async function findExistingSpecDirectory(root: string, slug: string): Promise<string | null> {
  const specsRoot = resolveInsideRoot(root, "specs");
  if (!(await pathExists(specsRoot))) {
    return null;
  }

  const pattern = new RegExp(`^\\d{3}-${escapeRegExp(slug)}$`);
  const entries = await readdir(specsRoot, { withFileTypes: true });
  const matched = entries
    .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return matched[0] ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createNextSteps(specPath: string, context: ContextDocument): string[] {
  const steps = [
    `查看 \`npx azi workflow status\`，确认 ${specPath} 当前阶段和阻塞项。`,
    `补齐 ${specPath}/requirements.md，先记录已确认事实和未知项。`,
    `补齐 ${specPath}/design.md，明确接口、权限、字典、组件选择和 HTWTable 评估。`,
    `完成需求澄清后运行 \`npx azi workflow advance --target ${specPath} --to plan\`。`,
    `运行 \`npx azi spec validate ${specPath}\` 校验规格结构。`,
    "按 Skill 匹配结果阅读并调用全局外部 Skill，仍以 `.harness/rules/` 和当前规格为准。",
    "实现后运行 `npx azi check`，没有执行的检查必须记录为跳过原因。",
    `交付前运行 \`npx azi review --target ${specPath} --write\` 生成审查记录。`
  ];

  if (context.commands.htwInspect !== null) {
    steps.splice(2, 0, "使用 HTWTable 前运行 `npx azi htw inspect --write-doc`。");
  }

  return steps;
}

function createInitialWorkflowState(options: {
  featureName: string;
  slug: string;
  task: string;
  specPath: string;
  context: ContextDocument;
  now: string;
}): WorkflowState {
  const currentStage = "clarify";
  return {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    featureName: options.featureName,
    slug: options.slug,
    task: options.task,
    specPath: options.specPath,
    statePath: createWorkflowStatePath(options.specPath),
    currentStage,
    status: "active",
    startedAt: options.now,
    updatedAt: options.now,
    stages: WORKFLOW_STAGES.map((stage) => createStageDefinition(stage, options.context)),
    logs: [{
      at: options.now,
      event: "started",
      from: null,
      to: currentStage,
      actor: "azi",
      forced: false,
      reason: null,
      note: "创建工作流状态，进入需求澄清阶段。"
    }],
    blockers: createStageDefinition(currentStage, options.context).unknowns,
    nextStep: createNextStep(currentStage)
  };
}

function createWorkflowIntents(state: WorkflowState): RuntimeFileIntent[] {
  return [
    seeded(state.statePath, `${JSON.stringify(state, null, 2)}\n`),
    seeded(path.posix.join(state.specPath, "workflow.md"), createWorkflowMarkdown(state)),
    seeded(path.posix.join(state.specPath, "evidence", ".gitkeep"), "")
  ];
}

async function writeWorkflowArtifacts(
  root: string,
  state: WorkflowState,
  previousState?: WorkflowState
): Promise<string[]> {
  const statePath = resolveInsideRoot(root, state.statePath);
  const workflowMarkdownPath = resolveInsideRoot(root, path.posix.join(state.specPath, "workflow.md"));
  const evidencePath = resolveInsideRoot(root, path.posix.join(state.specPath, "evidence"));

  await mkdir(path.dirname(statePath), { recursive: true });
  await mkdir(path.dirname(workflowMarkdownPath), { recursive: true });
  await mkdir(evidencePath, { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(
    workflowMarkdownPath,
    await createWorkflowMarkdownForWrite(workflowMarkdownPath, state, previousState),
    "utf8"
  );

  const gitkeepPath = path.join(evidencePath, ".gitkeep");
  if (!(await pathExists(gitkeepPath))) {
    await writeFile(gitkeepPath, "", "utf8");
  }

  return [
    state.statePath,
    path.posix.join(state.specPath, "workflow.md"),
    path.posix.join(state.specPath, "evidence/.gitkeep")
  ];
}

async function assertSpecReadyForImplementation(
  root: string,
  specPath: string,
  stage: WorkflowStageId
): Promise<void> {
  const reports = await validateSpecs(root, specPath);
  const summary = summarizeSpecValidation(reports);
  if (summary.valid) {
    return;
  }

  const messages = reports.flatMap((report) => report.errors.map((error) => `${report.specPath}: ${error}`));
  throw new Error([
    `workflow advance cannot enter ${stage}: spec is not ready.`,
    "先补齐规格，或使用 `--force --reason <text>` 记录人工确认原因。",
    ...messages.map((message) => `- ${message}`)
  ].join("\n"));
}

async function readAllWorkflowStates(root: string): Promise<WorkflowState[]> {
  const workflowsRoot = resolveInsideRoot(root, ".harness/workflows");
  if (!(await pathExists(workflowsRoot))) {
    return [];
  }

  const entries = await readdir(workflowsRoot, { withFileTypes: true });
  const states = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    states.push(await readWorkflowStateFile(path.join(workflowsRoot, entry.name), root));
  }
  return states.sort((left, right) => left.specPath.localeCompare(right.specPath));
}

async function readWorkflowStateByTarget(root: string, target: string): Promise<WorkflowState> {
  const normalizedTarget = normalizeTarget(target);
  const byStatePath = resolveInsideRoot(root, normalizedTarget);
  if (normalizedTarget.startsWith(".harness/workflows/") && await pathExists(byStatePath)) {
    return readWorkflowStateFile(byStatePath, root);
  }

  const specBaseName = path.posix.basename(normalizedTarget);
  const statePath = resolveInsideRoot(root, `.harness/workflows/${specBaseName}.json`);
  if (await pathExists(statePath)) {
    return readWorkflowStateFile(statePath, root);
  }

  const states = await readAllWorkflowStates(root);
  const matched = states.find((state) => state.specPath === normalizedTarget || state.slug === normalizedTarget);
  if (matched !== undefined) {
    return matched;
  }

  throw new Error(`Workflow state was not found for target: ${target}`);
}

async function readWorkflowStateBySpecPath(root: string, specPath: string): Promise<WorkflowState | null> {
  const statePath = resolveInsideRoot(root, createWorkflowStatePath(specPath));
  if (!(await pathExists(statePath))) {
    return null;
  }
  return readWorkflowStateFile(statePath, root);
}

async function readWorkflowStateFile(absolutePath: string, root: string): Promise<WorkflowState> {
  const raw = await readFile(absolutePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!isWorkflowState(parsed)) {
    const relative = path.relative(root, absolutePath).split(path.sep).join("/");
    throw new Error(`Invalid workflow state file: ${relative}`);
  }
  return parsed;
}

function createWorkflowStatePath(specPath: string): string {
  return `.harness/workflows/${path.posix.basename(specPath)}.json`;
}

function normalizeTarget(target: string): string {
  return target.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function stageIndex(stage: WorkflowStageId): number {
  return WORKFLOW_STAGES.indexOf(stage);
}

export function isWorkflowStageId(value: string): value is WorkflowStageId {
  return (WORKFLOW_STAGES as readonly string[]).includes(value);
}

function createStageDefinition(
  id: WorkflowStageId,
  context?: ContextDocument
): WorkflowStageDefinition {
  const skills = context?.skillMatch.matches.flatMap((match) => match.recommendedSkills) ?? [];
  const commonReadFirst = [
    "AGENTS.md",
    ".harness/project.json",
    ".harness/rules/",
    "specs/<id-feature>/"
  ];
  const stageSkills = skills.length === 0 ? ["按 .harness/rules/ 与 specs 执行"] : [...new Set(skills)];

  const definitions: Record<WorkflowStageId, Omit<WorkflowStageDefinition, "id" | "readFirst" | "recommendedSkills">> = {
    clarify: {
      title: "需求澄清",
      goal: "确认任务目标、范围、业务事实和阻塞未知项。",
      entryCriteria: ["已收到任务描述。", "已创建或定位规格目录。"],
      completionCriteria: ["requirements.md 记录已确认事实。", "阻塞未知项已列出并分配人工确认点。"],
      unknowns: ["接口、权限、字典、页面来源未确认前不能进入编码。"],
      humanConfirmation: ["确认需求范围和非目标。", "确认缺失事实的负责人。"]
    },
    plan: {
      title: "建立计划",
      goal: "把需求拆成可执行计划，明确文件范围和检查方式。",
      entryCriteria: ["需求澄清已完成或未知项已显式记录。"],
      completionCriteria: ["tasks.md 有可追踪任务。", "每个任务有前置条件和验证方式。"],
      unknowns: ["修改范围、依赖顺序或验证命令不明确。"],
      humanConfirmation: ["确认计划没有越过当前功能边界。"]
    },
    prd: {
      title: "PRD 沉淀",
      goal: "把需求、页面来源、业务规则和验收条件沉淀到规格。",
      entryCriteria: ["计划已建立。"],
      completionCriteria: ["requirements.md 和 acceptance.md 覆盖核心验收。", "screens.yaml 记录真实来源。"],
      unknowns: ["Figma、截图或同类页面来源缺失。"],
      humanConfirmation: ["确认 PRD 不包含 AI 猜测事实。"]
    },
    issues: {
      title: "Issue 切片",
      goal: "将工作拆为可独立审查的实现切片。",
      entryCriteria: ["PRD 与验收条件已沉淀。"],
      completionCriteria: ["tasks.md 能映射需求、文件范围和验收项。"],
      unknowns: ["任务切片与验收项无法对应。"],
      humanConfirmation: ["确认任务切片符合团队协作方式。"]
    },
    coding: {
      title: "编码实现",
      goal: "按规格和项目规则进行最小范围实现。",
      entryCriteria: ["需求、计划、PRD、Issue 切片已完成。"],
      completionCriteria: ["业务代码实现完成。", "未绕过若依、HTWTable、Vue 版本边界。"],
      unknowns: ["接口、权限、字典仍未知时不得编码。"],
      humanConfirmation: ["确认共享组件或基础能力改动。"]
    },
    test: {
      title: "测试回收",
      goal: "执行并记录真实检查与人工验证结果。",
      entryCriteria: ["编码实现完成。"],
      completionCriteria: ["acceptance.md 记录 lint/test/build 或跳过原因。", "关键交互已验证。"],
      unknowns: ["无法执行的命令需要写明原因。"],
      humanConfirmation: ["确认人工验收项。"]
    },
    quality: {
      title: "质量质检",
      goal: "运行 azi check 并处理规格、规则和项目命令问题。",
      entryCriteria: ["测试结果已记录。"],
      completionCriteria: ["azi check 已执行或跳过原因已记录。", "阻断问题已处理。"],
      unknowns: ["检查失败项原因未定位。"],
      humanConfirmation: ["确认剩余 warning 是否可接受。"]
    },
    review: {
      title: "Review 审查",
      goal: "生成交付前审查报告，确认风险和证据。",
      entryCriteria: ["质量质检已完成。"],
      completionCriteria: ["azi review --write 已生成报告。", "风险项已有处理结论。"],
      unknowns: ["审查报告缺少 target、diff 或验收证据。"],
      humanConfirmation: ["人工 Review 结论。"]
    },
    commit: {
      title: "Commit / MR 收尾",
      goal: "整理提交说明、MR 描述和交付证据，但不自动提交或推送。",
      entryCriteria: ["Review 审查已完成。"],
      completionCriteria: ["提交/MR 文案已准备。", "工作流完成。"],
      unknowns: ["提交范围或 MR 风险未确认。"],
      humanConfirmation: ["确认是否由人工执行 commit、push、MR。"]
    }
  };

  return {
    id,
    readFirst: commonReadFirst,
    recommendedSkills: stageSkills,
    ...definitions[id]
  };
}

function createNextStep(stage: WorkflowStageId): string {
  const next = WORKFLOW_STAGES[stageIndex(stage) + 1];
  if (next === undefined) {
    return "工作流已到达 commit 收尾阶段；准备提交说明和 MR 模板，由人工决定是否提交。";
  }
  return `完成当前阶段条件后运行 \`npx azi workflow advance --target specs/<id-feature> --to ${next}\`。`;
}

async function createWorkflowMarkdownForWrite(
  workflowMarkdownPath: string,
  state: WorkflowState,
  previousState?: WorkflowState
): Promise<string> {
  const generated = createWorkflowMarkdown(state);
  if (!(await pathExists(workflowMarkdownPath))) {
    return generated;
  }

  const existing = await readFile(workflowMarkdownPath, "utf8");
  return mergeWorkflowMarkdown(existing, generated, previousState);
}

function createWorkflowMarkdown(state: WorkflowState): string {
  return [
    WORKFLOW_MARKER_START,
    createWorkflowGeneratedMarkdown(state).trimEnd(),
    WORKFLOW_MARKER_END,
    "",
    "## 人工备注",
    "",
    "- 可在本节或标记块外记录人工补充；`azi workflow advance` 会保留这些内容。",
    ""
  ].join("\n");
}

function createWorkflowGeneratedMarkdown(state: WorkflowState): string {
  const current = state.stages.find((stage) => stage.id === state.currentStage);
  const lines = [
    `# 工作流：${path.posix.basename(state.specPath)}`,
    "",
    `- 功能：${state.featureName}`,
    `- 任务：${state.task}`,
    `- 规格目录：\`${state.specPath}\``,
    `- 状态文件：\`${state.statePath}\``,
    `- 当前阶段：\`${state.currentStage}\`${current === undefined ? "" : `（${current.title}）`}`,
    `- 工作流状态：${state.status}`,
    `- 最近更新：${state.updatedAt}`,
    "",
    "## 当前阶段",
    "",
    current === undefined ? "- 未知阶段。" : `- 阶段目标：${current.goal}`,
    "",
    "## 阶段状态机",
    "",
    WORKFLOW_STAGES.map((stage) => {
      const marker = stage === state.currentStage ? "=>" : "  ";
      const definition = state.stages.find((item) => item.id === stage);
      return `- ${marker} \`${stage}\`：${definition?.title ?? stage}`;
    }).join("\n"),
    "",
    "## 必读文件",
    "",
    ...(current?.readFirst ?? []).map((item) => `- ${item}`),
    "",
    "## 推荐 Skill",
    "",
    ...(current?.recommendedSkills ?? []).map((item) => `- ${item}`),
    "",
    "## 进入条件",
    "",
    ...(current?.entryCriteria ?? []).map((item) => `- [ ] ${item}`),
    "",
    "## 完成条件",
    "",
    ...(current?.completionCriteria ?? []).map((item) => `- [ ] ${item}`),
    "",
    "## 未知项与阻塞",
    "",
    ...state.blockers.map((item) => `- ${item}`),
    "",
    "## 人工确认点",
    "",
    ...(current?.humanConfirmation ?? []).map((item) => `- [ ] ${item}`),
    "",
    "## 下一步",
    "",
    `- ${state.nextStep}`,
    "",
    "## 日志",
    "",
    ...state.logs.map((entry) => {
      const from = entry.from === null ? "none" : entry.from;
      const force = entry.forced ? "，force" : "";
      const reason = entry.reason === null ? "" : `，原因：${entry.reason}`;
      return `- ${entry.at}: ${from} -> ${entry.to}${force}${reason}。${entry.note}`;
    }),
    ""
  ];
  return lines.join("\n");
}

function mergeWorkflowMarkdown(
  existing: string,
  generated: string,
  previousState?: WorkflowState
): string {
  const markerStart = existing.indexOf(WORKFLOW_MARKER_START);
  const markerEnd = existing.indexOf(WORKFLOW_MARKER_END);
  if (markerStart !== -1 && markerEnd > markerStart) {
    const endIndex = markerEnd + WORKFLOW_MARKER_END.length;
    return ensureFinalNewline(
      `${existing.slice(0, markerStart)}${generated.trimEnd()}\n${existing.slice(endIndex).replace(/^\r?\n/u, "")}`
    );
  }

  if (previousState !== undefined) {
    const legacyGenerated = createWorkflowGeneratedMarkdown(previousState).trimEnd();
    const normalizedExisting = normalizeMarkdown(existing).trimEnd();
    const normalizedLegacy = normalizeMarkdown(legacyGenerated).trimEnd();
    if (normalizedExisting === normalizedLegacy) {
      return generated;
    }
    if (normalizedExisting.startsWith(normalizedLegacy)) {
      const preserved = normalizedExisting.slice(normalizedLegacy.length).trim();
      return preserved === ""
        ? generated
        : appendPreservedWorkflowContent(generated, preserved);
    }
  }

  const preserved = normalizeMarkdown(existing).trim();
  return preserved === ""
    ? generated
    : appendPreservedWorkflowContent(generated, preserved);
}

function appendPreservedWorkflowContent(generated: string, preserved: string): string {
  return ensureFinalNewline([
    generated.trimEnd(),
    "",
    "## 迁移保留内容",
    "",
    preserved.trim(),
    ""
  ].join("\n"));
}

function normalizeMarkdown(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function ensureFinalNewline(content: string): string {
  return `${content.replace(/\s+$/u, "")}\n`;
}

function isWorkflowState(value: unknown): value is WorkflowState {
  if (!isRecord(value)) {
    return false;
  }
  return value.schemaVersion === WORKFLOW_SCHEMA_VERSION
    && typeof value.featureName === "string"
    && typeof value.slug === "string"
    && typeof value.task === "string"
    && typeof value.specPath === "string"
    && typeof value.statePath === "string"
    && typeof value.currentStage === "string"
    && isWorkflowStageId(value.currentStage)
    && (value.status === "active" || value.status === "completed")
    && typeof value.startedAt === "string"
    && typeof value.updatedAt === "string"
    && Array.isArray(value.stages)
    && Array.isArray(value.logs)
    && Array.isArray(value.blockers)
    && typeof value.nextStep === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function seeded(pathname: string, content: string): RuntimeFileIntent {
  return {
    path: pathname,
    content,
    ownership: "seeded",
    templateVersion: "1"
  };
}
