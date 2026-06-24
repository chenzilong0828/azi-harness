import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createFullFilePatch,
  pathExists,
  readJsonObject,
  resolveInsideRoot,
  scanProjectFiles,
  type ProjectProfile
} from "@azi-harness/core";

import type { FigmaAssetDownloadReport, PreparedFigmaWrite } from "./figma-runtime.js";

export interface SimilarPageCandidate {
  path: string;
  score: number;
  reasons: string[];
}

export interface ImplementationContextReport {
  root: string;
  specPath: string;
  featureName: string;
  slug: string;
  contextPath: string;
  suggestedTarget: string;
  similarPages: SimilarPageCandidate[];
  written: string | null;
  warnings: string[];
  nextActions: string[];
}

export interface ImplementationPatchReport {
  root: string;
  specPath: string;
  targetPath: string;
  proposalPath: string;
  sourcePath: string | null;
  status: "applied" | "written" | "preview" | "skipped";
  written: string | null;
  applied: string | null;
  reason: string | null;
  warnings: string[];
  nextActions: string[];
}

export async function createImplementationContext(options: {
  root: string;
  specPath: string;
  featureName: string;
  slug: string;
  figma: PreparedFigmaWrite | null;
  assets: FigmaAssetDownloadReport | null;
  write: boolean;
}): Promise<ImplementationContextReport> {
  const root = path.resolve(options.root);
  const profile = await readProjectProfile(root);
  const similarPages = await findSimilarPages(root, options.slug, options.featureName);
  const suggestedTarget = suggestTargetPath(options.slug, similarPages);
  const contextPath = `.harness/implementation/${path.posix.basename(options.specPath)}/codex-context.md`;
  const content = createContextMarkdown({
    ...options,
    profile,
    similarPages,
    suggestedTarget
  });

  let written: string | null = null;
  if (options.write) {
    const target = resolveInsideRoot(root, contextPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    written = contextPath;
  }

  return {
    root,
    specPath: options.specPath,
    featureName: options.featureName,
    slug: options.slug,
    contextPath,
    suggestedTarget,
    similarPages,
    written,
    warnings: similarPages.length === 0
      ? ["没有找到相似页面，Codex 需要先扫描项目结构再决定实现位置。"]
      : [],
    nextActions: [
      `把 ${contextPath} 作为 Codex 实现上下文。`,
      `优先检查建议目标文件：${suggestedTarget}。`,
      "实现后运行 `npx azi check` 和 `npx azi review --target <spec-path> --full --diff --evidence --write`。"
    ]
  };
}

export async function createImplementationPatchCandidate(options: {
  root: string;
  specPath: string;
  featureName: string;
  slug: string;
  context: ImplementationContextReport;
  write: boolean;
  apply?: boolean;
}): Promise<ImplementationPatchReport> {
  const root = path.resolve(options.root);
  const profile = await readProjectProfile(root);
  const targetPath = options.context.suggestedTarget;
  const proposalPath = `.harness/proposals/${path.posix.basename(options.specPath)}-implementation.patch`;
  const sourcePath = options.context.similarPages[0]?.path ?? null;
  const warnings: string[] = [];

  if (await pathExists(resolveInsideRoot(root, targetPath))) {
    return {
      root,
      specPath: options.specPath,
      targetPath,
      proposalPath,
      sourcePath,
      status: "skipped",
      written: null,
      applied: null,
      reason: `目标文件已存在：${targetPath}。为避免覆盖业务代码，只生成上下文，不生成整页补丁。`,
      warnings,
      nextActions: [
        `打开 ${options.context.contextPath}，基于相似页面对 ${targetPath} 做最小修改。`,
        "如果确实要重建页面，先人工删除或移动目标文件后重新运行。"
      ]
    };
  }

  const sourceContent = sourcePath === null
    ? ""
    : await readSmallText(resolveInsideRoot(root, sourcePath), 256 * 1024);
  if (sourcePath === null) {
    warnings.push("没有相似页面，候选补丁只能生成保守的 Vue 页面骨架。");
  }

  const candidate = createVuePageCandidate({
    featureName: options.featureName,
    slug: options.slug,
    profile,
    sourcePath,
    sourceContent
  });
  const patch = createFullFilePatch(targetPath, null, candidate);

  let written: string | null = null;
  let applied: string | null = null;
  if (options.write) {
    const target = resolveInsideRoot(root, proposalPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, patch, "utf8");
    written = proposalPath;
  }
  if (options.apply === true) {
    const target = resolveInsideRoot(root, targetPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, candidate, "utf8");
    applied = targetPath;
  }

  const status: ImplementationPatchReport["status"] = applied !== null
    ? "applied"
    : options.write
      ? "written"
      : "preview";

  return {
    root,
    specPath: options.specPath,
    targetPath,
    proposalPath,
    sourcePath,
    status,
    written,
    applied,
    reason: null,
    warnings,
    nextActions: applied === null
      ? [
          `审查 ${proposalPath}，确认接口、权限、字典和字段事实后再应用。`,
          `补丁目标是创建 ${targetPath}，不会自动改业务代码。`,
          "应用后运行 `npx azi check`。"
        ]
      : [
          `已创建 ${targetPath}，继续补齐真实接口、权限、字典和字段事实。`,
          `仍保留 ${proposalPath} 供审查。`,
          "完成业务事实补齐后运行 `npx azi check`。"
        ]
  };
}

async function findSimilarPages(root: string, slug: string, featureName: string): Promise<SimilarPageCandidate[]> {
  const scan = await scanProjectFiles(root, { maxFiles: 8000 });
  const tokens = tokenize(`${slug} ${featureName}`);
  const candidates: SimilarPageCandidate[] = [];

  for (const file of scan.files) {
    const normalized = file.relativePath.replace(/\\/g, "/");
    if (!/^src\/views\/.+\.vue$/u.test(normalized)) {
      continue;
    }
    const content = await readSmallText(file.absolutePath, file.size);
    const reasons: string[] = [];
    let score = 0;

    if (normalized.endsWith("/index.vue")) {
      score += 10;
      reasons.push("标准若依页面入口 index.vue");
    }
    if (tokens.some((token) => normalized.toLowerCase().includes(token))) {
      score += 20;
      reasons.push("路径名称与功能名相似");
    }
    if (content.includes("v-hasPermi") || content.includes("hasPermi")) {
      score += 8;
      reasons.push("包含若依权限写法");
    }
    if (content.includes("useDict") || content.includes("DictTag")) {
      score += 8;
      reasons.push("包含字典用法");
    }
    if (content.includes("pageNum") && content.includes("pageSize")) {
      score += 8;
      reasons.push("包含分页约定");
    }
    if (content.includes("ElTable") || content.includes("el-table") || content.includes("HTWTable") || content.includes("htw-table")) {
      score += 6;
      reasons.push("包含列表/表格实现");
    }
    if (content.includes("@/utils/request") || content.includes("/api/")) {
      score += 5;
      reasons.push("包含请求封装线索");
    }
    if (/src\/views\/system\//u.test(normalized)) {
      score += 4;
      reasons.push("位于 system 模块，可作为后台管理页参考");
    }

    if (score > 0) {
      candidates.push({ path: normalized, score, reasons });
    }
  }

  return candidates
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path))
    .slice(0, 5);
}

