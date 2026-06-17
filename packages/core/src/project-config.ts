import type {
  CapabilityFacts,
  DetectedValue,
  Evidence,
  PackageManager,
  ProjectFacts,
  ProjectOverride,
  ProjectProfile,
  ProjectType
} from "./types.js";

const PROJECT_TYPE_VALUES = new Set<ProjectType>([
  "ruoyi-vue2-element-ui",
  "ruoyi-vue3-element-plus",
  "vue2-element-ui",
  "vue3-element-plus",
  "uniapp",
  "unknown"
]);

const PACKAGE_MANAGER_VALUES = new Set<PackageManager>([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "unknown"
]);

const SUPPORTED_OVERRIDE_PATHS = new Set([
  "projectType.value",
  "packageManager.value",
  "ruoyi.value",
  "capabilities.permission.value",
  "capabilities.dict.value",
  "capabilities.request.value",
  "capabilities.routing.value",
  "capabilities.pagination.value",
  "capabilities.feedback.value",
  "htwTable.documentationUrl"
]);

const BLOCKED_OVERRIDE_PATHS = new Map<string, string>([
  ["framework.vue", "framework facts come from installed project dependencies and cannot be overridden."],
  ["framework.vueMajor", "framework facts come from installed project dependencies and cannot be overridden."],
  ["framework.ui", "framework facts come from installed project dependencies and cannot be overridden."],
  ["framework.uniapp", "framework facts come from installed project dependencies and cannot be overridden."],
  ["htwTable.installed", "HTWTable installation facts come from the project and cannot be overridden."],
  ["htwTable.packageName", "HTWTable package facts come from the project and cannot be overridden."],
  ["htwTable.versionSpec", "HTWTable version facts come from the project and cannot be overridden."],
  ["htwTable.source", "HTWTable source facts come from the project and cannot be overridden."],
  ["htwTable.compatibleVueMajor", "HTWTable compatibility facts come from the project and cannot be overridden."],
  ["commands", "Use `.harness/config.json -> commands` to map project commands instead of overrides."],
  ["commands.dev", "Use `.harness/config.json -> commands` to map project commands instead of overrides."],
  ["commands.lint", "Use `.harness/config.json -> commands` to map project commands instead of overrides."],
  ["commands.test", "Use `.harness/config.json -> commands` to map project commands instead of overrides."],
  ["commands.build", "Use `.harness/config.json -> commands` to map project commands instead of overrides."]
]);

export interface ProjectConfigIssue {
  severity: "warning" | "error";
  message: string;
}

