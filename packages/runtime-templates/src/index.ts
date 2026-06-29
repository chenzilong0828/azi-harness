import {
  sha256,
  type ProjectProfile,
  type RuntimeFileIntent,
  type RuntimeManifest
} from "@azi-harness/core";

export const RUNTIME_VERSION = "0.1.3";
const TEMPLATE_VERSION = "11";

export interface RuntimeTemplateOptions {
  includeAgents: boolean;
  agentsProposal: string | null;
  manifestGeneratedAt?: string | null;
}

export function createRuntimeIntents(
  profile: ProjectProfile,
  options: RuntimeTemplateOptions = {
    includeAgents: true,
    agentsProposal: null,
    manifestGeneratedAt: null
  }
): RuntimeFileIntent[] {
  const intents: RuntimeFileIntent[] = [];

  if (options.includeAgents) {
    intents.push(managed("AGENTS.md", createAgentsDocument(profile)));
  }

  intents.push(
    seeded(".harness/config.json", json(createConfig(profile))),
    managed(".harness/project.json", json(profile)),
    managed(".harness/skill-map.json", json(createSkillMap(profile))),
    managed(".harness/skill-catalog.json", json(createSkillCatalog(profile))),
    managed(".harness/docs/overview.md", createOverview(profile)),
    managed(".harness/docs/project-profile.md", createProjectProfileDocument(profile)),
    managed(".harness/docs/commands.md", createCommandsDocument(profile)),
    managed(".harness/docs/workflow.md", createWorkflowDocument()),
    managed(".harness/docs/ai-tools.md", createAiToolsDocument(profile)),
    managed(".harness/docs/skill-sources.md", createSkillSourcesDocument(profile)),
    managed(".harness/docs/skill-hub.md", createSkillHubDocument(profile)),
    managed(".harness/docs/gitlab-ci.example.yml", createGitLabCiExample()),
    managed(".harness/rules/project-conventions.md", createProjectConventions(profile)),
    managed(".harness/rules/ruoyi.md", createRuoyiRules(profile)),
    managed(".harness/rules/htw-table.md", createHtwTableRules(profile)),
    managed(".harness/rules/figma.md", createFigmaRules()),
    managed(".harness/rules/quality.md", createQualityRules()),
    managed(".cursor/rules/azi-harness.mdc", createCursorRule(profile)),
    managed("specs/README.md", createSpecsReadme()),
    managed(".agents/skills/README.md", createSkillIndexDocument(profile))
  );

  if (options.agentsProposal !== null) {
    intents.push(
      managed(".harness/proposals/AGENTS.md.patch", options.agentsProposal)
    );
  }

  const manifest = createManifest(profile, intents, options.manifestGeneratedAt ?? null);
  intents.push(managed(".harness/manifest.json", json(manifest)));
  return intents;
}

export function createAgentsEntry(profile: ProjectProfile): string {
  const skillNames = createPreferredSkillSummary();

  return [
    "## azi-harness",
    "",
    "修改代码前必须先完成：",
    "1. 阅读 `.harness/project.json`。",
    "2. 阅读 `.harness/rules/` 和 `specs/` 下当前功能规格。",
    "3. 阅读 `.agents/skills/README.md`、`.harness/skill-catalog.json` 和 `.harness/docs/skill-hub.md`。",
    "4. 用户给出 Figma URL、说“按 Figma 页面开发”或“还原设计稿”时，优先运行 `npx azi task \"<用户原话>\"`。",
    "5. `azi task` 检测到 Figma URL 会读取 `.harness/project.json`、优先复用 `.harness/figma-cache/`，缺失时才走 `azi figma \"<url>\" --yes` 的同等流程。",
    "6. 用户说“使用 HTWTable / 核对表格 API”时，运行 `npx azi task \"<用户原话>\"`，让工具写入 `.harness/docs/htw-table-api.md`。",
    "7. 用户说“自检 / 跑检查 / 交付前检查”时，运行 `npx azi task \"<用户原话>\"`，让工具自动跑 quick check。",
    "8. 只有用户明确允许或命令带 `--apply` 时，才可创建缺失目标页面；已有业务页面只能做最小补丁。",
    "9. 新功能、修改、修复等非 Figma 场景也优先运行 `npx azi task \"<用户原话>\"`；它会自动创建或复用 workflow/spec。显式底层入口才使用 `npx azi workflow start <feature-name> --task \"<任务描述>\" --yes`。",
    "10. 查看阶段状态运行 `npx azi workflow status`，推进阶段运行 `npx azi workflow advance --target specs/<id-feature> --to <stage>`。",
    "11. 编码前运行 `npx azi sdd status --target specs/<id-feature>`；需要结构化辅助时使用 `npx azi sdd <phase> --target specs/<id-feature> --write`。",
    "",
    `识别到的项目类型：\`${profile.effective.projectType.value}\`。`,
    `推荐 Skill 来源：${skillNames}。`,
    profile.effective.ruoyi.value
      ? "若依约束以 `.harness/rules/ruoyi.md` 和功能规格为准，不依赖项目自写 Skill。"
      : "项目内不内置自写业务 Skill，避免与全局外部 Skill 重复。",
    "",
    "禁止读取或套用 `.windsurfrules`。",
    "禁止猜测接口、权限标识、字典类型或后端字段。",
    "若依项目的权限、字典、请求封装、分页、路由、菜单和 HTWTable 必须来自项目事实与相似页面。",
    "交付前运行 `npx azi check` 或 quick check；CI/MR 中运行 `npx azi review --target specs/<id-feature> --ci`，输出并阻断问题。"
  ].join("\n");
}

function createAgentsDocument(profile: ProjectProfile): string {
  return [
    "# AGENTS.md",
    "",
    "本文件是当前项目的 AI 协作短入口。",
    "",
    createAgentsEntry(profile),
    "",
    "详细说明请阅读 `.harness/`、`.agents/skills/` 和 `specs/`。"
  ].join("\n");
}

function createConfig(profile: ProjectProfile): Record<string, unknown> {
  const commands = profile.effective.commands;
  return {
    schemaVersion: "1",
    checks: {
      runProjectCommands: true,
      commands: {
        lint: {
          enabled: true,
          reason: null,
          scope: "changed-source"
        },
        test: {
          enabled: true,
          reason: null
        },
        build: {
          enabled: true,
          reason: null
        }
      }
    },
    commands: {
      lint: commands.lint[0] ?? null,
      test: commands.test[0] ?? null,
      build: commands.build[0] ?? null
    },
    overrides: []
  };
}

