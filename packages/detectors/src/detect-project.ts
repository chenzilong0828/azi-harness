import path from "node:path";

import {
  isRecord,
  readJsonObject,
  readUtf8File,
  scanProjectFiles,
  type CapabilityFacts,
  type CommandFacts,
  type Confidence,
  type DetectedValue,
  type Evidence,
  type FrameworkFacts,
  type HtwTableFacts,
  type PackageManager,
  type ProjectFacts,
  type ProjectProfile,
  type ProjectType,
  type ScannedFile
} from "@azi-harness/core";

const HTW_TABLE_DOCUMENTATION_URL = "http://192.168.30.4/chenzl2/htw-table-vue";
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".vue"]);
const APPLICATION_ROOTS = new Set([
  "app",
  "components",
  "pages",
  "router",
  "src",
  "store",
  "utils",
  "views"
]);

interface TextFile {
  path: string;
  text: string;
}

interface DependencyEntry {
  name: string;
  versionSpec: string;
  section: string;
}

export async function detectProject(rootInput = "."): Promise<ProjectProfile> {
  const root = path.resolve(rootInput);
  const scan = await scanProjectFiles(root);
  const packageJson = await readJsonObject(root, "package.json");
  const dependencies = readDependencies(packageJson);
  const projectFiles = scan.files.filter(isProjectEvidenceFile);
  const textFiles = await readSourceFiles(projectFiles);

  const framework = detectFramework(dependencies);
  const ruoyi = detectRuoyi(packageJson, projectFiles, textFiles);
  const capabilities = detectCapabilities(projectFiles, textFiles);
  const htwTable = detectHtwTable(dependencies, textFiles, framework.vueMajor.value);
  const packageManager = detectPackageManager(packageJson, scan.files);
  const commands = detectCommands(packageJson);
  const projectType = detectProjectType(framework, ruoyi);

  const detected: ProjectFacts = {
    projectType,
    packageManager,
    framework,
    ruoyi,
    capabilities,
    htwTable,
    commands,
    warnings: [
      ...scan.warnings,
      ...(packageJson === null ? ["package.json is missing or invalid"] : [])
    ]
  };

  return {
    schemaVersion: "1",
    generatedAt: new Date().toISOString(),
    root: ".",
    detected,
    effective: cloneFacts(detected),
    overridesApplied: []
  };
}

function detectFramework(dependencies: DependencyEntry[]): FrameworkFacts {
  const vueDependency = dependencies.find((entry) => entry.name === "vue") ?? null;
  const vueEvidence = vueDependency === null
    ? [absence("package.json", "Vue dependency was not found")]
    : [dependencyEvidence(vueDependency)];
  const vueVersion = vueDependency?.versionSpec ?? null;
  const vueMajor = parseMajor(vueVersion);

  const elementUi = dependencies.find((entry) => entry.name === "element-ui") ?? null;
  const elementPlus = dependencies.find((entry) => entry.name === "element-plus") ?? null;
  const uiConflicts = elementUi !== null && elementPlus !== null
    ? ["Both element-ui and element-plus are declared"]
    : [];

  let ui: "element-ui" | "element-plus" | null = null;
  const uiEvidence: Evidence[] = [];
  if (elementUi !== null) {
    ui = "element-ui";
    uiEvidence.push(dependencyEvidence(elementUi));
  }
  if (elementPlus !== null) {
    ui = ui === null ? "element-plus" : ui;
    uiEvidence.push(dependencyEvidence(elementPlus));
  }
  if (uiEvidence.length === 0) {
    uiEvidence.push(absence("package.json", "Element UI dependency was not found"));
  }

  const uniappDependencies = dependencies.filter((entry) =>
    entry.name === "@dcloudio/uni-app"
    || entry.name === "@dcloudio/uni-cli-shared"
    || entry.name === "uni-app"
  );

  const frameworkConflicts: string[] = [];
  if (vueMajor === 2 && elementPlus !== null) {
    frameworkConflicts.push("Vue 2 is declared together with element-plus");
  }
  if (vueMajor === 3 && elementUi !== null) {
    frameworkConflicts.push("Vue 3 is declared together with element-ui");
  }

  return {
    vue: detected(
      vueVersion,
      vueDependency === null ? "low" : "high",
      vueEvidence,
      []
    ),
    vueMajor: detected(
      vueMajor,
      vueMajor === null ? "low" : "high",
      vueEvidence,
      frameworkConflicts
    ),
    ui: detected(
      ui,
      ui === null ? "low" : "high",
      uiEvidence,
      [...uiConflicts, ...frameworkConflicts]
    ),
    uniapp: detected(
      uniappDependencies.length > 0,
      uniappDependencies.length > 0 ? "high" : "medium",
      uniappDependencies.length > 0
        ? uniappDependencies.map(dependencyEvidence)
        : [absence("package.json", "uniapp dependency was not found")],
      []
    )
  };
}

