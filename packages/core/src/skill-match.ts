export interface SkillMap {
  schemaVersion: string;
  projectType: string | null;
  defaults: Record<string, unknown>;
  sources: SkillMapSource[];
  projectSpecific: Record<string, unknown>;
}

export interface SkillMapSource {
  id: string;
  category: string | null;
  enabled: boolean;
  disabledReason: string | null;
  preferredSkills: string[];
  matchWhenAny: string[];
  avoidWhenAny: string[];
  constraints: string[];
  install: Record<string, string> | null;
}

export interface SkillMatchOptions {
  limit?: number;
  includeAvoided?: boolean;
}

export type SkillMatchConfidence = "high" | "medium" | "low";

export interface SkillConditionMatch {
  phrase: string;
  score: number;
}

export interface SkillRecommendation {
  sourceId: string;
  category: string | null;
  score: number;
  confidence: SkillMatchConfidence;
  recommendedSkills: string[];
  matchedWhenAny: SkillConditionMatch[];
  matchedPreferredSkills: SkillConditionMatch[];
  avoidedWhenAny: SkillConditionMatch[];
  reasons: string[];
  constraints: string[];
  install: Record<string, string> | null;
}

export interface SkillMatchResult {
  task: string;
  matches: SkillRecommendation[];
  avoided: SkillRecommendation[];
  fallback: {
    useProjectRules: boolean;
    message: string;
  };
  warnings: string[];
}

export interface SkillMapValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface PreparedText {
  compact: string;
  terms: Set<string>;
}