function createManifest(
  profile: ProjectProfile,
  intents: RuntimeFileIntent[],
  generatedAt: string | null
): RuntimeManifest {
  return {
    schemaVersion: "1",
    runtimeVersion: RUNTIME_VERSION,
    generatedAt: generatedAt ?? new Date().toISOString(),
    files: intents.map((intent) => ({
      path: intent.path,
      ownership: intent.ownership,
      templateVersion: intent.templateVersion,
      sha256: sha256(intent.content)
    })),
    detectionDigest: sha256(JSON.stringify(profile.detected))
  };
}

function createOverview(profile: ProjectProfile): string {
  return [
    "# azi-harness 运行时",
    "",
    `当前项目识别为 \`${profile.effective.projectType.value}\`。`,
    "",
    "## 阅读顺序",
    "",
    "1. `.harness/project.json`",
    "2. `.harness/skill-map.json` 和 `.harness/skill-catalog.json`",
    "3. `.harness/rules/` 和 `.harness/docs/skill-hub.md`",
    "4. `specs/` 下当前功能目录",
    "5. `.agents/skills/README.md`",
    "",
    "项目事实必须来自当前仓库的证据。证据缺失或互相冲突时，",
    "应记录未知项并向人工确认，不得猜测。",
    "",
    "## 低指令触发",
    "",
    "用户只需要自然语言描述任务。若包含 Figma URL、还原设计稿、按 Figma 页面开发等意图，",
    "AI 应先运行 `npx azi task \"<用户原话>\"`，让运行时自动判断 Figma 缓存、HTWTable API 证据、质量检查、相似页面、Skill 匹配、实现上下文和 quick check。"
  ].join("\n");
}

function createProjectProfileDocument(profile: ProjectProfile): string {
  const facts = profile.effective;
  return [
    "# 项目画像",
    "",
    `- 项目类型：\`${facts.projectType.value}\`（${facts.projectType.confidence}）`,
    `- Vue: \`${facts.framework.vue.value ?? "unknown"}\``,
    `- Vue 主版本：\`${facts.framework.vueMajor.value ?? "unknown"}\``,
    `- UI 框架：\`${facts.framework.ui.value ?? "unknown"}\``,
    `- 是否若依：\`${facts.ruoyi.value}\``,
    `- 包管理器：\`${facts.packageManager.value}\``,
    `- HTWTable：\`${facts.htwTable.installed ? "已安装" : "未发现"}\``,
    "",
    "机器可读的完整证据存放在 `.harness/project.json`。"
  ].join("\n");
}

function createCommandsDocument(profile: ProjectProfile): string {
  const commands = profile.effective.commands;
  return [
    "# 项目命令",
    "",
    formatCommandSection("开发命令", commands.dev),
    "",
    formatCommandSection("Lint 命令", commands.lint),
    "",
    formatCommandSection("测试命令", commands.test),
    "",
    formatCommandSection("构建命令", commands.build),
    "",
    "`azi check` 会分别执行已配置的 lint、test、build 脚本一次；默认 lint 只检查本次 Git 变更的源码文件，避免老项目全量格式债阻塞新需求。",
    "如需全量 lint，可把 `.harness/config.json -> checks.commands.lint.scope` 改为 `all`。",
    "`azi check --quick` 会跳过项目命令，只保留运行时、规格和规则检查。",
    "`azi task \"<用户原话>\"` 是统一自然语言入口；检测到 Figma URL 时自动走 Figma 缓存、相似页面、Skill 匹配、实现上下文和 quick check；检测到 HTWTable 或检查意图时自动收集 API 证据或运行 quick check；检测到普通开发、修改、修复任务时自动创建或复用 workflow/spec。",
    "`azi go \"<用户原话>\"` 是 `azi task` 的别名，文档默认只推荐 `azi task`。",
    "`azi workflow start <feature-name> --task \"<任务描述>\" --yes` 会创建或复用功能规格，并输出 Skill 匹配、必读文件和下一步。",
    "`azi workflow status` 会显示 `.harness/workflows/` 下所有功能的当前阶段、阻塞项和下一步。",
    "`azi workflow advance --target specs/<id-feature> --to <stage>` 会推进状态机，并同步 `.harness/workflows/*.json` 与 `specs/<id-feature>/workflow.md`。",
    "`azi workflow log --target specs/<id-feature>` 会查看阶段推进日志。",
    "`azi sdd status --target specs/<id-feature>` 会检查 REQ/TASK/ACC 追踪关系和实现前阻塞项。",
    "`azi sdd clarify|prd|issues|tasks|acceptance|retrospective --target specs/<id-feature> --write` 会在规格目录的 `sdd/` 下生成可审查辅助文档，不覆盖主规格。",
    "`azi figma <figma-node-url> --yes` 会自动识别 Figma URL、创建或复用 workflow 规格、缓存来源，并生成规格建议补丁。",
    "`azi figma <figma-node-url> --yes` 会用 fileKey + nodeId 优先命中 `.harness/figma-cache/`；成功写入来源时更新 `.harness/figma-cache/index.json`；缓存缺失才请求 Figma，遇到 429 写入 retriedAt 与 fallback。",
    "`azi figma spec --target specs/<id-feature> --url <figma-node-url> --write` 会缓存节点级 Figma 来源，并生成 screens.yaml / design.md 的建议补丁。",
    "`azi figma fallback --target specs/<id-feature> --source screenshot --reference <path> --write` 会记录 429 或无 Figma 时的降级来源。",
    "`azi figma status --target specs/<id-feature>` 会查看 `.harness/figma-cache/` 中的来源、重试和降级状态。",
    "`azi review --target specs/<id-feature> --ci` 是 CI/MR 守门员模式，隐含 diff/evidence，warning 也会阻塞；若依项目会检查未经证据确认的 API、权限、字典、请求封装和 HTWTable。",
    "`azi review --target specs/<id-feature> --full --diff --evidence --write` 会执行项目命令、对比规格范围、Git 变更和验收证据，并把报告写入 `.harness/reviews/`。",
    "`azi review --target specs/<id-feature> --suggest-patch` 只会把 acceptance.md 建议补丁写入 `.harness/proposals/`，不会修改业务文件。",
    "`azi doctor --write-proposals` 会把可人工审查的运行时修复补丁写入 `.harness/proposals/`。",
    "watch、fix 等长期运行或自动修复脚本不会被选为自动检查命令。"
  ].join("\n");
}