function detectRuoyi(
  packageJson: Record<string, unknown> | null,
  files: ScannedFile[],
  textFiles: TextFile[]
): DetectedValue<boolean> {
  const evidence: Evidence[] = [];
  const packageName = typeof packageJson?.name === "string" ? packageJson.name : "";
  if (/ruoyi/i.test(packageName)) {
    evidence.push({
      kind: "content",
      source: "package.json",
      detail: `Package name contains ruoyi: ${packageName}`
    });
  }

  const markerPatterns = [
    /(^|\/)src\/directive\/permission\/hasPermi\.[^/]+$/i,
    /(^|\/)src\/store\/modules\/permission\.[^/]+$/i,
    /(^|\/)src\/plugins\/auth\.[^/]+$/i,
    /(^|\/)src\/utils\/ruoyi\.[^/]+$/i
  ];

  for (const file of files) {
    if (markerPatterns.some((pattern) => pattern.test(file.relativePath))) {
      evidence.push({
        kind: "file",
        source: file.relativePath,
        detail: "Matched a RuoYi project marker"
      });
    }
  }

  const hasRuoYiContent = textFiles.find((file) =>
    /v-hasPermi/.test(file.text) && /\buseDict\b|\bDictTag\b/.test(file.text)
  );
  if (hasRuoYiContent !== undefined) {
    evidence.push({
      kind: "content",
      source: hasRuoYiContent.path,
      detail: "Permission and dictionary conventions appear together"
    });
  }

  const value = evidence.length >= 2;
  return detected(
    value,
    value ? (evidence.length >= 3 ? "high" : "medium") : "low",
    value ? evidence : [...evidence, absence(".", "Insufficient RuoYi markers")],
    []
  );
}