export function applyProjectConfig(
  profile: ProjectProfile,
  config: Record<string, unknown> | null
): {
  profile: ProjectProfile;
  issues: ProjectConfigIssue[];
} {
  const next = cloneProfile(profile);
  next.overridesApplied = [];

  const issues: ProjectConfigIssue[] = [];
  if (config === null) {
    return { profile: next, issues };
  }

  const rawOverrides = config.overrides;
  if (rawOverrides === undefined) {
    return { profile: next, issues };
  }

  if (!Array.isArray(rawOverrides)) {
    issues.push({
      severity: "error",
      message: "`.harness/config.json` must set `overrides` as an array."
    });
    return { profile: next, issues };
  }

  for (const [index, rawOverride] of rawOverrides.entries()) {
    const label = `overrides[${index}]`;
    if (!isRecord(rawOverride)) {
      issues.push({
        severity: "error",
        message: `Invalid ${label}: each override must be an object.`
      });
      continue;
    }

    const path = typeof rawOverride.path === "string" ? rawOverride.path.trim() : "";
    const reason = typeof rawOverride.reason === "string" ? rawOverride.reason.trim() : "";
    const owner = rawOverride.owner;

    if (path === "") {
      issues.push({
        severity: "error",
        message: `Invalid ${label}: \`path\` must be a non-empty string.`
      });
      continue;
    }
    if (reason === "") {
      issues.push({
        severity: "error",
        message: `Invalid override \`${path}\`: \`reason\` must be a non-empty string.`
      });
      continue;
    }
    if (!(typeof owner === "string" || owner === null || owner === undefined)) {
      issues.push({
        severity: "error",
        message: `Invalid override \`${path}\`: \`owner\` must be a string or null.`
      });
      continue;
    }

    const normalizedPath = normalizeOverridePath(path);
    const blocked = blockedOverrideReason(normalizedPath);
    if (blocked !== null) {
      issues.push({
        severity: "error",
        message: `Override \`${path}\` is not allowed: ${blocked}`
      });
      continue;
    }
    if (!SUPPORTED_OVERRIDE_PATHS.has(normalizedPath)) {
      issues.push({
        severity: "error",
        message: `Unsupported override path \`${path}\`.`
      });
      continue;
    }

    const validationError = validateOverrideValue(normalizedPath, rawOverride.value, next.effective);
    if (validationError !== null) {
      issues.push({
        severity: "error",
        message: `Invalid override \`${path}\`: ${validationError}`
      });
      continue;
    }

    const detectedValue = readOverrideTargetValue(next.detected, normalizedPath);
    if (deepEqual(detectedValue, rawOverride.value)) {
      issues.push({
        severity: "warning",
        message: `Override \`${normalizedPath}\` matches the detected value and can be removed.`
      });
    }

    applySingleOverride(next, normalizedPath, rawOverride.value, reason);
    next.overridesApplied.push({
      path: normalizedPath,
      value: cloneJsonValue(rawOverride.value),
      reason,
      owner: typeof owner === "string" ? owner : null
    });
  }

  return { profile: next, issues };
}

function applySingleOverride(
  profile: ProjectProfile,
  path: string,
  value: unknown,
  reason: string
): void {
  switch (path) {
    case "projectType.value": {
      applyDetectedValueOverride(profile.effective.projectType, value as ProjectType, path, reason);
      if (value === "unknown") {
        return;
      }
      applyDetectedValueOverride(
        profile.effective.ruoyi,
        String(value).startsWith("ruoyi-"),
        "ruoyi.value",
        `Derived from override \`${path}\`: ${reason}`
      );
      return;
    }
    case "packageManager.value":
      applyDetectedValueOverride(profile.effective.packageManager, value as PackageManager, path, reason);
      return;
    case "ruoyi.value":
      applyDetectedValueOverride(profile.effective.ruoyi, value as boolean, path, reason);
      return;
    case "capabilities.permission.value":
      applyDetectedValueOverride(profile.effective.capabilities.permission, value as string[], path, reason);
      return;
    case "capabilities.dict.value":
      applyDetectedValueOverride(profile.effective.capabilities.dict, value as string[], path, reason);
      return;
    case "capabilities.request.value":
      applyDetectedValueOverride(profile.effective.capabilities.request, value as string[], path, reason);
      return;
    case "capabilities.routing.value":
      applyDetectedValueOverride(profile.effective.capabilities.routing, value as string[], path, reason);
      return;
    case "capabilities.pagination.value":
      applyDetectedValueOverride(profile.effective.capabilities.pagination, value as string[], path, reason);
      return;
    case "capabilities.feedback.value":
      applyDetectedValueOverride(profile.effective.capabilities.feedback, value as string[], path, reason);
      return;
    case "htwTable.documentationUrl":
      profile.effective.htwTable.documentationUrl = value as string;
      profile.effective.htwTable.evidence = [
        ...profile.effective.htwTable.evidence,
        overrideEvidence(path, reason)
      ];
      return;
    default:
      return;
  }
}