function createWorkflowDocument(): string {
  return [
    "# 开发工作流",
    "",
    "完整工作流状态保存在 `.harness/workflows/*.json`，人工可读记录保存在 `specs/<id-feature>/workflow.md`。",
    "",
    "## 状态机",
    "",
    "```text",
    "clarify -> plan -> prd -> issues -> coding -> test -> quality -> review -> commit",
    "```",
    "",
    "## 常用命令",
    "",
    "1. 优先运行 `npx azi task \"<用户原话>\"` 创建或复用功能规格，并写入工作流状态；需要人工指定 feature name / slug 时再使用 `npx azi workflow start <feature-name> --task \"<任务描述>\" --yes`。",
    "2. 运行 `npx azi workflow status` 查看所有进行中的功能。",
    "3. 完成当前阶段后运行 `npx azi workflow advance --target specs/<id-feature> --to <next-stage>`。",
    "4. 如需跳过阶段，必须使用 `--force --reason \"<人工确认原因>\"`，原因会写入日志。",
    "5. 运行 `npx azi workflow log --target specs/<id-feature>` 查看推进记录。",
    "6. 运行 `npx azi sdd status --target specs/<id-feature>` 检查需求、任务和验收追踪；使用 `azi sdd <phase> ... --write` 生成阶段辅助文档。",
    "",
    "## 阶段要求",
    "",
    "1. `clarify`：补齐 `requirements.md`，明确已确认事实和未知项；可生成 `sdd/clarify.md` 辅助澄清。",
    "2. `plan`：补齐 `tasks.md`，明确 TASK 到 REQ 的关联、涉及文件和验证命令。",
    "3. `prd`：沉淀需求、页面来源和验收条件，不编造接口、权限、字典或后端字段。",
    "4. `issues`：将任务拆为可审查切片，并能追踪到验收项。",
    "5. `coding`：按规格和项目规则实现，不能跳过未知项直接编码。",
    "6. `test`：补充 `acceptance.md`，让 ACC 关联 REQ，并记录真实检查结果和人工验收证据。",
    "7. `quality`：运行 `npx azi check`，没有执行的检查必须记录跳过原因。",
    "8. `review`：CI/MR 运行 `npx azi review --target specs/<id-feature> --ci`；人工交付记录可运行 `npx azi review --target specs/<id-feature> --full --diff --evidence --write`。",
    "9. `commit`：准备提交说明或 MR 文案，并可生成 `sdd/retrospective.md`；azi-harness 默认不自动提交、推送或创建 MR。",
    "",
    "不要从模糊需求直接跳到编码，也不要在项目内临时发明业务 Skill。"
  ].join("\n");
}

function createGitLabCiExample(): string {
  return [
    "# 将需要的 job 复制到 `.gitlab-ci.yml`，并把 image 替换为团队已验证的 Node 镜像。",
    "# 不同项目的 Node 版本可能不同，请以当前项目实际验证结果为准。",
    "# 如需在 CI 中生成交付 Review，设置变量 AZI_REVIEW_TARGET=specs/<id-feature>。",
    "",
    "stages:",
    "  - verify",
    "",
    "azi:doctor:",
    "  stage: verify",
    "  image: ${NODE_IMAGE}",
    "  script:",
    "    - npm ci",
    "    - npx azi doctor --json",
    "",
    "azi:specs:",
    "  stage: verify",
    "  image: ${NODE_IMAGE}",
    "  script:",
    "    - npm ci",
    "    - npx azi spec validate --json",
    "",
    "azi:check:",
    "  stage: verify",
    "  image: ${NODE_IMAGE}",
    "  script:",
    "    - npm ci",
    "    - npx azi check --json",
    "",
    "azi:review:",
    "  stage: verify",
    "  image: ${NODE_IMAGE}",
    "  script:",
    "    - npm ci",
    "    - |",
    "      if [ -n \"$AZI_REVIEW_TARGET\" ]; then",
    "        npx azi review --target \"$AZI_REVIEW_TARGET\" --ci",
    "      else",
    "        echo \"Skip azi review: set AZI_REVIEW_TARGET=specs/<id-feature> to enable it.\"",
    "      fi",
    "  artifacts:",
    "    when: always",
    "    paths:",
    "      - .harness/reviews/",
    "    expire_in: 7 days",
    ""
  ].join("\n");
}

function createAiToolsDocument(profile: ProjectProfile): string {
  const skillNames = createPreferredSkillSummary();

  return [
    "# AI 工具接入说明",
    "",
    "当前项目的 AI Coding 指令只有一套事实来源：",
    "",
    "1. `AGENTS.md`",
    "2. `.harness/project.json`",
    "3. `.harness/skill-map.json` 和 `.harness/skill-catalog.json`",
    "4. `.harness/rules/`",
    "5. `.harness/docs/skill-hub.md`",
    "6. `.agents/skills/README.md`",
    "7. `specs/`",
    "",
    "各 AI 工具专用入口必须保持很薄，只能指回以上文件，",
    "不要复制大段项目规则，避免多处规则互相冲突。",
    "项目内不再生成自写业务 SKILL.md，优先复用全局安装的外部 Skill、插件 Skill 或官方 Skill。",
    "",
    "## Codex",
    "",
    "- 入口：`AGENTS.md`。",
    "- 低指令启动：用户说“按 Figma 页面开发”“还原设计稿”或粘贴 Figma URL 时，先运行 `npx azi task \"<用户原话>\"`。",
    "- `azi task` 会自动判断 Figma URL、HTWTable、质量检查、workflow、Skill match、figma cache、similar pages 和 quick check；默认不 `--apply`。",
    "- 非 Figma 新功能、修改、修复也优先运行 `npx azi task \"<用户原话>\"`；已有规格任务可运行 `npx azi context \"<任务描述>\"`。",
    "- Skills：先用 `npx azi skill list/search/match` 浏览和匹配来源，再使用当前工具中已安装的匹配 Skill。",
    "- 交付前：运行 `npx azi check`；CI/MR 使用 `npx azi review --target specs/<id-feature> --ci`，人工留档可加 `--write`。",
    "",
    "## Cursor",
    "",
    "- 入口：`.cursor/rules/azi-harness.mdc`。",
    "- Cursor 规则只负责指回 `AGENTS.md` 和运行时文件。",
    "- 详细规则放在 `.harness/rules/`、`.harness/docs/skill-hub.md` 和规格中。",
    "",
    "## Antigravity IDE",
    "",
    "- 使用 `AGENTS.md` 作为项目启动说明。",
    "- 开始工作前要求 Agent 阅读 `.harness/docs/ai-tools.md`。",
    "- 需要 Skill 时优先调用全局外部 Skill 或插件 Skill，不在项目内复制一份 Skill 正文。",
    "",
    "## OpenCode and Harness",
    "",
    "- 使用 `AGENTS.md` 作为兜底入口。",
    "- 如果工具不能自动发现全局 Skill，请在对话中显式提到仓库名或 Skill 名称。",
    "",
    "## 当前项目",
    "",
    `- 项目类型：\`${profile.effective.projectType.value}\`。`,
    `- 推荐 Skill 来源：${skillNames}。`,
    profile.effective.ruoyi.value
      ? "- 若依约束来自 `.harness/rules/ruoyi.md`，不是项目自写 Skill。"
      : "- 若无适用外部 Skill，直接按项目规则和规格执行。",
    "- 禁止：读取或套用 `.windsurfrules`。"
  ].join("\n");
}