const CJK_RANGE = "\u3400-\u9fff";
const CJK_TOKEN_PATTERN = new RegExp(`[${CJK_RANGE}]+`, "gu");
const ASCII_TOKEN_PATTERN = /[a-z0-9][a-z0-9+#.]*/gu;
const SEPARATOR_PATTERN = /[^\p{L}\p{N}+#.]+/gu;
const CJK_STOP_TERMS = new Set([
  "一个",
  "这个",
  "那个",
  "当前",
  "项目",
  "任务",
  "需要",
  "使用",
  "进行",
  "相关"
]);

const SYNONYM_GROUPS: string[][] = [
  ["动效", "动画", "motion"],
  ["视觉", "截图", "screenshot"],
  ["验收", "走查", "review"],
  ["需求文档", "产品需求", "prd"],
  ["路线图", "roadmap"],
  ["表格", "列表", "table"],
  ["仓库", "repo", "repository"],
  ["缺陷", "修复", "bug"]
];

export function parseSkillMap(value: unknown): SkillMap {
  if (!isRecord(value)) {
    throw new Error("skill-map must be a JSON object");
  }

  const sourcesValue = value.sources;
  if (!Array.isArray(sourcesValue)) {
    throw new Error("skill-map.sources must be an array");
  }

  return {
    schemaVersion: readOptionalString(value, "schemaVersion") ?? "unknown",
    projectType: readOptionalString(value, "projectType"),
    defaults: readOptionalRecord(value, "defaults") ?? {},
    sources: sourcesValue.map((source, index) => parseSkillMapSource(source, index)),
    projectSpecific: readOptionalRecord(value, "projectSpecific") ?? {}
  };
}

export function validateSkillMap(rawValue: unknown): SkillMapValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(rawValue)) {
    return {
      valid: false,
      errors: ["`.harness/skill-map.json` must be a JSON object."],
      warnings
    };
  }

  const schemaVersion = rawValue.schemaVersion;
  if (schemaVersion !== "1") {
    errors.push("`.harness/skill-map.json` must declare `schemaVersion: \"1\"`.");
  }

  const sources = rawValue.sources;
  if (!Array.isArray(sources)) {
    errors.push("`.harness/skill-map.json.sources` must be an array.");
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  const seenIds = new Set<string>();
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const location = `sources[${index}]`;

    if (!isRecord(source)) {
      errors.push(`\`.harness/skill-map.json.${location}\` must be an object.`);
      continue;
    }

    const id = source.id;
    if (typeof id !== "string" || id.trim() === "") {
      errors.push(`\`.harness/skill-map.json.${location}.id\` must be a non-empty string.`);
    } else if (seenIds.has(id)) {
      errors.push(`Duplicate skill source id: ${id}`);
    } else {
      seenIds.add(id);
    }

    if ("enabled" in source && typeof source.enabled !== "boolean") {
      errors.push(`\`.harness/skill-map.json.${location}.enabled\` must be a boolean when present.`);
    }

    if ("preferredSkills" in source) {
      const preferredSkills = source.preferredSkills;
      if (!Array.isArray(preferredSkills) || preferredSkills.some((item) => typeof item !== "string")) {
        errors.push(`\`.harness/skill-map.json.${location}.preferredSkills\` must be an array of strings.`);
      } else if (preferredSkills.length === 0) {
        warnings.push(`Skill source ${id ?? location} has an empty preferredSkills list.`);
      } else if (preferredSkills.some((item) => item.trim() === "")) {
        errors.push(`\`.harness/skill-map.json.${location}.preferredSkills\` must not contain empty strings.`);
      }
    }

    if ("matchWhenAny" in source) {
      const matchWhenAny = source.matchWhenAny;
      if (!Array.isArray(matchWhenAny) || matchWhenAny.some((item) => typeof item !== "string")) {
        errors.push(`\`.harness/skill-map.json.${location}.matchWhenAny\` must be an array of strings.`);
      } else if (matchWhenAny.length === 0) {
        warnings.push(`Skill source ${id ?? location} has an empty matchWhenAny list.`);
      } else if (matchWhenAny.some((item) => item.trim() === "")) {
        errors.push(`\`.harness/skill-map.json.${location}.matchWhenAny\` must not contain empty strings.`);
      }
    }

    if ("avoidWhenAny" in source) {
      const avoidWhenAny = source.avoidWhenAny;
      if (!Array.isArray(avoidWhenAny) || avoidWhenAny.some((item) => typeof item !== "string")) {
        errors.push(`\`.harness/skill-map.json.${location}.avoidWhenAny\` must be an array of strings.`);
      } else if (avoidWhenAny.some((item) => item.trim() === "")) {
        errors.push(`\`.harness/skill-map.json.${location}.avoidWhenAny\` must not contain empty strings.`);
      }
    }

    if ("constraints" in source) {
      const constraints = source.constraints;
      if (!Array.isArray(constraints) || constraints.some((item) => typeof item !== "string")) {
        errors.push(`\`.harness/skill-map.json.${location}.constraints\` must be an array of strings.`);
      } else if (constraints.some((item) => item.trim() === "")) {
        errors.push(`\`.harness/skill-map.json.${location}.constraints\` must not contain empty strings.`);
      }
    }

    if (!("matchWhenAny" in source) && !("preferredSkills" in source)) {
      warnings.push(`Skill source ${id ?? location} has no matchWhenAny or preferredSkills entries.`);
    }

    if ("install" in source) {
      const install = source.install;
      if (!isRecord(install)) {
        errors.push(`\`.harness/skill-map.json.${location}.install\` must be an object when present.`);
      } else {
        for (const [key, entry] of Object.entries(install)) {
          if (typeof entry !== "string") {
            errors.push(`\`.harness/skill-map.json.${location}.install.${key}\` must be a string.`);
          }
        }
      }
    }

    if (source.enabled === false) {
      const reason = typeof source.disabledReason === "string"
        ? source.disabledReason.trim()
        : typeof source.reason === "string"
          ? source.reason.trim()
          : "";
      if (reason === "") {
        warnings.push(`Disabled skill source ${id ?? location} is missing a reason.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function matchSkills(
  taskDescription: string,
  rawSkillMap: unknown,
  options: SkillMatchOptions = {}
): SkillMatchResult {
  const task = taskDescription.trim();
  if (task === "") {
    throw new Error("task description is required");
  }

  const skillMap = parseSkillMap(rawSkillMap);
  const limit = normalizeLimit(options.limit);
  const taskText = prepareText(task, true);
  const warnings: string[] = [];
  const recommended: SkillRecommendation[] = [];
  const avoided: SkillRecommendation[] = [];

  for (const source of skillMap.sources) {
    const recommendation = evaluateSource(source, taskText);

    if (!source.enabled) {
      if (recommendation.score > 0 || recommendation.avoidedWhenAny.length > 0) {
        avoided.push({
          ...recommendation,
          reasons: [
            source.disabledReason ?? "source is disabled in skill-map",
            ...recommendation.reasons
          ]
        });
      }
      continue;
    }

    if (recommendation.score > 0) {
      recommended.push(recommendation);
    } else if (recommendation.avoidedWhenAny.length > 0) {
      avoided.push(recommendation);
    }
  }

  recommended.sort(compareRecommendations);
  avoided.sort(compareRecommendations);

  const matches = recommended.slice(0, limit);
  if (recommended.length > limit) {
    warnings.push(`Only the top ${limit} skill matches are returned.`);
  }

  return {
    task,
    matches,
    avoided: options.includeAvoided === true ? avoided : [],
    fallback: {
      useProjectRules: matches.length === 0,
      message: matches.length === 0
        ? "No skill source matched the task. Use .harness/rules and specs directly; do not invent a project-local Skill."
        : "Use the matched Skill source first, then keep following .harness/rules and the active spec."
    },
    warnings
  };
}

function evaluateSource(source: SkillMapSource, taskText: PreparedText): SkillRecommendation {
  const matchedWhenAny = matchConditionList(taskText, source.matchWhenAny);
  const matchedPreferredSkills = matchConditionList(taskText, source.preferredSkills);
  const avoidedWhenAny = matchConditionList(taskText, source.avoidWhenAny);
  const positiveScore = sumScores(matchedWhenAny) + Math.round(sumScores(matchedPreferredSkills) * 0.8);
  const avoidScore = sumScores(avoidedWhenAny);
  const score = Math.max(0, Math.round(positiveScore - avoidScore * 1.25));
  const reasons = createReasons(matchedWhenAny, matchedPreferredSkills, avoidedWhenAny);

  return {
    sourceId: source.id,
    category: source.category,
    score,
    confidence: confidenceForScore(score),
    recommendedSkills: source.preferredSkills.length > 0 ? source.preferredSkills : [source.id],
    matchedWhenAny,
    matchedPreferredSkills,
    avoidedWhenAny,
    reasons,
    constraints: source.constraints,
    install: source.install
  };
}

function matchConditionList(taskText: PreparedText, conditions: string[]): SkillConditionMatch[] {
  const matches: SkillConditionMatch[] = [];
  for (const condition of conditions) {
    const score = scorePhrase(taskText, condition);
    if (score > 0) {
      matches.push({ phrase: condition, score });
    }
  }
  return matches.sort((left, right) => right.score - left.score || left.phrase.localeCompare(right.phrase));
}

function scorePhrase(taskText: PreparedText, phrase: string): number {
  const phraseText = prepareText(phrase, false);
  if (phraseText.compact === "") {
    return 0;
  }

  if (taskText.compact.includes(phraseText.compact)) {
    return 18 + Math.min(8, Math.floor(phraseText.compact.length / 4));
  }

  const phraseTerms = [...phraseText.terms];
  if (phraseTerms.length === 0) {
    return 0;
  }

  const matchedTerms = phraseTerms.filter((term) => taskText.terms.has(term));
  if (matchedTerms.length === 0) {
    return 0;
  }

  const hasAsciiTerm = phraseTerms.some((term) => /[a-z0-9]/u.test(term));
  const cjkOnly = !hasAsciiTerm;
  if (cjkOnly && phraseTerms.length > 1 && matchedTerms.length < 2) {
    return 0;
  }

  const ratio = matchedTerms.length / phraseTerms.length;
  if (ratio < 0.25 && !matchedTerms.some(isDistinctiveTerm)) {
    return 0;
  }

  const singleTermBonus = phraseTerms.length === 1 ? 4 : 0;
  const asciiBonus = hasAsciiTerm ? 2 : 0;
  return Math.round(4 + ratio * 10 + Math.min(matchedTerms.length, 5) + singleTermBonus + asciiBonus);
}

function prepareText(text: string, expandSynonyms: boolean): PreparedText {
  const normalized = normalizeText(text);
  const compact = normalized.replace(/\s+/gu, "");
  const terms = extractTerms(normalized);

  if (expandSynonyms) {
    expandTermSynonyms(terms);
  }

  return { compact, terms };
}

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(SEPARATOR_PATTERN, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function extractTerms(text: string): Set<string> {
  const terms = new Set<string>();

  for (const match of text.matchAll(ASCII_TOKEN_PATTERN)) {
    const token = match[0];
    if (token.length >= 2) {
      terms.add(token);
    }
  }

  for (const match of text.matchAll(CJK_TOKEN_PATTERN)) {
    const segment = match[0];
    addCjkTerms(segment, terms);
  }

  return terms;
}

function addCjkTerms(segment: string, terms: Set<string>): void {
  if (segment.length < 2) {
    return;
  }

  if (segment.length <= 8 && !CJK_STOP_TERMS.has(segment)) {
    terms.add(segment);
  }

  const maxSize = Math.min(4, segment.length);
  for (let size = 2; size <= maxSize; size += 1) {
    for (let start = 0; start <= segment.length - size; start += 1) {
      const term = segment.slice(start, start + size);
      if (!CJK_STOP_TERMS.has(term)) {
        terms.add(term);
      }
    }
  }
}

function expandTermSynonyms(terms: Set<string>): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of SYNONYM_GROUPS) {
      if (!group.some((term) => terms.has(term))) {
        continue;
      }
      for (const term of group) {
        if (!terms.has(term)) {
          terms.add(term);
          changed = true;
        }
      }
    }
  }
}

function isDistinctiveTerm(term: string): boolean {
  return /[a-z0-9]/u.test(term) || term.length >= 3;
}

function createReasons(
  matchedWhenAny: SkillConditionMatch[],
  matchedPreferredSkills: SkillConditionMatch[],
  avoidedWhenAny: SkillConditionMatch[]
): string[] {
  const reasons: string[] = [];
  if (matchedWhenAny.length > 0) {
    reasons.push(`matched task phrases: ${matchedWhenAny.map((match) => match.phrase).join(", ")}`);
  }
  if (matchedPreferredSkills.length > 0) {
    reasons.push(`matched preferred skills: ${matchedPreferredSkills.map((match) => match.phrase).join(", ")}`);
  }
  if (avoidedWhenAny.length > 0) {
    reasons.push(`avoid phrases also matched: ${avoidedWhenAny.map((match) => match.phrase).join(", ")}`);
  }
  return reasons;
}

function confidenceForScore(score: number): SkillMatchConfidence {
  if (score >= 24) {
    return "high";
  }
  if (score >= 10) {
    return "medium";
  }
  return "low";
}

function compareRecommendations(left: SkillRecommendation, right: SkillRecommendation): number {
  return right.score - left.score || left.sourceId.localeCompare(right.sourceId);
}

function sumScores(matches: SkillConditionMatch[]): number {
  return matches.reduce((sum, match) => sum + match.score, 0);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return 5;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("match limit must be a positive integer");
  }
  return limit;
}

function parseSkillMapSource(value: unknown, index: number): SkillMapSource {
  if (!isRecord(value)) {
    throw new Error(`skill-map.sources[${index}] must be an object`);
  }

  const id = readOptionalString(value, "id");
  if (id === null) {
    throw new Error(`skill-map.sources[${index}].id must be a string`);
  }

  const enabledValue = value.enabled;
  if (enabledValue !== undefined && typeof enabledValue !== "boolean") {
    throw new Error(`skill-map.sources[${index}].enabled must be a boolean when present`);
  }

  return {
    id,
    category: readOptionalString(value, "category"),
    enabled: enabledValue ?? true,
    disabledReason: readOptionalString(value, "disabledReason") ?? readOptionalString(value, "reason"),
    preferredSkills: readOptionalStringArray(value, "preferredSkills"),
    matchWhenAny: readOptionalStringArray(value, "matchWhenAny"),
    avoidWhenAny: readOptionalStringArray(value, "avoidWhenAny"),
    constraints: readOptionalStringArray(value, "constraints"),
    install: readOptionalStringRecord(value, "install")
  };
}

function readOptionalStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`skill-map.${key} must be an array of strings when present`);
  }
  return [...value];
}

function readOptionalStringRecord(record: Record<string, unknown>, key: string): Record<string, string> | null {
  const value = record[key];
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`skill-map.${key} must be an object when present`);
  }
  const output: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      throw new Error(`skill-map.${key}.${entryKey} must be a string`);
    }
    output[entryKey] = entryValue;
  }
  return output;
}

function readOptionalRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value)) {
    throw new Error(`skill-map.${key} must be an object when present`);
  }
  return value;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`skill-map.${key} must be a string when present`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
