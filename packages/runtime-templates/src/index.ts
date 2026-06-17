import {
  sha256,
  type ProjectProfile,
  type RuntimeFileIntent,
  type RuntimeManifest
} from "@azi-harness/core";

export const RUNTIME_VERSION = "0.1.0-dev";
const TEMPLATE_VERSION = "4";

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
    managed(".harness/docs/overview.md", createOverview(profile)),
    managed(".harness/docs/project-profile.md", createProjectProfileDocument(profile)),
    managed(".harness/docs/commands.md", createCommandsDocument(profile)),
    managed(".harness/docs/workflow.md", createWorkflowDocument()),
    managed(".harness/docs/ai-tools.md", createAiToolsDocument(profile)),
    managed(".harness/docs/skill-sources.md", createSkillSourcesDocument(profile)),
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
    "3. 阅读 `.agents/skills/README.md`、`.harness/skill-map.json` 和 `.harness/docs/skill-sources.md`。",
    "4. 根据任务类型匹配已安装的外部 Skill；没有时只按规则和规格执行。",
    "",
    `识别到的项目类型：\`${profile.effective.projectType.value}\`。`,
    `推荐 Skill 来源：${skillNames}。`,
    profile.effective.ruoyi.value
      ? "若依约束以 `.harness/rules/ruoyi.md` 和功能规格为准，不依赖项目自写 Skill。"
      : "项目内不内置自写业务 Skill，避免与全局外部 Skill 重复。",
    "",
    "禁止读取或套用 `.windsurfrules`。",
    "禁止猜测接口、权限标识、字典类型或后端字段。",
    "交付前运行 `npx azi check`。"
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
          reason: null
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
    "2. `.harness/skill-map.json`",
    "3. `.harness/rules/` 和 `.harness/docs/skill-sources.md`",
    "4. `specs/` 下当前功能目录",
    "5. `.agents/skills/README.md`",
    "",
    "项目事实必须来自当前仓库的证据。证据缺失或互相冲突时，",
    "应记录未知项并向人工确认，不得猜测。"
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
    "`azi check` 会分别执行已配置的 lint、test、build 脚本一次。",
    "`azi check --quick` 会跳过项目命令，只保留运行时、规格和规则检查。",
    "`azi doctor --write-proposals` 会把可人工审查的运行时修复补丁写入 `.harness/proposals/`。",
    "watch、fix 等长期运行或自动修复脚本不会被选为自动检查命令。"
  ].join("\n");
}

function createWorkflowDocument(): string {
  return [
    "# 开发工作流",
    "",
    "1. 在 `specs/` 下创建或选择一个功能目录。",
    "2. 补齐需求，并明确未知的业务事实。",
    "3. 将 Figma 节点、导出图、截图或同项目参考页整理成页面规格。",
    "4. 实现前先校验规格。",
    "5. 先参考 `.harness/skill-map.json` 匹配已安装的 Skill；若没有，则直接按规则和规格实现。",
    "6. 运行 `npx azi check`。",
    "7. 补充 `acceptance.md`，并进行人工 Review。",
    "8. 如果项目使用 GitLab CI，应在 CI 中复用相同检查。",
    "",
    "不要从模糊需求直接跳到编码，也不要在项目内临时发明业务 Skill。"
  ].join("\n");
}

function createGitLabCiExample(): string {
  return [
    "# 将需要的 job 复制到 `.gitlab-ci.yml`，并把 image 替换为团队已验证的 Node 镜像。",
    "# 不同项目的 Node 版本可能不同，请以当前项目实际验证结果为准。",
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
    "3. `.harness/skill-map.json`",
    "4. `.harness/rules/`",
    "5. `.harness/docs/skill-sources.md`",
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
    "- Skills：优先使用已安装的匹配 Skill，并先阅读 `.agents/skills/README.md`。",
    "- 交付前：运行 `npx azi check`。",
    "",
    "## Cursor",
    "",
    "- 入口：`.cursor/rules/azi-harness.mdc`。",
    "- Cursor 规则只负责指回 `AGENTS.md` 和运行时文件。",
    "- 详细规则放在 `.harness/rules/`、`.harness/docs/skill-sources.md` 和规格中。",
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
    "3. 阅读 `.harness/skill-map.json`。",
    "4. 阅读 `.harness/rules/` 下适用的规则文件。",
    "5. 阅读 `.harness/docs/skill-sources.md` 和 `.agents/skills/README.md`。",
    "6. 阅读 `specs/` 下当前功能目录。",
    "7. 优先使用已安装的匹配 Skill。",
    "",
    `识别到的项目类型：\`${profile.effective.projectType.value}\`。`,
    `推荐 Skill 来源：${skillNames}。`,
    "",
    "禁止读取或套用 `.windsurfrules`。",
    "禁止猜测接口、权限标识、字典类型或后端字段。",
    "交付前运行 `npx azi check`。"
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
    "- Figma 输入必须先转成功能规格。",
    "- 官方 Figma Skill 只负责提取设计事实，不能绕过规格直接写业务页面。",
    "- 使用节点级 URL，避免读取整个大型 Figma 文件。",
    "- 将提取到的事实缓存到规格中，不要反复调用 Figma。",
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
    "└── acceptance.md",
    "```",
    "",
    "使用 `npx azi spec create <feature-name>` 创建新功能规格。"
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
        constraints: [
          "先写 specs，再写页面",
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

function createSkillSourcesDocument(profile: ProjectProfile): string {
  const ruoyiNote = profile.effective.ruoyi.value
    ? "- 若依项目没有通用 `ruoyi-*` 外部 Skill 时，直接遵守 `.harness/rules/ruoyi.md` 和当前功能规格。"
    : "- 当前项目不需要若依专用 Skill。";

  return [
    "# Skill 来源与匹配",
    "",
    "本项目不再生成自写业务 `SKILL.md`。",
    "机器可读的匹配表在 `.harness/skill-map.json`，",
    "供 AI 先判断“该用哪类 Skill、什么时候不该用”。",
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
    "- Figma 只能先进入 `specs/`，不能直接跳过规格进入业务页面。",
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
    "请先阅读 `.harness/skill-map.json` 和 `.harness/docs/skill-sources.md`，",
    "再优先调用当前 AI 工具环境中已安装的匹配 Skill。",
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