function createCursorRule(profile: ProjectProfile): string {
  const skillNames = createPreferredSkillSummary();

  return [
    "---",
    "description: AI 编码任务开始前使用 azi-harness 项目运行时",
    "alwaysApply: true",
    "---",
    "",
    "# azi-harness",
    "",
    "修改当前项目代码前：",
    "",
    "1. 阅读 `AGENTS.md`。",
    "2. 阅读 `.harness/project.json`。",
    "3. 阅读 `.harness/skill-map.json` 和 `.harness/skill-catalog.json`。",
    "4. 阅读 `.harness/rules/` 下适用的规则文件。",
    "5. 阅读 `.harness/docs/skill-hub.md` 和 `.agents/skills/README.md`。",
    "6. 阅读 `specs/` 下当前功能目录。",
    "7. 用户给出 Figma URL、说“按 Figma 页面开发”或“还原设计稿”时，先运行 `npx azi task \"<用户原话>\"`。",
    "8. 用户说“使用 HTWTable / 核对表格 API / 跑检查 / 自检”时，也先运行 `npx azi task \"<用户原话>\"`。",
    "9. 新功能、修改、修复等非 Figma 场景也优先运行 `npx azi task \"<用户原话>\"`；如只需 Skill 推荐，运行 `npx azi skill match \"<任务描述>\"`。",
    "",
    `识别到的项目类型：\`${profile.effective.projectType.value}\`。`,
    `推荐 Skill 来源：${skillNames}。`,
    "",
    "禁止读取或套用 `.windsurfrules`。",
    "禁止猜测接口、权限标识、字典类型或后端字段。",
    "若依项目的权限、字典、请求封装、分页、路由、菜单和 HTWTable 必须来自项目事实与相似页面。",
    "交付前运行 `npx azi check`；CI/MR 运行 `npx azi review --target specs/<id-feature> --ci`。"
  ].join("\n");
}

function createProjectConventions(profile: ProjectProfile): string {
  return [
    "# 项目约定",
    "",
    `- 项目类型：\`${profile.effective.projectType.value}\`。`,
    `- Vue 主版本：\`${profile.effective.framework.vueMajor.value ?? "unknown"}\`。`,
    `- UI 框架：\`${profile.effective.framework.ui.value ?? "unknown"}\`。`,
    "- 保留当前项目已有的请求、路由、反馈和下载能力。",
    "- 不混用 Vue 2 与 Vue 3 API。",
    "- 优先复用项目已有组件，不额外引入并行抽象。",
    "- 不建立跨项目样式体系或 Design Token 包。",
    "- 页面外观以 Figma 为准；没有 Figma 时，参考当前项目内同类页面。",
    "- 禁止扫描或套用 `.windsurfrules`。"
  ].join("\n");
}

function createRuoyiRules(profile: ProjectProfile): string {
  if (!profile.effective.ruoyi.value) {
    return [
      "# 若依规则",
      "",
      "当前项目未确认是若依项目。",
      "除非项目证据发生变化，否则不要引入若依专用 API。"
    ].join("\n");
  }

  return [
    "# 若依规则",
    "",
    "- 权限复用 `v-hasPermi` / `hasPermi`。",
    "- 字典能力存在时复用 `useDict` 和 `DictTag`。",
    "- 复用识别到的请求封装。",
    "- 保留动态路由和菜单约定。",
    "- 保留 `pageNum`、`pageSize`、`rows`、`total` 分页字段。",
    "- 复用项目已有弹窗、消息、下载和反馈能力。",
    "- 禁止编造接口路径、权限标识、字典类型或后端字段。",
    `- 当前是 Vue ${profile.effective.framework.vueMajor.value ?? "unknown"} 项目，不要混用 API。`
  ].join("\n");
}

function createHtwTableRules(profile: ProjectProfile): string {
  const htw = profile.effective.htwTable;
  return [
    "# HTWTable 规则",
    "",
    `- 是否安装：\`${htw.installed}\`。`,
    `- 包名：\`${htw.packageName ?? "unknown"}\`。`,
    `- 版本或来源：\`${htw.versionSpec ?? "unknown"}\`。`,
    `- 文档入口：${htw.documentationUrl}`,
    "- 普通 Vue3 后台列表优先评估 HTWTable。",
    "- 实现前必须确认当前已安装版本的公开 API。",
    "- 功能中使用 HTWTable 前运行 `npx azi htw inspect --write-doc`。",
    "- 若搜索项使用若依字典，必须确认当前 HTWTable 版本的字典加载方式；若内部 `dictType` 对异步字典是快照式读取，应通过 `setDictData` 或显式 `options` 同步字典，避免搜索下拉为空。",
    "- 改造后必须验证查询、重置、分页、选择、批量操作、导出和新增/编辑/删除后的刷新行为。",
    "- 禁止复制或修改 HTWTable 源码。",
    "- Vue2 项目不能使用 Vue3 HTWTable。",
    "- 树表、虚拟滚动、复杂合并单元格等场景可以例外。",
    "- 每个例外都必须在 `design.md` 中记录原因。"
  ].join("\n");
}

