import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  createReviewMarkdown,
  createReviewReport,
  writeReviewReport,
  writeReviewSuggestion
} from "./review-runtime.js";
import {
  applyPreparedWorkflowStart,
  prepareWorkflowStart
} from "./workflow-runtime.js";

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-review-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("review runtime", () => {
  it("creates and writes a review report", async () => {
    const root = await initializedFixture();
    await startReadyWorkflow(root);

    const report = await createReviewReport({
      root,
      target: "specs/001-audit-log",
      quick: true,
      generatedAt: "2026-06-18T01:02:03.004Z"
    });

    expect(report.target).toBe("specs/001-audit-log");
    expect(report.checks.quick).toBe(true);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(createReviewMarkdown(report)).toContain("## 规格意图与追踪");

    const written = await writeReviewReport(report);
    expect(written).toBe(".harness/reviews/20260618010203004-001-audit-log.md");
    const markdown = await readFile(path.join(root, written), "utf8");
    expect(markdown).toContain("目标规格：specs/001-audit-log");
    expect(markdown).toContain("## 验收证据");
  });

  it("collects staged, unstaged, and untracked changes and blocks sensitive scope drift", async () => {
    const root = await initializedFixture();
    await startReadyWorkflow(root);
    const declaredFile = path.join(root, "src/views/system/log/index.vue");
    await mkdir(path.dirname(declaredFile), { recursive: true });
    await writeFile(declaredFile, "<template><div>audit log</div></template>\n", "utf8");
    await initializeGit(root);

    await writeFile(declaredFile, "<template><div>audit log ready</div></template>\n", "utf8");
    await git(root, "add", "src/views/system/log/index.vue");
    await writeFile(path.join(root, "src/router/index.ts"), "export const routes = []\n", "utf8");
    await writeFile(path.join(root, "src/views/system/log/unplanned.vue"), "<template />\n", "utf8");

    const report = await createReviewReport({
      root,
      target: "specs/001-audit-log",
      quick: true,
      diff: true,
      evidence: false,
      generatedAt: "2026-06-22T02:03:04.005Z"
    });

    expect(report.git.stagedFiles).toContain("src/views/system/log/index.vue");
    expect(report.git.unstagedFiles).toContain("src/router/index.ts");
    expect(report.git.untrackedFiles).toContain("src/views/system/log/unplanned.vue");
    expect(report.git.diff).toContain("audit log ready");
    expect(report.specAudit?.scope.inScopeFiles).toContain("src/views/system/log/index.vue");
    expect(report.specAudit?.scope.outOfScopeFiles).toEqual(expect.arrayContaining([
      "src/router/index.ts",
      "src/views/system/log/unplanned.vue"
    ]));
    expect(report.findings.some((item) => item.code === "scope-sensitive-files-unplanned")).toBe(true);
    expect(report.recommendation).toBe("blocked");
  }, 15_000);

  it("rejects unsupported command claims and writes a non-destructive proposal patch", async () => {
    const root = await initializedFixture();
    await startReadyWorkflow(root, {
      commandResult: "通过",
      evidenceReference: "evidence/missing-screen.png"
    });
    const acceptancePath = path.join(root, "specs/001-audit-log/acceptance.md");
    const acceptanceBefore = await readFile(acceptancePath, "utf8");

    const report = await createReviewReport({
      root,
      target: "specs/001-audit-log",
      quick: true,
      evidence: true,
      generatedAt: "2026-06-22T03:04:05.006Z"
    });

    expect(report.findings.some((item) => item.code === "command-claim-unverified")).toBe(true);
    expect(report.findings.some((item) => item.code === "acceptance-evidence-file-missing")).toBe(true);
    expect(report.recommendation).toBe("blocked");

    const proposal = await writeReviewSuggestion(report);
    expect(proposal.written).toEqual([
      ".harness/proposals/20260622030405006-001-audit-log-review.patch"
    ]);
    expect(await readFile(acceptancePath, "utf8")).toBe(acceptanceBefore);
    const patchContent = await readFile(path.join(root, proposal.written[0] ?? ""), "utf8");
    expect(patchContent).toContain("+++ b/specs/001-audit-log/acceptance.md");
    expect(patchContent).toContain("REVIEW-001");
    const repeated = await writeReviewSuggestion(report);
    expect(repeated.written).toEqual([]);
    expect(repeated.skipped[0]).toContain("相同建议补丁已存在");
  });

  it("warns when no target spec is supplied", async () => {
    const root = await initializedFixture();
    const report = await createReviewReport({ root, quick: true });

    expect(report.findings.some((item) => item.code === "review-target-missing")).toBe(true);
    expect(report.recommendation).not.toBe("ready");
    expect((await writeReviewSuggestion(report)).skipped).toContain(
      "未指定目标规格，无法生成 acceptance.md 建议补丁。"
    );
  });

  it("blocks Vue 2 APIs introduced into a Vue 3 project", async () => {
    const root = await initializedFixture();
    await startReadyWorkflow(root);
    await writeFile(path.join(root, "src/main.ts"), "const app = new Vue({});\n", "utf8");

    const report = await createReviewReport({
      root,
      target: "specs/001-audit-log",
      quick: true
    });

    expect(report.findings).toContainEqual(expect.objectContaining({
      severity: "error",
      code: "vue3-no-new-vue"
    }));
    expect(report.recommendation).toBe("blocked");
  });
});

