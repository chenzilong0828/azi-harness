export type Confidence = "high" | "medium" | "low";

export type ProjectType =
  | "ruoyi-vue2-element-ui"
  | "ruoyi-vue3-element-plus"
  | "vue2-element-ui"
  | "vue3-element-plus"
  | "uniapp"
  | "unknown";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "unknown";

export type EvidenceKind =
  | "dependency"
  | "file"
  | "content"
  | "lockfile"
  | "script"
  | "absence";

export interface Evidence {
  kind: EvidenceKind;
  source: string;
  detail: string;
}

export interface DetectedValue<T> {
  value: T;
  confidence: Confidence;
  evidence: Evidence[];
  conflicts: string[];
}

export interface FrameworkFacts {
  vue: DetectedValue<string | null>;
  vueMajor: DetectedValue<2 | 3 | null>;
  ui: DetectedValue<"element-ui" | "element-plus" | null>;
  uniapp: DetectedValue<boolean>;
}

export interface CapabilityFacts {
  permission: DetectedValue<string[]>;
  dict: DetectedValue<string[]>;
  request: DetectedValue<string[]>;
  routing: DetectedValue<string[]>;
  pagination: DetectedValue<string[]>;
  feedback: DetectedValue<string[]>;
}

export interface HtwTableFacts {
  installed: boolean;
  packageName: string | null;
  versionSpec: string | null;
  source: "registry" | "git" | "file" | "workspace" | "project" | "unknown";
  compatibleVueMajor: 3 | null;
  documentationUrl: string;
  evidence: Evidence[];
  conflicts: string[];
}

export interface CommandFacts {
  dev: string[];
  build: string[];
  test: string[];
  lint: string[];
  other: Record<string, string>;
}

export interface ProjectFacts {
  projectType: DetectedValue<ProjectType>;
  packageManager: DetectedValue<PackageManager>;
  framework: FrameworkFacts;
  ruoyi: DetectedValue<boolean>;
  capabilities: CapabilityFacts;
  htwTable: HtwTableFacts;
  commands: CommandFacts;
  warnings: string[];
}

export interface ProjectOverride {
  path: string;
  value: unknown;
  reason: string;
  owner: string | null;
}

export interface ProjectProfile {
  schemaVersion: "1";
  generatedAt: string;
  root: ".";
  detected: ProjectFacts;
  effective: ProjectFacts;
  overridesApplied: ProjectOverride[];
}

export type RuntimeFileOwnership = "managed" | "seeded" | "user";

export interface RuntimeManifestFile {
  path: string;
  ownership: RuntimeFileOwnership;
  templateVersion: string | null;
  sha256: string;
}

export interface RuntimeManifest {
  schemaVersion: "1";
  runtimeVersion: string;
  generatedAt: string;
  files: RuntimeManifestFile[];
  detectionDigest: string;
}

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  size: number;
}

export interface ScanResult {
  files: ScannedFile[];
  warnings: string[];
}

export interface RuntimeFileIntent {
  path: string;
  content: string;
  ownership: RuntimeFileOwnership;
  templateVersion: string | null;
}

export type FilePlanAction = "create" | "update" | "delete" | "skip" | "conflict";

export interface FilePlanEntry {
  intent: RuntimeFileIntent;
  action: FilePlanAction;
  reason: string;
}

export interface RuntimeWritePlan {
  root: string;
  entries: FilePlanEntry[];
  hasConflicts: boolean;
}