function detectCapabilities(files: ScannedFile[], textFiles: TextFile[]): CapabilityFacts {
  const permission = detectTerms(textFiles, [
    ["v-hasPermi", /v-hasPermi/],
    ["hasPermi", /\bhasPermi\b/]
  ]);
  const dict = detectTerms(textFiles, [
    ["useDict", /\buseDict\b/],
    ["DictTag", /\bDictTag\b/]
  ]);
  const pagination = detectTerms(textFiles, [
    ["pageNum", /\bpageNum\b/],
    ["pageSize", /\bpageSize\b/],
    ["rows", /\brows\b/],
    ["total", /\btotal\b/]
  ]);
  const feedback = detectTerms(textFiles, [
    ["modal", /\$modal\b|\bElMessageBox\b|\bMessageBox\b/],
    ["message", /\$message\b|\bElMessage\b|\bMessage\.(success|warning|error|info)\b/],
    ["download", /\bdownload\s*\(|\$download\b/]
  ]);

  const requestPaths = files
    .filter((file) => /(^|\/)(request|axios)\.(js|ts)$/i.test(file.relativePath))
    .map((file) => file.relativePath);
  const axiosFactory = textFiles.find((file) => /\baxios\.create\s*\(/.test(file.text));
  if (axiosFactory !== undefined && !requestPaths.includes(axiosFactory.path)) {
    requestPaths.push(axiosFactory.path);
  }

  const routingPaths = files
    .filter((file) =>
      /(^|\/)src\/router(\/|\.)(.*\.)?(js|ts)$/i.test(file.relativePath)
      || /(^|\/)src\/store\/modules\/permission\.(js|ts)$/i.test(file.relativePath)
    )
    .map((file) => file.relativePath);

  return {
    permission,
    dict,
    request: detectedPaths(requestPaths, "request wrapper"),
    routing: detectedPaths(routingPaths, "router or dynamic menu entry"),
    pagination,
    feedback
  };
}

function detectHtwTable(
  dependencies: DependencyEntry[],
  textFiles: TextFile[],
  vueMajor: 2 | 3 | null
): HtwTableFacts {
  const dependency = dependencies.find((entry) => /htw[-_]?table/i.test(entry.name)) ?? null;
  const importFile = textFiles.find((file) => /from\s+["'][^"']*htw[-_]?table[^"']*["']|["']htw-table["']/i.test(file.text));
  const evidence: Evidence[] = [];

  if (dependency !== null) {
    evidence.push(dependencyEvidence(dependency));
  }
  if (importFile !== undefined) {
    evidence.push({
      kind: "content",
      source: importFile.path,
      detail: "Found an HTWTable import or registration"
    });
  }

  const installed = dependency !== null || importFile !== undefined;
  const versionSpec = dependency?.versionSpec ?? null;
  const conflicts: string[] = [];
  if (installed && vueMajor === 2) {
    conflicts.push("HTWTable was found in a Vue 2 project; Vue 3 usage is forbidden");
  }

  return {
    installed,
    packageName: dependency?.name ?? (importFile === undefined ? null : "htw-table"),
    versionSpec,
    source: dependency === null
      ? (importFile === undefined ? "unknown" : "project")
      : classifyDependencySource(dependency.versionSpec),
    compatibleVueMajor: installed && vueMajor === 3 ? 3 : null,
    documentationUrl: HTW_TABLE_DOCUMENTATION_URL,
    evidence: installed ? evidence : [absence("package.json", "HTWTable dependency was not found")],
    conflicts
  };
}

function detectPackageManager(
  packageJson: Record<string, unknown> | null,
  files: ScannedFile[]
): DetectedValue<PackageManager> {
  const candidates: Array<{ value: PackageManager; evidence: Evidence }> = [];
  const names = new Set(files.map((file) => file.relativePath));

  const lockfiles: Array<[string, PackageManager]> = [
    ["package-lock.json", "npm"],
    ["npm-shrinkwrap.json", "npm"],
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["bun.lock", "bun"],
    ["bun.lockb", "bun"]
  ];
  for (const [lockfile, manager] of lockfiles) {
    if (names.has(lockfile)) {
      candidates.push({
        value: manager,
        evidence: {
          kind: "lockfile",
          source: lockfile,
          detail: `Detected ${manager} lockfile`
        }
      });
    }
  }

  if (typeof packageJson?.packageManager === "string") {
    const declared = packageJson.packageManager.split("@")[0];
    if (isPackageManager(declared)) {
      candidates.unshift({
        value: declared,
        evidence: {
          kind: "content",
          source: "package.json",
          detail: `packageManager declares ${packageJson.packageManager}`
        }
      });
    }
  }

  if (candidates.length === 0) {
    return detected("unknown", "low", [absence(".", "No package manager marker was found")], []);
  }

  const unique = [...new Set(candidates.map((candidate) => candidate.value))];
  const value = candidates[0]?.value ?? "unknown";
  return detected(
    value,
    unique.length === 1 ? "high" : "medium",
    candidates.map((candidate) => candidate.evidence),
    unique.length > 1 ? [`Multiple package managers detected: ${unique.join(", ")}`] : []
  );
}

function detectCommands(packageJson: Record<string, unknown> | null): CommandFacts {
  const scriptsValue = packageJson?.scripts;
  const scripts = isRecord(scriptsValue) ? scriptsValue : {};
  const commands: CommandFacts = {
    dev: [],
    build: [],
    test: [],
    lint: [],
    other: {}
  };

  for (const [name, value] of Object.entries(scripts)) {
    if (typeof value !== "string") {
      continue;
    }
    if (/^(dev|serve|start)(:|$)/.test(name)) {
      commands.dev.push(name);
    } else if (/^build(:|$)/.test(name)) {
      commands.build.push(name);
    } else if (/^test(:|$)/.test(name) && !/(^|:)(watch|ui)(:|$)/.test(name)) {
      commands.test.push(name);
    } else if (/^lint(:|$)/.test(name) && !/(^|:)(fix|write)(:|$)/.test(name)) {
      commands.lint.push(name);
    } else {
      commands.other[name] = value;
    }
  }

  return commands;
}

function detectProjectType(
  framework: FrameworkFacts,
  ruoyi: DetectedValue<boolean>
): DetectedValue<ProjectType> {
  const evidence = [
    ...framework.vueMajor.evidence,
    ...framework.ui.evidence,
    ...framework.uniapp.evidence,
    ...ruoyi.evidence
  ];
  const conflicts = [
    ...framework.vueMajor.conflicts,
    ...framework.ui.conflicts,
    ...framework.uniapp.conflicts,
    ...ruoyi.conflicts
  ];

  if (framework.uniapp.value) {
    return detected("uniapp", "high", evidence, conflicts);
  }
  if (conflicts.length > 0) {
    return detected("unknown", "low", evidence, conflicts);
  }
  if (framework.vueMajor.value === 2 && framework.ui.value === "element-ui") {
    return detected(
      ruoyi.value ? "ruoyi-vue2-element-ui" : "vue2-element-ui",
      ruoyi.value ? ruoyi.confidence : "high",
      evidence,
      conflicts
    );
  }
  if (framework.vueMajor.value === 3 && framework.ui.value === "element-plus") {
    return detected(
      ruoyi.value ? "ruoyi-vue3-element-plus" : "vue3-element-plus",
      ruoyi.value ? ruoyi.confidence : "high",
      evidence,
      conflicts
    );
  }
  return detected("unknown", "low", evidence, conflicts);
}

function readDependencies(packageJson: Record<string, unknown> | null): DependencyEntry[] {
  if (packageJson === null) {
    return [];
  }

  const entries: DependencyEntry[] = [];
  for (const section of ["dependencies", "devDependencies", "peerDependencies"]) {
    const value = packageJson[section];
    if (!isRecord(value)) {
      continue;
    }
    for (const [name, versionSpec] of Object.entries(value)) {
      if (typeof versionSpec === "string") {
        entries.push({ name, versionSpec, section });
      }
    }
  }
  return entries;
}

function isProjectEvidenceFile(file: ScannedFile): boolean {
  const [firstSegment] = file.relativePath.split("/");
  return firstSegment !== undefined && APPLICATION_ROOTS.has(firstSegment);
}

async function readSourceFiles(files: ScannedFile[]): Promise<TextFile[]> {
  const candidates = files.filter((file) => SOURCE_EXTENSIONS.has(path.extname(file.relativePath)));
  const textFiles: TextFile[] = [];
  const batchSize = 50;

  for (let index = 0; index < candidates.length; index += batchSize) {
    const batch = candidates.slice(index, index + batchSize);
    const contents = await Promise.all(batch.map((file) => readUtf8File(file)));
    for (let offset = 0; offset < batch.length; offset += 1) {
      const file = batch[offset];
      const text = contents[offset];
      if (file !== undefined && text !== null && text !== undefined) {
        textFiles.push({ path: file.relativePath, text });
      }
    }
  }

  return textFiles;
}

function detectTerms(
  textFiles: TextFile[],
  terms: Array<[string, RegExp]>
): DetectedValue<string[]> {
  const values: string[] = [];
  const evidence: Evidence[] = [];

  for (const [label, pattern] of terms) {
    const match = textFiles.find((file) => pattern.test(file.text));
    if (match !== undefined) {
      values.push(label);
      evidence.push({
        kind: "content",
        source: match.path,
        detail: `Found ${label}`
      });
    }
  }

  return detected(
    values,
    values.length === terms.length ? "high" : values.length > 0 ? "medium" : "low",
    values.length > 0 ? evidence : [absence(".", `None of ${terms.map(([label]) => label).join(", ")} were found`)],
    []
  );
}

function detectedPaths(paths: string[], label: string): DetectedValue<string[]> {
  return detected(
    paths,
    paths.length > 0 ? "high" : "low",
    paths.length > 0
      ? paths.map((source) => ({ kind: "file", source, detail: `Found ${label}` }))
      : [absence(".", `No ${label} was found`)],
    []
  );
}

function detected<T>(
  value: T,
  confidence: Confidence,
  evidence: Evidence[],
  conflicts: string[]
): DetectedValue<T> {
  return { value, confidence, evidence, conflicts };
}

function dependencyEvidence(entry: DependencyEntry): Evidence {
  return {
    kind: "dependency",
    source: `package.json#${entry.section}.${entry.name}`,
    detail: `${entry.name}: ${entry.versionSpec}`
  };
}

function absence(source: string, detail: string): Evidence {
  return { kind: "absence", source, detail };
}

function parseMajor(versionSpec: string | null): 2 | 3 | null {
  if (versionSpec === null) {
    return null;
  }
  const match = versionSpec.match(/(?:^|[^\d])([23])(?:\.|$)/);
  return match?.[1] === "2" ? 2 : match?.[1] === "3" ? 3 : null;
}

function classifyDependencySource(versionSpec: string): HtwTableFacts["source"] {
  if (/^(git\+|https?:.*\.git|gitlab:|github:)/i.test(versionSpec)) {
    return "git";
  }
  if (/^file:/i.test(versionSpec)) {
    return "file";
  }
  if (/^workspace:/i.test(versionSpec)) {
    return "workspace";
  }
  return "registry";
}

function isPackageManager(value: string | undefined): value is PackageManager {
  return value === "npm"
    || value === "pnpm"
    || value === "yarn"
    || value === "bun";
}

function cloneFacts(facts: ProjectFacts): ProjectFacts {
  return JSON.parse(JSON.stringify(facts)) as ProjectFacts;
}
