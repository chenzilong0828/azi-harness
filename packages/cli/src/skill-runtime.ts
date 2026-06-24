import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  matchSkills,
  parseSkillCatalog,
  parseSkillMap,
  searchSkillCatalog,
  validateSkillCatalog,
  validateSkillMap,
  type SkillCatalog,
  type SkillCatalogSearchMatch,
  type SkillCatalogSource,
  type SkillMap,
  type SkillMatchResult
} from "@azi-harness/core";

export interface RunSkillMatchOptions {
  root: string;
  task: string;
  limit?: number;
  includeAvoided?: boolean;
}

export interface SkillMatchReport extends SkillMatchResult {
  root: string;
  skillMapPath: string;
  skillCatalogPath: string;
  sourceDetails: SkillCatalogSource[];
}

export interface RunSkillListOptions {
  root: string;
  category?: string;
  enabledOnly?: boolean;
}

export interface SkillListReport {
  root: string;
  skillCatalogPath: string;
  total: number;
  sources: SkillCatalogSource[];
}

export interface SkillSearchReport {
  root: string;
  skillCatalogPath: string;
  keyword: string;
  matches: SkillCatalogSearchMatch[];
}

export interface SkillDoctorReport {
  root: string;
  valid: boolean;
  skillMapPath: string;
  skillCatalogPath: string;
  errors: string[];
  warnings: string[];
  notes: string[];
}

export interface SkillSourcesReport {
  root: string;
  skillCatalogPath: string;
  installationStatusPolicy: SkillCatalog["installationStatusPolicy"];
  sources: Array<{
    id: string;
    displayName: string;
    sourceUrl: string;
    category: string;
    enabled: boolean;
    installation: SkillCatalogSource["installation"];
  }>;
}

export interface SkillInstallGuideReport {
  root: string;
  skillCatalogPath: string;
  source: SkillCatalogSource;
  installationStatusNotice: string;
}

export async function runSkillMatch(options: RunSkillMatchOptions): Promise<SkillMatchReport> {
  const root = path.resolve(options.root);
  const skillMapPath = path.join(root, ".harness", "skill-map.json");
  const skillCatalogPath = path.join(root, ".harness", "skill-catalog.json");
  const skillMap = await readJson(skillMapPath);
  const catalog = await readOptionalCatalog(skillCatalogPath);
  const matchOptions: { limit?: number; includeAvoided?: boolean } = {};
  if (options.limit !== undefined) {
    matchOptions.limit = options.limit;
  }
  if (options.includeAvoided !== undefined) {
    matchOptions.includeAvoided = options.includeAvoided;
  }

  const result = matchSkills(options.task, skillMap, matchOptions);
  const relevantIds = new Set([
    ...result.matches.map((match) => match.sourceId),
    ...result.avoided.map((match) => match.sourceId)
  ]);
  const sourceDetails = catalog === null
    ? []
    : catalog.sources.filter((source) => relevantIds.has(source.id));

  return {
    root,
    skillMapPath,
    skillCatalogPath,
    ...result,
    sourceDetails,
    warnings: catalog === null
      ? [...result.warnings, "Missing `.harness/skill-catalog.json`; run `npx azi sync . --yes` to enable Skill Hub details."]
      : result.warnings
  };
}

export async function runSkillList(options: RunSkillListOptions): Promise<SkillListReport> {
  const { root, skillCatalogPath, catalog } = await loadCatalog(options.root);
  const category = options.category?.trim().toLocaleLowerCase();
  const sources = catalog.sources.filter((source) => {
    if (options.enabledOnly === true && !source.enabled) {
      return false;
    }
    return category === undefined || source.category.toLocaleLowerCase() === category;
  });
  return { root, skillCatalogPath, total: sources.length, sources };
}

export async function runSkillSearch(rootInput: string, keyword: string): Promise<SkillSearchReport> {
  const { root, skillCatalogPath, catalog } = await loadCatalog(rootInput);
  return {
    root,
    skillCatalogPath,
    keyword,
    matches: searchSkillCatalog(catalog, keyword)
  };
}