function createVuePageCandidate(input: {
  featureName: string;
  slug: string;
  profile: ProjectProfile;
  sourcePath: string | null;
  sourceContent: string;
}): string {
  const useHtwTable = input.profile.effective.htwTable.installed
    && /<\/?HtwTable\b|<\/?htw-table\b/u.test(input.sourceContent);
  const sourceLine = input.sourcePath === null
    ? "Generated from project profile; no similar page was found."
    : `Generated from similar page pattern: ${input.sourcePath}.`;
  const tableOpen = useHtwTable ? "<HtwTable>" : "<el-table v-loading=\"loading\" :data=\"rows\">";
  const tableClose = useHtwTable ? "</HtwTable>" : "</el-table>";
  const htwImport = useHtwTable ? "import HtwTable from \"htw-table\";\n" : "";

  return [
    "<script setup lang=\"ts\">",
    "import { reactive, ref } from \"vue\";",
    "import { ElMessage } from \"element-plus\";",
    htwImport.trimEnd(),
    "",
    `// ${sourceLine}`,
    "// Replace placeholder fields only after the API contract is confirmed.",
    "const loading = ref(false);",
    "const total = ref(0);",
    "const rows = ref<Array<{ id: number; name: string; status: string }>>([]);",
    "const queryParams = reactive({",
    "  pageNum: 1,",
    "  pageSize: 10,",
    "  keyword: \"\"",
    "});",
    "",
    "function getList() {",
    "  loading.value = false;",
    "  rows.value = [];",
    "  total.value = 0;",
    "}",
    "",
    "function handleQuery() {",
    "  queryParams.pageNum = 1;",
    "  getList();",
    "}",
    "",
    "function resetQuery() {",
    "  queryParams.keyword = \"\";",
    "  handleQuery();",
    "}",
    "",
    "function handleCreate() {",
    "  ElMessage.info(\"请先确认接口、权限和字段事实。\");",
    "}",
    "</script>",
    "",
    "<template>",
    "  <div class=\"app-container\">",
    "    <el-form :model=\"queryParams\" inline>",
    "      <el-form-item label=\"关键词\">",
    "        <el-input",
    "          v-model=\"queryParams.keyword\"",
    `          placeholder=\"请输入${input.featureName}关键词\"`,
    "          clearable",
    "          @keyup.enter=\"handleQuery\"",
    "        />",
    "      </el-form-item>",
    "      <el-form-item>",
    "        <el-button type=\"primary\" @click=\"handleQuery\">搜索</el-button>",
    "        <el-button @click=\"resetQuery\">重置</el-button>",
    "      </el-form-item>",
    "    </el-form>",
    "",
    "    <el-row class=\"mb8\">",
    "      <el-col :span=\"1.5\">",
    `        <el-button type=\"primary\" plain @click=\"handleCreate\">新增${input.featureName}</el-button>`,
    "      </el-col>",
    "    </el-row>",
    "",
    `    ${tableOpen}`,
    "      <el-table-column label=\"名称\" prop=\"name\" min-width=\"160\" />",
    "      <el-table-column label=\"状态\" prop=\"status\" width=\"120\" />",
    `    ${tableClose}`,
    "",
    "    <pagination",
    "      v-if=\"total > 0\"",
    "      v-model:page=\"queryParams.pageNum\"",
    "      v-model:limit=\"queryParams.pageSize\"",
    "      :total=\"total\"",
    "      @pagination=\"getList\"",
    "    />",
    "  </div>",
    "</template>",
    ""
  ].filter((line, index, lines) => !(line === "" && lines[index - 1] === "")).join("\n");
}