function createFigmaRules(): string {
  return [
    "# Figma 规则",
    "",
    "- Figma 输入默认先转成缓存、规格建议、实现上下文和候选补丁。",
    "- 官方 Figma Skill 只负责提取设计事实，不能推断接口、权限、字典或后端字段。",
    "- 使用节点级 URL，避免读取整个大型 Figma 文件。",
    "- 用户自然语言包含 Figma URL、按 Figma 页面开发、还原设计稿时，最简单入口是 `npx azi task \"<用户原话>\"`。",
    "- 直接工具入口是 `npx azi figma <figma-node-url> --yes`，由工具自动识别 URL、创建规格并缓存来源。",
    "- 相同 fileKey + nodeId 必须先读 `.harness/figma-cache/`；缓存命中时禁止重复请求 Figma API/MCP。",
    "- 优先读取 `.harness/figma-cache/index.json`，按 `cacheKey = fileKey:nodeId` 找已有缓存位置。",
    "- 设置 `FIGMA_TOKEN` 后，工具会优先读取 `.harness/figma-cache/`，缺失时才调用 Figma REST API 批量导出 SVG icon 到 `icons/`。",
    "- 使用 `npx azi figma spec --target specs/<id-feature> --url <figma-node-url> --write` 记录节点来源、缓存文件和规格建议补丁。",
    "- 只有用户明确允许 `--apply` 时，才可创建不存在的建议目标页面；已有业务页面禁止覆盖。",
    "- Figma MCP 429 或不可用时，使用 `npx azi figma fallback --target specs/<id-feature> --source <figma-export|screenshot|legacy-page> --reference <path> --retried-at <time> --write` 记录降级。",
    "- 将提取到的事实缓存到 `.harness/figma-cache/` 和规格建议补丁中，不要反复调用 Figma。",
    "- 缓存命中、缓存缺失、429、fallback 都必须在输出中说明；429 需要记录 retriedAt。",
    "- 遇到 429 时停止重试，尊重等待时间，并从检查点恢复。",
    "- 在 `screens.yaml` 的 source.status、source.retriedAt、source.fallback、source.notes 中记录 429 状态。",
    "- 如果仍无法访问，使用导出的 frame 或截图作为降级来源。",
    "- 禁止从像素图推断接口、权限、字典或后端字段。",
    "- 在 `screens.yaml` 中记录真实来源。"
  ].join("\n");
}

function createQualityRules(): string {
  return [
    "# 质量规则",
    "",
    "- 修改范围应限制在当前功能和项目既有边界内。",
    "- 交付前运行识别到的 lint、test、build 命令。",
    "- 缺失命令应记录为跳过并说明原因，不能当作通过。",
    "- 如果在 `.harness/config.json` 中禁用某个项目命令，必须记录原因。",
    "- 使用 `npx azi doctor --write-proposals` 生成可审查的运行时修复补丁。",
    "- 用真实执行结果更新 `tasks.md` 和 `acceptance.md`。",
    "- CI/MR 使用 `npx azi review --target specs/<id-feature> --ci` 阻断 error 和 warning；若依项目会阻断未经证据确认的 API、权限、字典、请求封装和 HTWTable 问题。",
    "- 交付前可使用 `npx azi review --target specs/<id-feature> --full --diff --evidence --write` 生成审查报告。",
    "- `--suggest-patch` 只生成 `.harness/proposals/` 下的统一 diff，必须人工复核，不自动应用。",
    "- 没有实际执行的检查，不能声称已通过。",
    "- 权限、破坏性操作和共享代码必须经过人工 Review。"
  ].join("\n");
}

function createSpecsReadme(): string {
  return [
    "# 功能规格",
    "",
    "每个功能使用一个带编号的目录：",
    "",
    "```text",
    "specs/001-feature-name/",
    "├── requirements.md",
    "├── design.md",
    "├── screens.yaml",
    "├── tasks.md",
    "├── acceptance.md",
    "├── workflow.md",
    "├── sdd/                  # azi sdd --write 生成的辅助文档",
    "└── evidence/",
    "```",
    "",
    "使用 `npx azi task \"<用户原话>\"` 启动新功能、修改或修复工作流；需要人工指定 feature name / slug 时再使用 `npx azi workflow start <feature-name> --task \"<任务描述>\" --yes`。它会同时创建 `.harness/workflows/*.json`、`workflow.md` 和 `evidence/`。",
    "只需要空规格时可使用 `npx azi spec create <feature-name>`，但它不会创建完整工作流状态。",
    "`requirements.md`、`tasks.md`、`acceptance.md` 分别使用 `REQ-###`、`TASK-###`、`ACC-###` 建立追踪关系。",
    "运行 `npx azi sdd status --target specs/<id-feature>` 检查追踪完整性；其他 `azi sdd` 阶段命令默认只预览，加 `--write` 后写入 `sdd/`，遇到已有不同内容会报告冲突而不是覆盖。"
  ].join("\n");
}

