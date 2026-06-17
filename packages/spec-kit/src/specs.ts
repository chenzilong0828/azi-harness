import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { RuntimeFileIntent } from "@azi-harness/core";
import { pathExists, resolveInsideRoot } from "@azi-harness/core";
import { parse as parseYaml } from "yaml";

const FEATURE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCREEN_STATE_VALUES = new Set([
  "default",
  "loading",
  "empty",
  "error",
  "forbidden",
  "disabled"
]);
const SOURCE_STATUS_VALUES = new Set([
  "pending",
  "ok",
  "rate-limited",
  "fallback",
  "unavailable"
]);

const REQUIRED_SPEC_FILES = [
  "requirements.md",
  "design.md",
  "screens.yaml",
  "tasks.md",
  "acceptance.md"
] as const;

const REQUIRED_MARKDOWN_HEADINGS = {
  "requirements.md": [
    "## 背景与目标",
    "## 用户角色",
    "## 范围",
    "## 业务规则",
    "## 已确认事实",
    "## 验收条件",
    "## 未知项"
  ],
  "design.md": [
    "## 页面和模块边界",
    "## 数据与请求",
    "## 接入与复用",
    "## 状态与交互",
    "## 实现约束",
    "## 风险"
  ],
  "tasks.md": [
    "## 任务列表"
  ],
  "acceptance.md": [
    "## 功能验收",
    "## 权限验收",
    "## 字典与状态",
    "## 分页字段",
    "## 视觉对照",
    "## 检查结果",
    "## Review 记录",
    "## HTWTable 说明"
  ]
} as const;

export interface PreparedSpecCreation {
  specId: string;
  slug: string;
  directoryName: string;
  intents: RuntimeFileIntent[];
}

