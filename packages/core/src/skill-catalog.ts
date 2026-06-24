export const SKILL_TOOL_IDS = [
  "codex",
  "cursor",
  "antigravity",
  "opencode",
  "harness"
] as const;

export type SkillToolId = typeof SKILL_TOOL_IDS[number];
export type SkillInstallationMode = "manual" | "built-in-or-plugin" | "source-index";
export type SkillInstallationStatus = "not-verified";

export interface SkillCatalogTool {
  supported: boolean;
  status: SkillInstallationStatus;
  installHint: string | null;
}

export interface SkillCatalogSource {
  id: string;
  displayName: string;
  sourceUrl: string;
  category: string;
  description: string;
  enabled: boolean;
  preferredSkills: string[];
  recommendedScenarios: string[];
  avoidScenarios: string[];
  constraints: string[];
  tools: Record<SkillToolId, SkillCatalogTool>;
  installation: {
    mode: SkillInstallationMode;
    manualInstallRequired: boolean;
    globallyReusable: boolean;
    indexOnly: boolean;
    projectCopiesSkillBody: false;
  };
}

export interface SkillCatalog {
  schemaVersion: "1";
  projectType: string;
  installationStatusPolicy: "not-verified-by-project-runtime";
  tools: SkillToolId[];
  sources: SkillCatalogSource[];
}

export interface SkillCatalogValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SkillCatalogSearchMatch {
  source: SkillCatalogSource;
  score: number;
  matchedFields: string[];
}

export function parseSkillCatalog(input: unknown): SkillCatalog {
  const report = validateSkillCatalog(input);
  if (!report.valid) {
    throw new Error(report.errors.join(" "));
  }
  return input as SkillCatalog;
}