function createSkillMap(profile: ProjectProfile): Record<string, unknown> {
  return {
    schemaVersion: "1",
    projectType: profile.effective.projectType.value,
    defaults: {
      preferInstalledSkills: true,
      copyExternalSkillBodiesIntoProject: false,
      ignoreWindsurfRules: true,
      requireSpecsBeforeImplementation: true
    },
    sources: [
      {
        id: "obra/superpowers",
        category: "workflow",
        install: {
          codex: "按仓库说明通过 Codex 插件市场安装",
          antigravity: "按仓库说明安装 GitHub 插件",
          cursor: "按仓库自己的安装文档接入"
        },
        matchWhenAny: [
          "复杂功能开发",
          "需求澄清到实现的长链路任务",
          "多人协作",
          "需要计划、评审、提交闭环"
        ],
        avoidWhenAny: [
          "极小改动",
          "单文件热修",
          "纯 HTWTable API 核对"
        ]
      },
      {
        id: "figma-family",
        category: "design",
        preferredSkills: [
          "figma",
          "figma-use",
          "figma-implement-design",
          "playwright",
          "screenshot",
          "openai-docs"
        ],
        matchWhenAny: [
          "Figma 节点转规格",
          "页面还原",
          "设计事实提取",
          "视觉验收"
        ],
        avoidWhenAny: [
          "沿用项目同类页面",
          "纯后端接口任务"
        ],
        constraints: [
          "先生成缓存、规格建议、实现上下文和候选补丁",
          "不能猜接口、权限、字典或后端字段",
          "遇到 Figma 429 必须记录并降级"
        ]
      },
      {
        id: "greensock/gsap-skills",
        category: "animation",
        install: {
          general: "npx skills add https://github.com/greensock/gsap-skills"
        },
        matchWhenAny: [
          "项目依赖 gsap",
          "时间线动画",
          "ScrollTrigger",
          "滚动联动",
          "页面过渡动画"
        ],
        avoidWhenAny: [
          "普通后台 CRUD",
          "静态表单页面",
          "纯样式微调"
        ]
      },
      {
        id: "phuryn/pm-skills",
        category: "product",
        install: {
          codex: "按仓库说明通过 Codex 插件市场和插件组安装"
        },
        matchWhenAny: [
          "需求澄清",
          "PRD",
          "产品发现",
          "优先级排序",
          "发布计划",
          "GTM"
        ],
        avoidWhenAny: [
          "普通页面编码",
          "单个表格字段调整",
          "纯前端修 bug"
        ]
      },
      {
        id: "YuJunZhiXue/github-skill-forge",
        category: "meta-skill",
        matchWhenAny: [
          "把 GitHub 仓库转成技能或上下文包",
          "沉淀外部仓库知识",
          "为团队生成新的索引型 skill"
        ],
        avoidWhenAny: [
          "普通业务页面开发",
          "若依 CRUD 改造",
          "单纯读取项目本地代码"
        ]
      }
    ],
    projectSpecific: {
      ruoyi: profile.effective.ruoyi.value
        ? {
            useProjectRules: true,
            fallback: [
              "没有通用 ruoyi skill 时，直接遵守 .harness/rules/ruoyi.md",
              "接口、权限、字典以当前仓库证据和 specs 为准"
            ]
          }
        : {
            useProjectRules: false,
            fallback: [
              "当前项目不需要若依专用 skill"
            ]
          },
      htwTable: {
        inspectBeforeUse: true,
        documentSource: profile.effective.htwTable.documentationUrl,
        fallback: [
          "先运行 npx azi htw inspect --write-doc",
          "以目标项目实际安装版本的公开 API 为准"
        ]
      }
    }
  };
}

function createSkillCatalog(profile: ProjectProfile): Record<string, unknown> {
  return {
    schemaVersion: "1",
    projectType: profile.effective.projectType.value,
    installationStatusPolicy: "not-verified-by-project-runtime",
    tools: ["codex", "cursor", "antigravity", "opencode", "harness"],
    sources: [
      {
        id: "obra/superpowers",
        displayName: "Superpowers",
        sourceUrl: "https://github.com/obra/superpowers",
        category: "workflow",
        description: "面向复杂开发任务的澄清、计划、实现、测试和评审工作流。",
        enabled: true,
        preferredSkills: ["obra/superpowers"],
        recommendedScenarios: [
          "复杂功能开发",
          "需求澄清到实现的长链路任务",
          "多人协作",
          "需要计划、评审、提交闭环"
        ],
        avoidScenarios: ["极小改动", "单文件热修", "纯 HTWTable API 核对"],
        constraints: ["仍须遵守项目规则和 specs", "不能自动提交或绕过人工 Review"],
        tools: createToolMatrix({
          codex: "按仓库说明通过 Codex 插件市场安装",
          cursor: "按仓库自己的 Cursor 安装说明接入",
          antigravity: "按仓库说明安装 GitHub 插件",
          opencode: "按仓库文档确认当前 OpenCode 接入方式",
          harness: "作为工作流来源索引使用，并遵守项目内规则"
        }),
        installation: createInstallation("manual", true, true, true)
      },
      {
        id: "figma-family",
        displayName: "Figma 官方 Skill 与 MCP 组合",
        sourceUrl: "https://developers.figma.com/docs/figma-mcp-server/",
        category: "design",
        description: "提取 Figma 设计事实、生成规格，并在规格确认后辅助页面实现和视觉验收。",
        enabled: true,
        preferredSkills: [
          "figma",
          "figma-use",
          "figma-implement-design",
          "playwright",
          "screenshot",
          "openai-docs"
        ],
        recommendedScenarios: ["Figma 节点转规格", "页面还原", "设计事实提取", "视觉验收"],
        avoidScenarios: ["沿用项目同类页面", "纯后端接口任务"],
        constraints: [
          "先生成缓存、规格建议、实现上下文和候选补丁",
          "不能猜接口、权限、字典或后端字段",
          "遇到 Figma 429 必须记录并降级"
        ],
        tools: createToolMatrix({
          codex: "优先使用 Codex Figma 插件提供的官方 Skill 与 MCP",
          cursor: "需要在 Cursor 中配置可用的 Figma MCP 或等价官方接入",
          antigravity: "需要在 Antigravity 中配置可用的 Figma MCP",
          opencode: "需要在 OpenCode 中配置可用的 Figma MCP",
          harness: "使用 Harness 环境中已配置的 Figma MCP"
        }),
        installation: createInstallation("built-in-or-plugin", false, true, true)
      },
      {
        id: "greensock/gsap-skills",
        displayName: "GSAP Skills",
        sourceUrl: "https://github.com/greensock/gsap-skills",
        category: "animation",
        description: "处理 GSAP 时间线、ScrollTrigger、滚动联动和页面过渡动画。",
        enabled: true,
        preferredSkills: ["greensock/gsap-skills"],
        recommendedScenarios: ["项目依赖 gsap", "时间线动画", "ScrollTrigger", "滚动联动", "页面过渡动画"],
        avoidScenarios: ["普通后台 CRUD", "静态表单页面", "纯样式微调"],
        constraints: ["确认项目确实需要动效后再调用", "不能替代 Figma 规格和项目组件规则"],
        tools: createToolMatrix({
          codex: "按仓库说明使用 npx skills add 安装",
          cursor: "按仓库说明使用 npx skills add 安装",
          antigravity: "按仓库说明确认 skills 安装目录",
          opencode: "按仓库说明确认 skills 安装目录",
          harness: "作为外部 Skill 来源索引使用"
        }),
        installation: createInstallation("manual", true, true, true)
      },
      {
        id: "phuryn/pm-skills",
        displayName: "PM Skills",
        sourceUrl: "https://github.com/phuryn/pm-skills",
        category: "product",
        description: "用于需求澄清、PRD、产品发现、优先级、发布计划和 GTM。",
        enabled: true,
        preferredSkills: ["phuryn/pm-skills"],
        recommendedScenarios: ["需求澄清", "PRD", "产品发现", "优先级排序", "发布计划", "GTM"],
        avoidScenarios: ["普通页面编码", "单个表格字段调整", "纯前端修 bug"],
        constraints: ["产品输出必须进入 specs 或团队文档", "不能用产品模板猜测技术事实"],
        tools: createToolMatrix({
          codex: "按仓库说明通过 Codex 插件市场和插件组安装",
          cursor: "按仓库文档确认可用 Skill 的安装方式",
          antigravity: "按仓库文档确认可用 Skill 的安装方式",
          opencode: "按仓库文档确认可用 Skill 的安装方式",
          harness: "作为产品工作流来源索引使用"
        }),
        installation: createInstallation("manual", true, true, true)
      },
      {
        id: "YuJunZhiXue/github-skill-forge",
        displayName: "GitHub Skill Forge",
        sourceUrl: "https://github.com/YuJunZhiXue/github-skill-forge",
        category: "meta-skill",
        description: "把外部 GitHub 仓库整理为可复用技能或上下文索引的元技能来源。",
        enabled: true,
        preferredSkills: ["YuJunZhiXue/github-skill-forge"],
        recommendedScenarios: ["把 GitHub 仓库转成技能或上下文包", "沉淀外部仓库知识", "为团队生成新的索引型 skill"],
        avoidScenarios: ["普通业务页面开发", "若依 CRUD 改造", "单纯读取项目本地代码"],
        constraints: ["不能把外部 Skill 正文复制进业务项目", "生成结果必须保留来源和许可证信息"],
        tools: createToolMatrix({
          codex: "按源仓库文档人工安装或调用",
          cursor: "按源仓库文档人工安装或调用",
          antigravity: "按源仓库文档人工安装或调用",
          opencode: "按源仓库文档人工安装或调用",
          harness: "仅作为可选元技能来源索引"
        }),
        installation: createInstallation("source-index", true, true, true)
      }
    ]
  };
}