async function initializedFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-review-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  await applyPreparedInitialization(await prepareRuntimeInitialization(root));
  return root;
}

async function startReadyWorkflow(
  root: string,
  options: {
    commandResult?: string;
    evidenceReference?: string;
  } = {}
): Promise<void> {
  await applyPreparedWorkflowStart(await prepareWorkflowStart({
    root,
    featureName: "audit-log",
    slug: null,
    task: "实现审计日志列表",
    includeAvoided: false
  }));
  const specRoot = path.join(root, "specs/001-audit-log");

  await writeFile(path.join(specRoot, "requirements.md"), [
    "# 需求：001-audit-log",
    "",
    "## SDD 追踪",
    "",
    "- REQ-001：支持审计日志列表查询。",
    "  - Source / 来源：业务需求确认。",
    "  - Status / 状态：confirmed",
    "  - Tasks / 任务：TASK-001",
    "  - Acceptance / 验收：ACC-001",
    "",
    "## 背景与目标",
    "",
    "- Background / 背景：补充审计日志能力。",
    "- User goal / 用户目标：查询审计日志。",
    "- Business goal / 业务目标：提升追溯效率。",
    "",
    "## 用户角色",
    "",
    "- Roles / 角色：系统管理员。",
    "",
    "## 范围",
    "",
    "- In scope / 本次包含：审计日志列表。",
    "- Out of scope / 本次不包含：路由和权限基础设施。",
    "",
    "## 业务规则",
    "",
    "- Rules / 规则：遵循若依分页约定。",
    "",
    "## 已确认事实",
    "",
    "- APIs：使用已确认的日志列表接口。",
    "- Permissions / 权限：system:log:list。",
    "- Dictionaries / 字典：无需新增。",
    "",
    "## 验收条件",
    "",
    "- [x] 列表查询和分页符合规格。",
    "",
    "## 未知项",
    "",
    "- 无。"
  ].join("\n"), "utf8");

  await writeFile(path.join(specRoot, "design.md"), [
    "# 设计：001-audit-log",
    "",
    "## 页面和模块边界",
    "",
    "- Route / 路由：/system/log",
    "- Entry points / 入口：动态菜单。",
    "- Modules / 模块：查询和列表。",
    "",
    "## 数据与请求",
    "",
    "- Data flow / 数据流：query -> request -> rows。",
    "- Request mapping / 请求映射：getLogList。",
    "",
    "## 接入与复用",
    "",
    "- Permission integration / 权限接入：v-hasPermi。",
    "- Dictionary integration / 字典接入：无需新增。",
    "- Feedback / Message / Download 复用：复用项目能力。",
    "- Component choice / 组件选择：HTWTable。",
    "- HTWTable evaluation / HTWTable 评估：普通 Vue3 列表，适配已安装公开 API。",
    "",
    "## 状态与交互",
    "",
    "- States / 状态：default、loading、empty、error。",
    "- Interactions / 交互：查询、重置和分页。",
    "",
    "## 实现约束",
    "",
    "- Vue constraints / Vue 约束：遵守 Vue3 API。",
    "- Rollback / 回退方案：保留原列表方案。",
    "",
    "## 风险",
    "",
    "- [x] 已核对 HTWTable 公开 API。"
  ].join("\n"), "utf8");

  await writeFile(path.join(specRoot, "tasks.md"), [
    "# 任务：001-audit-log",
    "",
    "## 任务列表",
    "",
    "- [x] TASK-001 实现审计日志列表",
    "  - Requirement / 需求：REQ-001",
    "  - Files / 文件：src/views/system/log/index.vue",
    "  - Depends on / 前置：接口与权限已确认",
    "  - Verify / 验证：azi review --evidence"
  ].join("\n"), "utf8");

  const commandResult = options.commandResult ?? "待执行";
  const evidenceReference = options.evidenceReference ?? "evidence/review.txt";
  await writeFile(path.join(specRoot, "acceptance.md"), [
    "# 验收：001-audit-log",
    "",
    "## 功能验收",
    "",
    "- [x] ACC-001 审计日志列表查询已验证。",
    "  - Requirement / 需求：REQ-001",
    `  - Evidence / 证据：${evidenceReference}`,
    "",
    "## 权限验收",
    "",
    "- [x] permission 行为已验证。",
    "",
    "## 字典与状态",
    "",
    "- [x] 字典展示、loading、empty、error、normal 状态已验证。",
    "",
    "## 分页字段",
    "",
    "- [x] pageNum/pageSize/rows/total 行为已验证。",
    "",
    "## 视觉对照",
    "",
    "- [x] 已对照同项目页面。",
    "",
    "## 检查结果",
    "",
    `- lint：${commandResult}`,
    `- test：${commandResult}`,
    `- build：${commandResult}`,
    "",
    "## Review 记录",
    "",
    "- Reviewer：待人工复核。",
    "- Notes：自动检查后补充。",
    "",
    "## HTWTable 说明",
    "",
    "- Used / Exception：使用已安装 HTWTable。"
  ].join("\n"), "utf8");

  await writeFile(path.join(specRoot, "screens.yaml"), [
    "version: 1",
    "feature: audit-log",
    "source:",
    "  type: legacy-page",
    "  url: \"\"",
    "  nodeId: \"\"",
    "  reference: \"src/views/system/role/index.vue\"",
    "  status: fallback",
    "  retriedAt: \"\"",
    "  fallback: \"same-project-list-page\"",
    "  notes: \"Approved test fixture.\"",
    "screens:",
    "  - id: list",
    "    route: \"/system/log\"",
    "    title: \"审计日志\"",
    "    states:",
    "      - default",
    "    regions: []",
    "    interactions: []",
    "    assets: []",
    "unknowns: []",
    ""
  ].join("\n"), "utf8");

  if (options.evidenceReference === undefined) {
    await writeFile(path.join(specRoot, "evidence/review.txt"), "人工验收记录。\n", "utf8");
  }
}

async function initializeGit(root: string): Promise<void> {
  await git(root, "init");
  await git(root, "config", "user.email", "azi-harness@example.invalid");
  await git(root, "config", "user.name", "azi-harness test");
  await git(root, "add", ".");
  await git(root, "commit", "-m", "baseline");
}

async function git(root: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: root, windowsHide: true });
}