export function validateSkillCatalog(input: unknown): SkillCatalogValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ["`.harness/skill-catalog.json` must be a JSON object."],
      warnings
    };
  }

  if (input.schemaVersion !== "1") {
    errors.push("`.harness/skill-catalog.json` must declare `schemaVersion: \"1\"`.");
  }
  if (typeof input.projectType !== "string" || input.projectType.trim() === "") {
    errors.push("`.harness/skill-catalog.json.projectType` must be a non-empty string.");
  }
  if (input.installationStatusPolicy !== "not-verified-by-project-runtime") {
    errors.push("`.harness/skill-catalog.json.installationStatusPolicy` must be `not-verified-by-project-runtime`.");
  }
  if (!isStringArray(input.tools)) {
    errors.push("`.harness/skill-catalog.json.tools` must be an array of strings.");
  } else {
    for (const tool of SKILL_TOOL_IDS) {
      if (!input.tools.includes(tool)) {
        errors.push(`\`.harness/skill-catalog.json.tools\` must include \`${tool}\`.`);
      }
    }
  }

  if (!Array.isArray(input.sources)) {
    errors.push("`.harness/skill-catalog.json.sources` must be an array.");
    return { valid: false, errors, warnings };
  }

  const ids = new Set<string>();
  for (const [index, source] of input.sources.entries()) {
    const location = `.harness/skill-catalog.json.sources[${index}]`;
    if (!isRecord(source)) {
      errors.push(`\`${location}\` must be an object.`);
      continue;
    }
    validateRequiredString(source, "id", location, errors);
    validateRequiredString(source, "displayName", location, errors);
    validateRequiredString(source, "sourceUrl", location, errors);
    validateRequiredString(source, "category", location, errors);
    validateRequiredString(source, "description", location, errors);
    if (typeof source.id === "string" && source.id.trim() !== "") {
      if (ids.has(source.id)) {
        errors.push(`\`${location}.id\` duplicates source id \`${source.id}\`.`);
      }
      ids.add(source.id);
    }
    if (typeof source.enabled !== "boolean") {
      errors.push(`\`${location}.enabled\` must be a boolean.`);
    }
    for (const key of [
      "preferredSkills",
      "recommendedScenarios",
      "avoidScenarios",
      "constraints"
    ] as const) {
      if (!isStringArray(source[key])) {
        errors.push(`\`${location}.${key}\` must be an array of strings.`);
      }
    }
    validateTools(source.tools, location, errors);
    validateInstallation(source.installation, location, errors);
  }

  if (input.sources.length === 0) {
    warnings.push("`.harness/skill-catalog.json.sources` is empty.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function searchSkillCatalog(
  catalog: SkillCatalog,
  keyword: string
): SkillCatalogSearchMatch[] {
  const query = normalize(keyword);
  if (query === "") {
    return [];
  }
  const queryParts = tokenize(query);

  return catalog.sources
    .map((source) => scoreSource(source, query, queryParts))
    .filter((match): match is SkillCatalogSearchMatch => match !== null)
    .sort((left, right) => right.score - left.score || left.source.id.localeCompare(right.source.id));
}

function scoreSource(
  source: SkillCatalogSource,
  query: string,
  queryParts: string[]
): SkillCatalogSearchMatch | null {
  const fields: Array<[string, string, number]> = [
    ["id", source.id, 8],
    ["名称", source.displayName, 8],
    ["分类", source.category, 5],
    ["说明", source.description, 4],
    ["推荐 Skill", source.preferredSkills.join(" "), 5],
    ["推荐场景", source.recommendedScenarios.join(" "), 4],
    ["适配工具", Object.entries(source.tools)
      .filter(([, value]) => value.supported)
      .map(([tool]) => tool)
      .join(" "), 3]
  ];
  let score = 0;
  const matchedFields: string[] = [];

  for (const [label, value, weight] of fields) {
    const normalizedValue = normalize(value);
    const exact = normalizedValue.includes(query);
    const partMatches = queryParts.filter((part) => normalizedValue.includes(part)).length;
    if (exact || partMatches > 0) {
      score += exact ? weight * 2 : weight * partMatches;
      matchedFields.push(label);
    }
  }

  return score === 0 ? null : { source, score, matchedFields };
}

function validateTools(value: unknown, location: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`\`${location}.tools\` must be an object.`);
    return;
  }
  for (const tool of SKILL_TOOL_IDS) {
    const entry = value[tool];
    if (!isRecord(entry)) {
      errors.push(`\`${location}.tools.${tool}\` must be an object.`);
      continue;
    }
    if (typeof entry.supported !== "boolean") {
      errors.push(`\`${location}.tools.${tool}.supported\` must be a boolean.`);
    }
    if (entry.status !== "not-verified") {
      errors.push(`\`${location}.tools.${tool}.status\` must be \`not-verified\`.`);
    }
    if (entry.installHint !== null && typeof entry.installHint !== "string") {
      errors.push(`\`${location}.tools.${tool}.installHint\` must be a string or null.`);
    }
  }
}

function validateInstallation(value: unknown, location: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`\`${location}.installation\` must be an object.`);
    return;
  }
  if (!["manual", "built-in-or-plugin", "source-index"].includes(String(value.mode))) {
    errors.push(`\`${location}.installation.mode\` is invalid.`);
  }
  for (const key of ["manualInstallRequired", "globallyReusable", "indexOnly"] as const) {
    if (typeof value[key] !== "boolean") {
      errors.push(`\`${location}.installation.${key}\` must be a boolean.`);
    }
  }
  if (value.projectCopiesSkillBody !== false) {
    errors.push(`\`${location}.installation.projectCopiesSkillBody\` must be false.`);
  }
}

function validateRequiredString(
  record: Record<string, unknown>,
  key: string,
  location: string,
  errors: string[]
): void {
  if (typeof record[key] !== "string" || record[key].trim() === "") {
    errors.push(`\`${location}.${key}\` must be a non-empty string.`);
  }
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function tokenize(value: string): string[] {
  return [...new Set(value.split(/[\s,，。/、:_-]+/u).filter((part) => part.length >= 2))];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