function createToolMatrix(
  hints: Record<"codex" | "cursor" | "antigravity" | "opencode" | "harness", string>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(hints).map(([tool, installHint]) => [
      tool,
      {
        supported: true,
        status: "not-verified",
        installHint
      }
    ])
  );
}

function createInstallation(
  mode: "manual" | "built-in-or-plugin" | "source-index",
  manualInstallRequired: boolean,
  globallyReusable: boolean,
  indexOnly: boolean
): Record<string, unknown> {
  return {
    mode,
    manualInstallRequired,
    globallyReusable,
    indexOnly,
    projectCopiesSkillBody: false
  };
}

function createSkillHubDocument(profile: ProjectProfile): string {
  return [
    "# Skill Hub",
    "",
    `当前项目类型：\`${profile.effective.projectType.value}\`。`,
    "本页是团队人工审查入口；机器可读目录在 `.harness/skill-catalog.json`，任务匹配规则在 `.harness/skill-map.json`。",
    "项目运行时不能读取各 AI 工具的全局安装目录，因此所有安装状态默认显示为“未验证”，不能据此声称某个 Skill 已安装。",
    "",
    "## 常用命令",
    "",
    "- `npx azi skill list`：查看完整目录。",
    "- `npx azi skill search figma`：按名称、分类、场景或工具搜索。",
    "- `npx azi skill match \"根据 Figma 节点还原页面\"`：解释任务匹配和回避原因。",
    "- `npx azi skill doctor`：校验目录与匹配表的一致性。",
    "- `npx azi skill sources --json`：输出可供其他工具消费的来源列表。",
    "- `npx azi skill install-guide obra/superpowers`：查看各 AI 工具的安装提示。",
    "",
    "## 当前目录",
    "",
    "| 来源 | 分类 | 推荐场景 | 回避场景 | 适配工具 | 安装策略 |",
    "| --- | --- | --- | --- | --- | --- |",
    "| `obra/superpowers` | 工作流 | 复杂功能、长链路开发 | 极小改动、单文件热修 | Codex、Cursor、Antigravity、OpenCode、Harness | 人工安装，项目只保留索引 |",
    "| `figma-family` | 设计 | Figma 转规格、页面还原、视觉验收 | 沿用同类页面、纯后端任务 | Codex、Cursor、Antigravity、OpenCode、Harness | 使用官方 Skill + MCP，先进入规格 |",
    "| `greensock/gsap-skills` | 动效 | GSAP、ScrollTrigger、时间线 | 普通 CRUD、静态表单 | Codex、Cursor、Antigravity、OpenCode、Harness | 人工安装，按需调用 |",
    "| `phuryn/pm-skills` | 产品 | 澄清、PRD、优先级、发布 | 普通编码、字段调整 | Codex、Cursor、Antigravity、OpenCode、Harness | 人工安装，按需调用 |",
    "| `YuJunZhiXue/github-skill-forge` | 元技能 | 外部仓库转上下文或索引 | 业务页面、若依 CRUD | Codex、Cursor、Antigravity、OpenCode、Harness | 可选来源索引 |",
    "",
    "## 固定边界",
    "",
    "- 项目内不复制外部 Skill 正文，只保存来源、匹配条件、安装提示和项目约束。",
    "- 普通 CRUD 不调用 GSAP、PM 或元技能来源。",
    "- Figma 任务先生成或补全 `specs/`，不能猜接口、权限、字典和后端字段。",
    "- 长链路任务优先提示 `obra/superpowers`，但仍受当前工作流状态和人工 Review 约束。",
    "- 未匹配到来源时，直接回退到 `.harness/rules/` 与 `specs/`。"
  ].join("\n");
}