export interface SpecValidationReport {
  specPath: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function prepareSpecCreation(
  rootInput: string,
  requestedFeatureName: string
): Promise<PreparedSpecCreation> {
  const root = path.resolve(rootInput);
  const slug = normalizeFeatureName(requestedFeatureName);
  if (slug === null) {
    throw new Error("Feature name must use lowercase letters, numbers, and hyphens.");
  }

  const specsRoot = resolveInsideRoot(root, "specs");
  const nextId = await findNextSpecId(specsRoot);
  const directoryName = `${nextId}-${slug}`;

  return {
    specId: nextId,
    slug,
    directoryName,
    intents: createSpecIntents(directoryName, slug)
  };
}

export async function validateSpecs(
  rootInput: string,
  relativeTarget = "specs"
): Promise<SpecValidationReport[]> {
  const root = path.resolve(rootInput);
  const target = resolveInsideRoot(root, relativeTarget);
  if (!(await pathExists(target))) {
    return [{
      specPath: toPortablePath(path.relative(root, target)),
      valid: false,
      errors: [`Missing path: ${toPortablePath(path.relative(root, target))}`],
      warnings: []
    }];
  }

  const targetStat = await readDirectoryOrFileType(target);
  if (targetStat === "file") {
    return [await validateSingleSpecDirectory(path.dirname(target), root)];
  }

  const basename = path.basename(target);
  if (basename !== "specs" && /^\d{3}-/.test(basename)) {
    return [await validateSingleSpecDirectory(target, root)];
  }

  const entries = await readdir(target, { withFileTypes: true });
  const specDirectories = entries
    .filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
    .map((entry) => path.join(target, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (specDirectories.length === 0) {
    return [{
      specPath: toPortablePath(path.relative(root, target)),
      valid: false,
      errors: ["No spec directories were found."],
      warnings: []
    }];
  }

  return Promise.all(specDirectories.map((directory) => validateSingleSpecDirectory(directory, root)));
}

export function summarizeSpecValidation(reports: SpecValidationReport[]): {
  valid: boolean;
  errors: number;
  warnings: number;
} {
  const errors = reports.reduce((sum, report) => sum + report.errors.length, 0);
  const warnings = reports.reduce((sum, report) => sum + report.warnings.length, 0);
  return {
    valid: errors === 0,
    errors,
    warnings
  };
}

function createSpecIntents(directoryName: string, slug: string): RuntimeFileIntent[] {
  return [
    seeded(path.posix.join("specs", directoryName, "requirements.md"), createRequirementsTemplate(directoryName)),
    seeded(path.posix.join("specs", directoryName, "design.md"), createDesignTemplate(directoryName)),
    seeded(path.posix.join("specs", directoryName, "screens.yaml"), createScreensTemplate(slug)),
    seeded(path.posix.join("specs", directoryName, "tasks.md"), createTasksTemplate(directoryName)),
    seeded(path.posix.join("specs", directoryName, "acceptance.md"), createAcceptanceTemplate(directoryName))
  ];
}

async function findNextSpecId(specsRoot: string): Promise<string> {
  let max = 0;
  if (await pathExists(specsRoot)) {
    const entries = await readdir(specsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const match = entry.name.match(/^(\d{3})-/);
      if (match?.[1] !== undefined) {
        max = Math.max(max, Number.parseInt(match[1], 10));
      }
    }
  }
  return String(max + 1).padStart(3, "0");
}

async function validateSingleSpecDirectory(
  specDirectory: string,
  root: string
): Promise<SpecValidationReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const relativeSpecPath = toPortablePath(path.relative(root, specDirectory));
  const directoryName = path.basename(specDirectory);
  const slug = directoryName.replace(/^\d{3}-/, "");

  for (const fileName of REQUIRED_SPEC_FILES) {
    const absolutePath = path.join(specDirectory, fileName);
    if (!(await pathExists(absolutePath))) {
      errors.push(`Missing file: ${relativeSpecPath}/${fileName}`);
    }
  }

  const markdownFiles = ["requirements.md", "design.md", "tasks.md", "acceptance.md"] as const;
  for (const fileName of markdownFiles) {
    const absolutePath = path.join(specDirectory, fileName);
    if (!(await pathExists(absolutePath))) {
      continue;
    }
    const content = await readFile(absolutePath, "utf8");
    if (content.trim() === "") {
      errors.push(`File is empty: ${relativeSpecPath}/${fileName}`);
      continue;
    }

    validateMarkdownStructure(content, relativeSpecPath, fileName, warnings);
  }

  const screensPath = path.join(specDirectory, "screens.yaml");
  if (await pathExists(screensPath)) {
    const raw = await readFile(screensPath, "utf8");
    try {
      const parsed: unknown = parseYaml(raw);
      validateScreensDocument(parsed, slug, relativeSpecPath, errors, warnings);
    } catch (error) {
      errors.push(`Invalid YAML in ${relativeSpecPath}/screens.yaml: ${messageOf(error)}`);
    }
  }

  const tasksPath = path.join(specDirectory, "tasks.md");
  if (await pathExists(tasksPath)) {
    const tasks = await readFile(tasksPath, "utf8");
    if (!/- \[( |x)\]/i.test(tasks)) {
      warnings.push(`No checklist items were found in ${relativeSpecPath}/tasks.md.`);
    }
  }

  const acceptancePath = path.join(specDirectory, "acceptance.md");
  if (await pathExists(acceptancePath)) {
    const acceptance = await readFile(acceptancePath, "utf8");
    const acceptanceLower = acceptance.toLowerCase();
    for (const requiredPhrase of ["permission", "pageNum", "pageSize", "rows", "total"]) {
      if (!acceptanceLower.includes(requiredPhrase.toLowerCase())) {
        warnings.push(`Expected acceptance coverage for \`${requiredPhrase}\` in ${relativeSpecPath}/acceptance.md.`);
      }
    }
  }

  return {
    specPath: relativeSpecPath,
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateScreensDocument(
  value: unknown,
  expectedSlug: string,
  relativeSpecPath: string,
  errors: string[],
  warnings: string[]
): void {
  if (!isRecord(value)) {
    errors.push(`${relativeSpecPath}/screens.yaml must be an object.`);
    return;
  }

  if (value.version !== 1) {
    errors.push(`${relativeSpecPath}/screens.yaml must set version: 1.`);
  }

  if (typeof value.feature !== "string" || !FEATURE_NAME_PATTERN.test(value.feature)) {
    errors.push(`${relativeSpecPath}/screens.yaml has an invalid feature slug.`);
  } else if (value.feature !== expectedSlug) {
    warnings.push(`${relativeSpecPath}/screens.yaml feature \`${value.feature}\` does not match directory slug \`${expectedSlug}\`.`);
  }

  if (!isRecord(value.source)) {
    errors.push(`${relativeSpecPath}/screens.yaml source must be an object.`);
  } else {
    validateSource(value.source, relativeSpecPath, errors, warnings);
  }

  if (!Array.isArray(value.screens) || value.screens.length === 0) {
    errors.push(`${relativeSpecPath}/screens.yaml must contain at least one screen.`);
  } else {
    for (const [index, screen] of value.screens.entries()) {
      validateScreen(screen, `${relativeSpecPath}/screens.yaml screens[${index}]`, errors);
    }
  }

  if (!Array.isArray(value.unknowns)) {
    errors.push(`${relativeSpecPath}/screens.yaml unknowns must be an array.`);
  } else {
    for (const [index, unknownItem] of value.unknowns.entries()) {
      validateUnknown(unknownItem, `${relativeSpecPath}/screens.yaml unknowns[${index}]`, errors);
    }
  }
}

function validateSource(
  source: Record<string, unknown>,
  relativeSpecPath: string,
  errors: string[],
  warnings: string[]
): void {
  const allowedTypes = new Set([
    "figma-mcp",
    "figma-export",
    "screenshot",
    "legacy-page",
    "none"
  ]);
  if (typeof source.type !== "string" || !allowedTypes.has(source.type)) {
    errors.push(`${relativeSpecPath}/screens.yaml source.type is invalid.`);
  }
  if (typeof source.status !== "string" || !SOURCE_STATUS_VALUES.has(source.status)) {
    errors.push(`${relativeSpecPath}/screens.yaml source.status is invalid.`);
  }
  for (const key of ["url", "nodeId", "reference", "retriedAt", "fallback", "notes"] as const) {
    if (typeof source[key] !== "string") {
      errors.push(`${relativeSpecPath}/screens.yaml source.${key} must be a string.`);
    }
  }

  if (source.type === "figma-mcp") {
    if (source.url === "") {
      warnings.push(`${relativeSpecPath}/screens.yaml source.url should contain the node-specific Figma URL.`);
    }
    if (source.nodeId === "") {
      warnings.push(`${relativeSpecPath}/screens.yaml source.nodeId should contain the Figma node id.`);
    }
  }

  if (source.status === "rate-limited") {
    if (source.retriedAt === "") {
      warnings.push(`${relativeSpecPath}/screens.yaml source.retriedAt should record when Figma MCP can be retried.`);
    }
    if (source.fallback === "") {
      warnings.push(`${relativeSpecPath}/screens.yaml source.fallback should record the approved fallback after Figma 429.`);
    }
  }

  if (source.status === "fallback" && source.fallback === "") {
    warnings.push(`${relativeSpecPath}/screens.yaml source.fallback should describe the active fallback source.`);
  }

  if (source.type === "legacy-page" && source.reference === "") {
    warnings.push(`${relativeSpecPath}/screens.yaml source.reference should record the in-project reference page path.`);
  }

  if ((source.type === "figma-export" || source.type === "screenshot") && source.reference === "") {
    warnings.push(`${relativeSpecPath}/screens.yaml source.reference should record the exported frame or screenshot path.`);
  }

  if (source.type === "none" && source.status !== "pending") {
    warnings.push(`${relativeSpecPath}/screens.yaml source.type \`none\` should normally keep status \`pending\`.`);
  }
}

function validateScreen(
  screen: unknown,
  label: string,
  errors: string[]
): void {
  if (!isRecord(screen)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (typeof screen.id !== "string" || !FEATURE_NAME_PATTERN.test(screen.id)) {
    errors.push(`${label}.id is invalid.`);
  }
  if (typeof screen.route !== "string") {
    errors.push(`${label}.route must be a string.`);
  }
  if (typeof screen.title !== "string") {
    errors.push(`${label}.title must be a string.`);
  }
  if (!Array.isArray(screen.states) || screen.states.length === 0) {
    errors.push(`${label}.states must be a non-empty array.`);
  } else {
    for (const state of screen.states) {
      if (typeof state !== "string" || !SCREEN_STATE_VALUES.has(state)) {
        errors.push(`${label}.states contains an invalid value: ${String(state)}`);
      }
    }
  }
  for (const key of ["regions", "interactions", "assets"] as const) {
    if (!Array.isArray(screen[key])) {
      errors.push(`${label}.${key} must be an array.`);
    }
  }
}

function validateUnknown(
  unknownItem: unknown,
  label: string,
  errors: string[]
): void {
  if (!isRecord(unknownItem)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof unknownItem.id !== "string" || unknownItem.id.length === 0) {
    errors.push(`${label}.id must be a non-empty string.`);
  }
  if (typeof unknownItem.question !== "string" || unknownItem.question.length === 0) {
    errors.push(`${label}.question must be a non-empty string.`);
  }
  if (typeof unknownItem.blocking !== "boolean") {
    errors.push(`${label}.blocking must be a boolean.`);
  }
}

function normalizeFeatureName(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return FEATURE_NAME_PATTERN.test(normalized) ? normalized : null;
}

function createRequirementsTemplate(directoryName: string): string {
  return [
    `# 需求：${directoryName}`,
    "",
    "## 背景与目标",
    "",
    "- Background / 背景：",
    "- User goal / 用户目标：",
    "- Business goal / 业务目标：",
    "",
    "## 用户角色",
    "",
    "- Roles / 角色：",
    "",
    "## 范围",
    "",
    "- In scope / 本次包含：",
    "- Out of scope / 本次不包含：",
    "",
    "## 业务规则",
    "",
    "- Rules / 规则：",
    "",
    "## 已确认事实",
    "",
    "- APIs：",
    "- Permissions / 权限：",
    "- Dictionaries / 字典：",
    "",
    "## 验收条件",
    "",
    "- [ ] 描述业务验收条件。",
    "",
    "## 未知项",
    "",
    "- [ ] 明确记录阻塞问题。"
  ].join("\n");
}

function createDesignTemplate(directoryName: string): string {
  return [
    `# 设计：${directoryName}`,
    "",
    "## 页面和模块边界",
    "",
    "- Route / 路由：",
    "- Entry points / 入口：",
    "- Modules / 模块：",
    "",
    "## 数据与请求",
    "",
    "- Data flow / 数据流：",
    "- Request mapping / 请求映射：",
    "",
    "## 接入与复用",
    "",
    "- Permission integration / 权限接入：",
    "- Dictionary integration / 字典接入：",
    "- Feedback / Message / Download 复用：",
    "- Component choice / 组件选择：",
    "- HTWTable evaluation / HTWTable 评估：",
    "",
    "## 状态与交互",
    "",
    "- States / 状态：",
    "- Interactions / 交互：",
    "",
    "## 实现约束",
    "",
    "- Vue constraints / Vue 约束：",
    "- Rollback / 回退方案：",
    "",
    "## 风险",
    "",
    "- [ ] 记录降级方案和技术风险。"
  ].join("\n");
}

function createScreensTemplate(slug: string): string {
  return [
    "version: 1",
    `feature: ${slug}`,
    "source:",
    "  type: none",
    "  url: \"\"",
    "  nodeId: \"\"",
    "  reference: \"\"",
    "  status: pending",
    "  retriedAt: \"\"",
    "  fallback: \"\"",
    "  notes: \"\"",
    "screens:",
    "  - id: list",
    "    route: \"\"",
    "    title: \"\"",
    "    states:",
    "      - default",
    "    regions: []",
    "    interactions: []",
    "    assets: []",
    "unknowns: []",
    ""
  ].join("\n");
}

function createTasksTemplate(directoryName: string): string {
  return [
    `# 任务：${directoryName}`,
    "",
    "## 任务列表",
    "",
    "- [ ] T1 确认需求与页面来源",
    "  - Requirement / 需求：requirements.md",
    "  - Files / 文件：requirements.md, screens.yaml",
    "  - Depends on / 前置：接口、权限、字典事实已确认或已记录未知项",
    "  - Verify / 验证：azi spec validate",
    "- [ ] T2 完成设计决策",
    "  - Requirement / 需求：design.md",
    "  - Files / 文件：design.md",
    "  - Depends on / 前置：T1",
    "  - Verify / 验证：人工复核 HTWTable / 若依接入方案",
    "- [ ] T3 实现与自检",
    "  - Requirement / 需求：tasks.md / acceptance.md",
    "  - Files / 文件：业务代码、acceptance.md",
    "  - Depends on / 前置：T2",
    "  - Verify / 验证：azi check"
  ].join("\n");
}

function createAcceptanceTemplate(directoryName: string): string {
  return [
    `# 验收：${directoryName}`,
    "",
    "## 功能验收",
    "",
    "- [ ] 功能路径和核心操作已验证。",
    "",
    "## 权限验收",
    "",
    "- [ ] permission 行为已验证。",
    "",
    "## 字典与状态",
    "",
    "- [ ] 字典展示、loading、empty、error、normal 状态已验证。",
    "",
    "## 分页字段",
    "",
    "- [ ] pageNum/pageSize/rows/total 行为已验证。",
    "",
    "## 视觉对照",
    "",
    "- [ ] 已对照 Figma、截图或同类页面。",
    "",
    "## 检查结果",
    "",
    "- lint：",
    "- test：",
    "- build：",
    "",
    "## Review 记录",
    "",
    "- Reviewer：",
    "- Notes：",
    "",
    "## HTWTable 说明",
    "",
    "- Used / Exception："
  ].join("\n");
}

function validateMarkdownStructure(
  content: string,
  relativeSpecPath: string,
  fileName: keyof typeof REQUIRED_MARKDOWN_HEADINGS,
  warnings: string[]
): void {
  for (const heading of REQUIRED_MARKDOWN_HEADINGS[fileName]) {
    if (!content.includes(heading)) {
      warnings.push(`Expected heading \`${heading}\` in ${relativeSpecPath}/${fileName}.`);
    }
  }

  if (fileName === "tasks.md") {
    for (const label of ["Requirement / 需求：", "Files / 文件：", "Depends on / 前置：", "Verify / 验证："]) {
      if (!content.includes(label)) {
        warnings.push(`Expected task field \`${label}\` in ${relativeSpecPath}/tasks.md.`);
      }
    }
  }
}

function seeded(pathname: string, content: string): RuntimeFileIntent {
  return {
    path: pathname,
    content,
    ownership: "seeded",
    templateVersion: "1"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readDirectoryOrFileType(target: string): Promise<"directory" | "file"> {
  const entries = await readdir(target).catch(() => null);
  return entries === null ? "file" : "directory";
}