export async function runSkillDoctor(rootInput: string): Promise<SkillDoctorReport> {
  const root = path.resolve(rootInput);
  const skillMapPath = path.join(root, ".harness", "skill-map.json");
  const skillCatalogPath = path.join(root, ".harness", "skill-catalog.json");
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes = [
    "项目运行时不会读取 AI 工具的全局安装目录；目录中的安装状态仅表示未验证。",
    "外部 Skill 正文不应复制到当前项目。"
  ];
  const [rawMap, rawCatalog] = await Promise.all([
    readJsonForDoctor(skillMapPath, errors),
    readJsonForDoctor(skillCatalogPath, errors)
  ]);

  let skillMap: SkillMap | null = null;
  let catalog: SkillCatalog | null = null;
  if (rawMap !== null) {
    const report = validateSkillMap(rawMap);
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    if (report.valid) {
      skillMap = parseSkillMap(rawMap);
    }
  }
  if (rawCatalog !== null) {
    const report = validateSkillCatalog(rawCatalog);
    errors.push(...report.errors);
    warnings.push(...report.warnings);
    if (report.valid) {
      catalog = parseSkillCatalog(rawCatalog);
    }
  }

  if (skillMap !== null && catalog !== null) {
    compareSkillFiles(skillMap, catalog, errors, warnings);
  }

  return {
    root,
    valid: errors.length === 0,
    skillMapPath,
    skillCatalogPath,
    errors: unique(errors),
    warnings: unique(warnings),
    notes
  };
}

export async function runSkillSources(rootInput: string): Promise<SkillSourcesReport> {
  const { root, skillCatalogPath, catalog } = await loadCatalog(rootInput);
  return {
    root,
    skillCatalogPath,
    installationStatusPolicy: catalog.installationStatusPolicy,
    sources: catalog.sources.map((source) => ({
      id: source.id,
      displayName: source.displayName,
      sourceUrl: source.sourceUrl,
      category: source.category,
      enabled: source.enabled,
      installation: source.installation
    }))
  };
}

export async function runSkillInstallGuide(
  rootInput: string,
  sourceId: string
): Promise<SkillInstallGuideReport> {
  const { root, skillCatalogPath, catalog } = await loadCatalog(rootInput);
  const normalizedId = sourceId.trim().toLocaleLowerCase();
  const source = catalog.sources.find((item) => item.id.toLocaleLowerCase() === normalizedId);
  if (source === undefined) {
    throw new Error(`Unknown Skill source: ${sourceId}. Run \`npx azi skill list\` to see available source ids.`);
  }
  return {
    root,
    skillCatalogPath,
    source,
    installationStatusNotice: "azi-harness 只提供安装提示，不会假定或修改各 AI 工具的全局 Skill 安装状态。"
  };
}

async function loadCatalog(rootInput: string): Promise<{
  root: string;
  skillCatalogPath: string;
  catalog: SkillCatalog;
}> {
  const root = path.resolve(rootInput);
  const skillCatalogPath = path.join(root, ".harness", "skill-catalog.json");
  const catalog = parseSkillCatalog(await readJson(skillCatalogPath));
  return { root, skillCatalogPath, catalog };
}

async function readOptionalCatalog(catalogPath: string): Promise<SkillCatalog | null> {
  try {
    return parseSkillCatalog(await readJson(catalogPath));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }
    if (error instanceof Error && error.message.startsWith("Cannot find ")) {
      return null;
    }
    throw error;
  }
}

async function readJson(filePath: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(`Cannot find ${filePath}. Run \`npx azi setup . --yes\` first.`);
    }
    throw error;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot parse ${filePath}: ${message}`);
  }
}

async function readJsonForDoctor(filePath: string, errors: string[]): Promise<unknown | null> {
  try {
    return await readJson(filePath);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return null;
  }
}

function compareSkillFiles(
  skillMap: SkillMap,
  catalog: SkillCatalog,
  errors: string[],
  warnings: string[]
): void {
  if (skillMap.projectType !== null && skillMap.projectType !== catalog.projectType) {
    errors.push("Skill map and catalog declare different project types.");
  }
  const mapById = new Map(skillMap.sources.map((source) => [source.id, source]));
  const catalogById = new Map(catalog.sources.map((source) => [source.id, source]));
  for (const source of skillMap.sources) {
    const catalogSource = catalogById.get(source.id);
    if (catalogSource === undefined) {
      errors.push(`Skill source \`${source.id}\` exists in skill-map but is missing from skill-catalog.`);
      continue;
    }
    if (source.category !== catalogSource.category) {
      warnings.push(`Skill source \`${source.id}\` has different categories in skill-map and skill-catalog.`);
    }
    if (source.enabled !== catalogSource.enabled) {
      errors.push(`Skill source \`${source.id}\` has inconsistent enabled status.`);
    }
    if (!sameStrings(source.matchWhenAny, catalogSource.recommendedScenarios)) {
      warnings.push(`Skill source \`${source.id}\` has different recommended scenarios in skill-map and skill-catalog.`);
    }
    if (!sameStrings(source.avoidWhenAny, catalogSource.avoidScenarios)) {
      warnings.push(`Skill source \`${source.id}\` has different avoid scenarios in skill-map and skill-catalog.`);
    }
  }
  for (const source of catalog.sources) {
    if (!mapById.has(source.id)) {
      warnings.push(`Skill source \`${source.id}\` is cataloged but cannot be matched by skill-map.`);
    }
  }
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