function createSkillSourcesDocument(profile: ProjectProfile): string {
  const ruoyiNote = profile.effective.ruoyi.value
    ? "- 若依项目没有通用 `ruoyi-*` 外部 Skill 时，直接遵守 `.harness/rules/ruoyi.md` 和当前功能规格。"
    : "- 当前项目不需要若依专用 Skill。";

  return [
    "# Skill 来源与匹配",
    "",
    "本项目不再生成自写业务 `SKILL.md`。",
    "机器可读的匹配表在 `.harness/skill-map.json`，",
    "可审查目录在 `.harness/skill-catalog.json`，中文入口在 `.harness/docs/skill-hub.md`。",
    "使用 `azi skill list/search/match/doctor/sources/install-guide` 浏览、匹配和校验来源。",
    "`azi context \"<任务描述>\"` 会把项目画像、Skill 匹配、必读文件、当前规则和检查命令合成启动上下文。",
    "优先使用 AI 工具环境中已安装的外部 Skill、插件 Skill 或官方 Skill，",
    "同时遵守 `.harness/rules/`、`.harness/docs/` 和 `specs/`。",
    "",
    "## 核心工作流",
    "",
    "- `obra/superpowers`：复杂功能从澄清、规格、计划到实现、评审的长链路工作流。适合大任务、多人协作、连续多阶段开发。",
    "- Codex App / Codex CLI：优先通过插件市场安装 `Superpowers`。",
    "- Antigravity：按仓库说明直接安装 `https://github.com/obra/superpowers` 插件。",
    "",
    "## 设计与页面实现",
    "",
    "- `figma`：处理 Figma 相关任务的总入口。",
    "- `figma-use`：读取节点、组件、页面结构等设计事实。",
    "- `figma-implement-design`：在规格和项目约束明确后落地页面实现。",
    "- `playwright`：页面联调、交互验证和浏览器验收。",
    "- `screenshot`：截图、视觉复核和差异确认。",
    "- `openai-docs`：查询 Codex / OpenAI 官方文档；通常为系统内置。",
    "- `greensock/gsap-skills`：当任务涉及动效、时间线、ScrollTrigger、页面滚动动画，或项目依赖 `gsap` 时优先匹配。",
    "",
    "## 产品与规格工作流",
    "",
    "- `phuryn/pm-skills`：适合需求澄清、PRD、产品发现、优先级、GTM、发布计划等任务。",
    "- 在 Codex CLI 中，按其仓库说明优先安装整组插件，而不是只抠单个技能。",
    "- 如果当前环境已内置同名 PM 技能，优先直接使用内置版本。",
    "",
    "## 外部仓库转技能",
    "",
    "- `YuJunZhiXue/github-skill-forge`：当用户给出一个 GitHub 仓库，希望把它转成可复用技能或上下文包时使用。",
    "- 这是一个元技能来源，不是普通业务页面开发的默认依赖。",
    "",
    "## 在当前项目中的分工",
    "",
    ruoyiNote,
    "- HTWTable 方案由 `.harness/rules/htw-table.md` 和 `.harness/docs/htw-table-api.md` 决定。",
    "- Figma 默认先进入缓存、规格建议、实现上下文和候选补丁；不能跳过项目事实直接猜业务页面。",
    "- 动效需求才匹配 `greensock/gsap-skills`，普通后台 CRUD 不默认引入。",
    "- 产品规划、PRD、发现类任务才匹配 `pm-skills`，普通编码实现不默认依赖它。",
    "- 没有适用外部 Skill 时，直接按项目规则和功能规格工作，不在项目里临时发明 Skill。",
    "",
    "## 安装原则",
    "",
    "- `obra/superpowers` 按仓库自己的 Codex / Antigravity / Cursor 安装说明使用。",
    "- `greensock/gsap-skills` 按仓库说明可通过 `npx skills add https://github.com/greensock/gsap-skills` 安装。",
    "- `phuryn/pm-skills` 按仓库说明通过 Codex 插件市场和插件组安装。",
    "- `github-skill-forge` 更适合作为可选元技能来源，不强制团队全员默认安装。",
    "- 项目内只保留索引或补充说明，不复制这些仓库的 Skill 正文。",
    "- 团队若需要本地补充，只允许新增极薄的索引文件，指向外部 Skill 和项目规则。"
  ].join("\n");
}

function createSkillIndexDocument(profile: ProjectProfile): string {
  return [
    "# Skills 索引",
    "",
    "本目录默认不存放自写业务 `SKILL.md`。",
    "请先阅读 `.harness/skill-map.json`、`.harness/skill-catalog.json` 和 `.harness/docs/skill-hub.md`，",
    "再优先调用当前 AI 工具环境中已安装的匹配 Skill。",
    "可用 `npx azi context \"<任务描述>\"` 获取完整 AI 启动上下文；只看 Skill 推荐时运行 `npx azi skill match \"<任务描述>\"`。",
    "",
    "## 当前项目建议",
    "",
    `- 推荐 Skill 来源：${createPreferredSkillSummary()}。`,
    profile.effective.ruoyi.value
      ? "- 若依约束来自 `.harness/rules/ruoyi.md`，不是项目自写 Skill。"
      : "- 当前项目以通用外部 Skill + 项目规则为主。",
    "- 大功能或长链路开发优先考虑 `obra/superpowers`。",
    "- 动效、滚动和时间线任务优先考虑 `greensock/gsap-skills`。",
    "- PRD、发现、优先级和发布类任务优先考虑 `phuryn/pm-skills`。",
    "- 引入外部 GitHub 仓库知识时，可考虑 `github-skill-forge`。",
    "- 如果需要团队补充说明，可以在本目录新增 README 或索引文件。",
    "- 不要在这里复制外部 Skill 正文，也不要为了单个项目重写一份业务 Skill。"
  ].join("\n");
}

function createPreferredSkillSummary(): string {
  return "`obra/superpowers`、`figma` 系列、`greensock/gsap-skills`、`phuryn/pm-skills`、`YuJunZhiXue/github-skill-forge`";
}

function formatCommandSection(title: string, commands: string[]): string {
  if (commands.length === 0) {
    return `## ${title}\n\n未识别到命令。`;
  }
  return [
    `## ${title}`,
    "",
    ...commands.map((command) => `- \`npm run ${command}\``)
  ].join("\n");
}

function managed(path: string, content: string): RuntimeFileIntent {
  return {
    path,
    content,
    ownership: "managed",
    templateVersion: TEMPLATE_VERSION
  };
}

function seeded(path: string, content: string): RuntimeFileIntent {
  return {
    path,
    content,
    ownership: "seeded",
    templateVersion: TEMPLATE_VERSION
  };
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