function validateOverrideValue(
  path: string,
  value: unknown,
  facts: ProjectFacts
): string | null {
  switch (path) {
    case "projectType.value":
      if (typeof value !== "string" || !PROJECT_TYPE_VALUES.has(value as ProjectType)) {
        return "projectType must be one of the supported project type identifiers.";
      }
      return validateProjectTypeCompatibility(value as ProjectType, facts);
    case "packageManager.value":
      if (typeof value !== "string" || !PACKAGE_MANAGER_VALUES.has(value as PackageManager)) {
        return "packageManager must be one of `npm`, `pnpm`, `yarn`, `bun`, or `unknown`.";
      }
      return null;
    case "ruoyi.value":
      return typeof value === "boolean" ? null : "ruoyi must be a boolean value.";
    case "capabilities.permission.value":
    case "capabilities.dict.value":
    case "capabilities.request.value":
    case "capabilities.routing.value":
    case "capabilities.pagination.value":
    case "capabilities.feedback.value":
      return isStringArray(value) ? null : "capability overrides must be arrays of strings.";
    case "htwTable.documentationUrl":
      return typeof value === "string" && value.trim() !== ""
        ? null
        : "htwTable.documentationUrl must be a non-empty string.";
    default:
      return "unsupported override path.";
  }
}

function validateProjectTypeCompatibility(
  value: ProjectType,
  facts: ProjectFacts
): string | null {
  if (value === "unknown") {
    return null;
  }
  if (value === "uniapp") {
    return facts.framework.uniapp.value
      ? null
      : "`uniapp` can only be used when the detected project already has uniapp evidence.";
  }

  const expectedVueMajor = value.includes("vue2") ? 2 : 3;
  const expectedUi = value.includes("element-ui") ? "element-ui" : "element-plus";
  if (facts.framework.vueMajor.value !== expectedVueMajor) {
    return `projectType \`${value}\` conflicts with detected Vue major \`${facts.framework.vueMajor.value ?? "unknown"}\`.`;
  }
  if (facts.framework.ui.value !== expectedUi) {
    return `projectType \`${value}\` conflicts with detected UI framework \`${facts.framework.ui.value ?? "unknown"}\`.`;
  }
  return null;
}

function readOverrideTargetValue(
  facts: ProjectFacts,
  path: string
): unknown {
  switch (path) {
    case "projectType.value":
      return facts.projectType.value;
    case "packageManager.value":
      return facts.packageManager.value;
    case "ruoyi.value":
      return facts.ruoyi.value;
    case "capabilities.permission.value":
      return facts.capabilities.permission.value;
    case "capabilities.dict.value":
      return facts.capabilities.dict.value;
    case "capabilities.request.value":
      return facts.capabilities.request.value;
    case "capabilities.routing.value":
      return facts.capabilities.routing.value;
    case "capabilities.pagination.value":
      return facts.capabilities.pagination.value;
    case "capabilities.feedback.value":
      return facts.capabilities.feedback.value;
    case "htwTable.documentationUrl":
      return facts.htwTable.documentationUrl;
    default:
      return undefined;
  }
}

function normalizeOverridePath(path: string): string {
  switch (path) {
    case "projectType":
      return "projectType.value";
    case "packageManager":
      return "packageManager.value";
    case "ruoyi":
      return "ruoyi.value";
    case "capabilities.permission":
      return "capabilities.permission.value";
    case "capabilities.dict":
      return "capabilities.dict.value";
    case "capabilities.request":
      return "capabilities.request.value";
    case "capabilities.routing":
      return "capabilities.routing.value";
    case "capabilities.pagination":
      return "capabilities.pagination.value";
    case "capabilities.feedback":
      return "capabilities.feedback.value";
    default:
      return path;
  }
}

function blockedOverrideReason(path: string): string | null {
  for (const [candidate, reason] of BLOCKED_OVERRIDE_PATHS) {
    if (path === candidate || path.startsWith(`${candidate}.`)) {
      return reason;
    }
  }
  return null;
}

function applyDetectedValueOverride<T>(
  target: DetectedValue<T>,
  value: T,
  path: string,
  reason: string
): void {
  target.value = cloneJsonValue(value) as T;
  target.evidence = [...target.evidence, overrideEvidence(path, reason)];
}

function overrideEvidence(path: string, reason: string): Evidence {
  return {
    kind: "file",
    source: ".harness/config.json",
    detail: `Manual override for ${path}: ${reason}`
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function cloneProfile(profile: ProjectProfile): ProjectProfile {
  return cloneJsonValue(profile) as ProjectProfile;
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