function suggestTargetPath(slug: string, similarPages: SimilarPageCandidate[]): string {
  const [first, second] = slug.split("-");
  const moduleName = first === undefined || first === "" ? "system" : first;
  if (similarPages[0]?.path.includes("src/views/system/")) {
    return `src/views/system/${slug}/index.vue`;
  }
  const pageName = second === undefined || second === "" ? slug : slug.split("-").slice(1).join("-");
  return `src/views/${moduleName}/${pageName}/index.vue`;
}

function createContextMarkdown(input: {
  root: string;
  specPath: string;
  featureName: string;
  slug: string;
  figma: PreparedFigmaWrite | null;
  assets: FigmaAssetDownloadReport | null;
  profile: ProjectProfile;
  similarPages: SimilarPageCandidate[];
  suggestedTarget: string;
}): string {
  return [
    `# Codex 实现上下文：${input.featureName}`,
    "",
    "## 目标",
    "",
    `- 根据 Figma 节点实现或改造页面：${input.featureName}`,
    `- 规格目录：${input.specPath}`,
    `- 建议目标文件：${input.suggestedTarget}`,
    "",
    "## Figma 与资源缓存",
    "",
    `- Figma 缓存：${input.figma?.cachePath ?? "未生成"}`,
    `- 来源补丁：${input.figma?.proposalPath ?? "未生成"}`,
    `- SVG 资源：${input.assets === null ? "未检查" : `${input.assets.status}，${input.assets.icons.length} 个`}`,
    ...(input.assets?.icons ?? []).map((icon) => `  - ${icon.name}: ${icon.file}`),
    ...(input.assets?.skipped ?? []).map((item) => `  - skipped: ${item}`),
    ...(input.assets?.warnings ?? []).map((item) => `  - warning: ${item}`),
    "",
    "## 项目事实",
    "",
    `- 项目类型：${input.profile.effective.projectType.value}`,
    `- Vue 主版本：${input.profile.effective.framework.vueMajor.value ?? "unknown"}`,
    `- UI：${input.profile.effective.framework.ui.value ?? "unknown"}`,
    `- 若依：${input.profile.effective.ruoyi.value ? "yes" : "no"}`,
    `- HTWTable：${input.profile.effective.htwTable.installed ? "installed" : "not found"}`,
    "",
    "## 相似页面优先参考",
    "",
    ...(input.similarPages.length === 0
      ? ["- 未找到候选相似页面。"]
      : input.similarPages.flatMap((page) => [
        `- ${page.path}（score ${page.score}）`,
        `  - ${page.reasons.join("；")}`
      ])),
    "",
    "## Codex 执行要求",
    "",
    "1. 先读相似页面，复用项目已有布局、查询区、表格、分页、弹窗、权限和请求封装。",
    "2. 优先使用已缓存 SVG；没有资源时先保留项目已有 icon 方案，不要临时请求 Figma。",
    "3. 不从 Figma 推断接口、权限、字典或后端字段；缺失事实写入规格未知项。",
    "4. 改动范围优先限制在建议目标文件和必要 API 文件；路由、权限、store、公共组件属于敏感变更。",
    "5. 完成后运行 `npx azi check`，再运行 `npx azi review --target <spec-path> --full --diff --evidence --write`。",
    "",
    "## 最小下一步",
    "",
    `- 如果目标文件不存在，基于最相似页面创建 ${input.suggestedTarget}。`,
    "- 如果目标文件已存在，只做最小补丁，不重写整页。",
    "- 把真实检查结果回填到 acceptance.md。",
    ""
  ].join("\n");
}

async function readProjectProfile(root: string): Promise<ProjectProfile> {
  const value = await readJsonObject(root, ".harness/project.json");
  if (!isProjectProfile(value)) {
    throw new Error("Missing or invalid `.harness/project.json`. Run `npx azi setup . --yes` first.");
  }
  return value;
}

async function readSmallText(filePath: string, size: number): Promise<string> {
  if (size > 256 * 1024 || !(await pathExists(filePath))) {
    return "";
  }
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3);
}

function isProjectProfile(value: unknown): value is ProjectProfile {
  return typeof value === "object"
    && value !== null
    && "schemaVersion" in value
    && "effective" in value;
}
