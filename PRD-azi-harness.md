# azi-harness 产品与开发计划

> 状态：规划草案  
> 适用范围：首个可用版本（V1）  
> 团队规模：2 人  
> 当前阶段：只定义产品、协议和实施计划，不进入编码

## 1. 摘要

azi-harness 是一套面向前端团队的 AI 开发运行时体系。它通过项目识别、统一规则、AI Skills、功能规格和自动检查，让 Cursor、OpenCode、Codex、Antigravity IDE 以及 Harness 在同一个项目中使用同一份项目事实和开发流程。

CLI 或 PowerShell 只是接入和维护入口，不是产品本身。产品真正交付的是随项目版本化的 `.harness/`、`.agents/skills/`、`AGENTS.md`、`specs/`，以及围绕这些文件运行的识别、校验和验收能力。

用户可以把它理解为“通过 npm 安装到前端项目中的 AI Coding 约束与工作流运行时”。但它不是向所有 AI 全局注入能力的插件，也不能保证每个 AI 客户端都会自动调用 Skill。azi-harness 负责安装统一事实、规则、Skills 和适配入口；支持自动发现的客户端可以自动读取或选择 Skill，不支持的客户端通过薄入口或显式命令触发。

## 2. 背景与问题

### 2.1 团队现状

- 2 名前端开发。
- 约 5 个 Web 项目，主要是若依 Vue2 / Vue3。
- 约 3 个移动端项目，使用 uniapp。
- 使用企业内网 GitLab。
- 有 Figma 和现成组件库。
- 后续 Web 开发以既有若依项目二次开发为主。
- 团队会混合使用多个 AI 编辑器和 Agent。

### 2.2 当前核心问题

1. 不同 AI 工具对同一个项目形成不同理解。
2. AI 容易忽略若依已有能力，重复实现权限、字典、请求、弹窗、下载等功能。
3. Vue2、Vue3 和 uniapp 的技术边界容易被混用。
4. 需求、设计、实现和验收之间缺少可追踪的中间规格。
5. Figma 页面还原容易直接跳到编码，接口、权限和状态被猜测。
6. 团队缺少统一的 AI 任务入口和交付前检查方式。
7. 老项目约定很多，但不适合每次让 AI 全量扫描后临时总结。

### 2.3 借鉴参考图的部分

azi-harness 借鉴参考图的信息架构和方法，不复制其产品内容：

- SDD 优先：先形成规格，再进入实现。
- 编辑器无关：项目规则不绑定某一个 AI 工具。
- 模块分离：入口、文档、规则、Skills、规格各自负责单一职责。
- 人机协作：关键事实不明确时必须停下确认，不能由 AI 猜测。
- 完整闭环：需求、规划、实现、检查、验收、Review 能够相互追踪。

### 2.4 责任与决策

| 角色 | 责任 |
|---|---|
| 产品负责人 | 确认范围、优先级、试点项目和验收结果 |
| 技术负责人 | 确认协议、技术选型、识别规则和发布方式 |
| 两名前端开发 | 共同实现、交叉 Review，并分别验证 Vue2/Vue3 试点 |

具体人名在项目正式启动时补充。影响文件协议、覆盖策略和 V1 范围的变更，必须由两人共同确认。

## 3. 产品目标

### 3.1 总目标

建立一套可安全接入既有前端项目、可在 Git 中版本化、可被多种 AI 工具共同使用的团队级开发运行时。

### 3.2 首版成功标准

- 能正确识别约定范围内的 6 类项目。
- 能生成简短且稳定的 `AGENTS.md` 入口。
- 能生成并维护 `.harness/` 和 `.agents/skills/`。
- 能创建和校验统一的功能规格目录。
- 能确保初始化和同步过程不静默覆盖用户文件。
- 能通过证据说明项目类型、若依能力和 HTWTable 来源。
- 能在 Vue2 与 Vue3 项目中生成不同的规则，不混用 API。
- 能让官方 Figma Skill 只生成规格事实，不直接修改业务页面。
- 能对运行时结构、规格完整性和关键项目约定执行自动检查。
- 至少在一个 Vue2 若依项目和一个 Vue3 若依项目中完成试点。
- 至少在一个 uniapp 项目中完成识别和基础接入试点。

### 3.3 建议度量

- 项目类型识别准确率达到 100%（以首批试点项目为样本）。
- 重复执行初始化后，未修改文件保持零变更。
- 已有文件静默覆盖次数为 0。
- 首版规格校验规则覆盖率达到 90% 以上。
- 试点功能中，AI 错用 Vue 版本 API、重复实现若依公共能力的阻断率达到 100%。
- 每个试点功能都能从规格追踪到任务和验收结果。

## 4. 用户与使用场景

### 4.1 主要用户

- 前端开发：接入项目、建立规格、让 AI 实现和自检。
- 代码审查者：根据规格、规则和检查结果审查改动。
- AI Agent：读取项目事实，执行限定范围内的任务。

### 4.2 主要场景

1. 将 azi-harness 接入一个现有若依 Vue2 项目。
2. 将 azi-harness 接入一个现有若依 Vue3 项目。
3. 为新功能创建标准规格目录。
4. 从指定 Figma 节点生成页面规格。
5. 根据规格完成若依 CRUD 页面开发。
6. 对已有功能做局部修改，避免 AI 越权重构。
7. 在提交或合并请求前执行统一检查。
8. 在项目升级依赖后重新识别项目能力。

### 4.3 预期安装体验

首版采用项目本地开发依赖，不要求全局安装：

```bash
npm install --save-dev azi-harness
npx azi init
```

安装后：

1. `azi init` 识别当前项目。
2. 用户预览并确认将创建的运行时文件。
3. 生成 `.harness/`、`.agents/skills/`、简短的 `AGENTS.md` 和必要的 AI 工具薄入口。
4. 生成的运行时文件进入业务项目 Git。
5. 后续与 AI 沟通时，Agent 先读取项目事实和规则，再决定是否调用 Skill。
6. 升级 npm 包后通过 `npx azi sync` 安全同步模板。
7. 提交前通过 `npx azi check` 执行规格、规则和项目命令检查。

安装后的行为边界：

- azi-harness 能让 AI 知道“普通 Vue3 后台列表必须优先评估 HTWTable”。
- 当当前版本 API 已确认且页面场景适配时，AI 应使用 HTWTable。
- 当版本、API 或场景不适配时，AI 必须说明例外，不能盲目使用。
- Skill 是否自动触发取决于客户端能力和 Skill 描述；所有核心流程同时支持显式触发。
- 安装运行时不会自动修改现有业务页面，也不会自动安装或升级业务组件。

## 5. 产品原则

### 5.1 项目事实优先

目标项目的实际代码、依赖和公开 API 是最高事实来源。通用经验不能覆盖项目已有约定。

### 5.2 规格先于实现

功能开始实现前，应先有最小可用规格。规格不完整时，AI 应记录未知项并请求确认。

### 5.3 单一事实，多端读取

详细规则只在 `.harness/`、`.agents/skills/` 和 `specs/` 中维护。各 AI 工具的入口只引用这些文件，不复制完整内容。

### 5.4 证据驱动识别

每个识别结论必须包含来源文件、依赖版本或代码特征。无法确认时标记为 `unknown`，不能猜测。

### 5.5 安全重复执行

所有生成和同步操作必须可预览、可重复、可检测冲突，不静默覆盖用户改动。

### 5.6 适配项目，不改造项目

首版只建立 AI 开发运行时，不借机重构老项目、替换技术栈或建设跨项目样式体系。

## 6. 明确不做

首版及当前产品方向不包含：

- 页面代码生成器。
- 单一 AI 编辑器专用方案。
- 历史 Harness 项目扫描、迁移或复用。
- `.windsurfrules` 扫描、迁移、解释或执行。
- 旧 Sanshu MCP 规则接入。
- 历史项目公共样式抽取。
- 行业风格模板包。
- 跨项目通用样式体系。
- Design Token 包。
- CLI 风格模板选择。
- AI 每次扫描旧项目寻找视觉样式。
- 业务代码硬编码颜色检查。
- `style-template-*` Skill。
- 修改或复制 `htw-table` 源码。
- 由官方 Figma Skill 直接绕过规格编写页面。
- AI 猜测接口、权限标识、字典类型或后端字段。

## 7. 总体架构

### 7.1 四层结构

#### A. 控制层

以 Node.js CLI 为主，PowerShell 作为 Windows 快速入口。

职责：

- 项目识别。
- 初始化和同步运行时文件。
- 创建规格。
- 执行检查和诊断。
- 输出变更预览和冲突报告。

#### B. 项目运行时层

随业务项目进入 Git，保存机器可读事实和团队规则。

核心目录：

- `.harness/`
- `.agents/skills/`
- `specs/`
- `AGENTS.md`

#### C. Agent 适配层

让不同 AI 工具读取同一套事实。适配层只能做入口和引用，不维护第二份详细规则。

#### D. 检查与验收层

对运行时结构、项目识别结果、规格完整性、关键编码约定和交付状态执行检查。

### 7.2 建议源码工程结构

azi-harness 自身建议使用 TypeScript + npm workspaces：

```text
azi-harness/
├── packages/
│   ├── cli/                 # 命令入口和交互
│   ├── core/                # 文件计划、冲突处理、清单和日志
│   ├── detectors/           # 项目识别器
│   ├── runtime-templates/   # .harness、AGENTS、Skills 模板
│   ├── spec-kit/            # 规格创建、Schema 和校验
│   └── checks/              # doctor/check 检查器
├── fixtures/                # 手工构造的最小测试项目，不复制历史项目
├── docs/                    # azi-harness 自身文档
└── tests/                   # 跨包和端到端测试
```

首版保持单仓库、少依赖，不建设插件市场或远程控制台。

### 7.3 多工具兼容契约

`.harness/` 是项目事实和规则的唯一来源。`AGENTS.md` 与可能需要的工具专用文件都属于薄适配层，只能包含读取路径、触发方式和少量不可绕过的入口规则。

首版必须为以下工具建立兼容矩阵：

| 工具 | 首选入口 | 备用方式 | 开工前要求 |
|---|---|---|---|
| Cursor | 待官方机制验证 | 薄规则文件引用 `AGENTS.md`，支持显式 Skill | 验证当前版本的项目规则和 Skill 发现方式 |
| OpenCode | 待官方机制验证 | 启动提示引用 `AGENTS.md` | 验证当前版本的入口和 Skill 发现方式 |
| Codex | `AGENTS.md` | 明确引用 Skills，支持显式 Skill | 验证目录作用域、覆盖顺序和 Skill 位置 |
| Antigravity IDE | 待官方机制验证 | 项目级薄入口 | 验证当前版本支持的规则文件 |
| Harness | `AGENTS.md` 与运行时目录 | 项目级启动说明 | 验证执行环境读取路径 |

约束：

- 实现前查阅各工具当时的官方文档，不能依赖记忆写死行为。
- 工具专用适配文件不得复制 `.harness/rules/` 全文。
- 某工具不支持自动发现时，应提供明确的一次性启动指令。
- 兼容性测试必须证明同一测试任务在不同工具中读取了相同项目类型、Vue 版本和关键规则。
- 工具能力变化只更新适配层，不改变项目核心协议。
- V1 的真实使用验收优先级为 Codex、Antigravity IDE、Cursor；OpenCode 和 Harness 保留兼容入口并完成基础读取验证。
- “自动调用 Skill”是增强体验，不是正确性的唯一依赖。关键规则必须能通过入口文件和显式 Skill 调用生效。

## 8. 接入后目录协议

```text
target-project/
├── AGENTS.md
├── .harness/
│   ├── config.json
│   ├── manifest.json
│   ├── project.json
│   ├── proposals/           # 已有入口文件的建议补丁，可处理后删除
│   ├── docs/
│   │   ├── overview.md
│   │   ├── project-profile.md
│   │   ├── commands.md
│   │   └── workflow.md
│   └── rules/
│       ├── project-conventions.md
│       ├── ruoyi.md
│       ├── htw-table.md
│       ├── figma.md
│       └── quality.md
├── .agents/
│   └── skills/
│       └── README.md
└── specs/
    ├── README.md
    └── 001-feature-name/
        ├── requirements.md
        ├── design.md
        ├── screens.yaml
        ├── tasks.md
        └── acceptance.md
```

### 8.1 文件职责

| 文件 | 职责 | 维护方式 |
|---|---|---|
| `AGENTS.md` | AI 协作入口，只说明读取顺序和硬性禁令 | 工具管理，保持简短 |
| `.harness/config.json` | 用户可配置项，如命令覆盖和启用检查 | 用户维护 |
| `.harness/manifest.json` | 运行时版本、文件所有权、校验摘要 | 工具管理 |
| `.harness/project.json` | 机器可读的项目识别结果和证据 | 工具生成 |
| `.harness/proposals/` | 对已有入口文件的建议补丁 | 工具生成，人工决定是否应用 |
| `.harness/docs/` | 项目说明、命令和工作流 | 工具生成后允许项目补充 |
| `.harness/rules/` | 可执行的开发约束 | 模板生成并按识别结果裁剪 |
| `.agents/skills/` | Agent 可独立调用的工作单元 | 工具管理，项目可扩展 |
| `specs/` | 每个功能的需求、设计、任务和验收 | 团队与 AI 共同维护 |

### 8.2 `AGENTS.md` 长度约束

建议不超过 60 行且不超过 4 KB，只包含：

1. 必读文件顺序。
2. 当前项目类型和关键入口。
3. 规格优先规则。
4. Vue2/Vue3 不混用。
5. 若依能力复用要求。
6. HTWTable 使用前核对公开 API。
7. 禁止读取 `.windsurfrules`。
8. 可用 Skills 列表。
9. 检查命令。

详细说明必须下沉到其他目录。

### 8.3 项目识别覆盖策略

`.harness/project.json` 必须同时保留：

- `detected`：工具根据项目证据得到的原始识别结果。
- `effective`：应用人工覆盖后供规则和 Skills 使用的结果。
- `overridesApplied`：本次生效的覆盖项、原因和来源。

`.harness/config.json` 允许在识别冲突或老项目结构特殊时配置覆盖，但每个覆盖必须包含：

- 覆盖字段和值。
- `reason`：为什么检测结果不适用于该项目。
- 可选 `owner`：由谁确认。

覆盖规则：

- 不直接改写或隐藏原始检测证据。
- `azi doctor` 必须检查覆盖是否已过期或与当前依赖冲突。
- 命令映射、能力入口、项目类型和 HTWTable 文档位置允许覆盖。
- Vue 实际安装版本等客观事实发生冲突时必须报错，不能靠覆盖静默通过。

## 9. 项目识别

### 9.1 首版类型

- `ruoyi-vue2-element-ui`
- `ruoyi-vue3-element-plus`
- `vue2-element-ui`
- `vue3-element-plus`
- `uniapp`
- `unknown`

### 9.2 识别顺序

1. 读取 `package.json` 和锁文件。
2. 确认 Vue、UI 框架和 uniapp 相关依赖。
3. 查找若依目录和能力特征。
4. 识别请求封装、权限、字典、路由和公共能力。
5. 识别 HTWTable 的安装来源和版本。
6. 识别 scripts 中的构建、测试和 lint 命令。
7. 计算类型、置信度和冲突项。
8. 生成机器可读结果和人类可读说明。

### 9.3 识别证据

每个结论至少记录：

- `value`：识别值。
- `confidence`：`high`、`medium`、`low`。
- `evidence`：依赖、文件路径或导出名称。
- `conflicts`：相互矛盾的信号。
- `detectedAt`：识别时间。

示意：

```json
{
  "projectType": "ruoyi-vue3-element-plus",
  "framework": {
    "vue": "3.x",
    "ui": "element-plus"
  },
  "capabilities": {
    "permission": {
      "value": ["v-hasPermi", "hasPermi"],
      "confidence": "high",
      "evidence": ["package.json", "src/directive/permission/hasPermi.js"]
    }
  }
}
```

### 9.4 若依能力识别

必须识别并记录：

- `v-hasPermi` / `hasPermi`。
- `useDict`。
- `DictTag`。
- 请求封装文件和调用方式。
- 路由和动态菜单入口。
- 列表分页字段约定：`pageNum`、`pageSize`、`rows`、`total`。
- 现有弹窗、下载和消息能力。
- Vue2 或 Vue3 API 边界。

如果某项未找到，只记录未找到，不能自动补造新的项目约定。

### 9.5 HTWTable 识别

识别内容：

- 是否存在。
- 安装来源：npm 包、私有包、项目插件注册或别名。
- 实际版本。
- Vue 兼容范围。
- 能找到的公开文档、类型声明或导出 API。

团队提供的 HTWTable 权威资料入口：

- `http://192.168.30.4/chenzl2/htw-table-vue`

API 确认优先顺序：

1. 目标项目已安装版本自带的类型声明、README 和导出 API。
2. 内网仓库中与已安装版本对应的 Tag、分支或文档。
3. 项目中现有调用方式，仅用于确认接入惯例。
4. 仍无法确认时由人补充，不读取或复制组件源码作为页面实现。

使用规则：

- 普通 Vue3 后台列表优先评估 `htw-table`。
- 使用前必须核对当前项目安装版本的公开 API。
- 不读取其实现并复制为项目代码。
- 树表、虚拟滚动、复杂合并单元格等场景允许例外。
- 例外原因写入 `design.md`。
- Vue2 项目不得套用 Vue3 HTWTable。

### 9.6 扫描边界

默认排除：

- `.git/`
- `node_modules/`
- `dist/`
- `build/`
- 覆盖率和缓存目录
- `.windsurfrules`

不扫描工作区外部路径，不跟随指向项目外部的符号链接。

## 10. CLI 与 PowerShell 功能

### 10.1 首版命令

```text
azi detect
azi init
azi sync
azi doctor
azi spec create <feature-name>
azi spec validate [path]
azi check
```

### 10.2 命令职责

#### `azi detect`

- 只读扫描项目。
- 输出项目类型、能力、命令、证据和冲突。
- 支持 `--json` 和 `--explain`。
- 不创建文件。

#### `azi init`

- 先执行识别。
- 展示将创建、跳过和冲突的文件。
- 生成项目运行时。
- 默认不覆盖任何已有文件。
- 如果已有 `AGENTS.md`，生成建议合并补丁，不直接修改原文件。
- 初始化成功后自动执行 `doctor`。

#### `azi sync`

- 根据已安装运行时版本更新工具管理文件。
- 用户文件和用户修改过的种子文件不自动覆盖。
- 先显示变更计划，再执行。
- 遇到冲突时退出并给出逐文件处理建议。

#### `azi doctor`

- 检查 Node、包管理器、项目命令和运行时目录。
- 检查 `project.json` 是否与当前依赖一致。
- 检查 Skills 和 `AGENTS.md` 引用是否有效。
- 输出错误、警告和建议，不修改业务代码。

#### `azi spec create`

- 计算下一个三位编号。
- 生成 5 个规格文件。
- 校验功能名和目录冲突。
- 不生成页面、接口或权限值。

#### `azi spec validate`

- 检查 5 个文件是否齐全。
- 校验 `screens.yaml` Schema。
- 检查未知项是否显式标记。
- 检查任务和验收项是否可追踪。

#### `azi check`

- 运行运行时结构检查。
- 运行项目约定检查。
- 运行规格检查。
- 默认调用项目中已识别的 lint、test、build 命令；不存在的命令自动跳过并说明。
- 支持 `--quick` 只执行运行时、规格和静态规则检查。
- 支持在 `.harness/config.json` 中纠正命令映射或明确禁用某个命令，并要求填写原因。
- 不自动安装依赖。
- 返回适合 GitLab CI 使用的退出码。

### 10.3 PowerShell 入口

PowerShell 只负责：

- 检查 Node 环境。
- 调用本地或已安装的 `azi` CLI。
- 在内网环境中提供简短安装和初始化命令。

业务逻辑必须放在 TypeScript 核心中，避免 CLI 和 PowerShell 产生两套行为。

## 11. 安全初始化与文件所有权

### 11.1 文件分类

- `managed`：由工具完全管理。内容被用户修改后，升级必须报冲突。
- `seeded`：首次生成后交给项目维护。后续只提示模板有更新。
- `user`：工具只读取或校验，不写入。

### 11.2 重复执行规则

1. 文件不存在：创建。
2. 文件存在且内容与清单一致：跳过。
3. 文件存在、由工具管理、但内容被修改：报冲突。
4. 文件存在但不在清单中：视为用户文件，不覆盖。
5. 只有显式 `--force` 才允许替换，并必须先生成差异或备份。

### 11.3 清单内容

`.harness/manifest.json` 至少保存：

- 运行时版本。
- Schema 版本。
- 生成时间。
- 文件路径。
- 文件所有权类型。
- 模板版本。
- 内容摘要。
- 上次识别摘要。

### 11.4 原子写入

写文件应采用临时文件加替换的方式。任一步失败时，不能留下半套运行时目录。

### 11.5 建议补丁

已有 `AGENTS.md` 或工具入口文件与 azi-harness 入口要求冲突时：

- 在 `.harness/proposals/` 生成统一差异格式的建议补丁。
- 补丁只添加必要入口，不复制详细规则。
- 补丁不得自动应用。
- 用户合并后可删除 proposal；`doctor` 只提示未处理 proposal，不将其视为业务代码。

## 12. Skill 来源策略

### 12.1 产品原则

- 项目内不再生成自写业务 `SKILL.md`。
- 通用能力优先复用外部 Skill、插件 Skill 或官方 Skill。
- 若依、HTWTable、质量和规格约束由 `.harness/rules/`、`.harness/docs/` 和 `specs/` 提供。
- `.agents/skills/` 只保留 Skill 索引或团队补充说明，不复制外部 Skill 正文。
- `.harness/skill-map.json` 提供机器可读的 Skill 匹配规则。

### 12.2 推荐的 Skill 来源

- `obra/superpowers`
- `figma`
- `figma-use`
- `figma-implement-design`
- `playwright`
- `screenshot`
- `openai-docs`
- `greensock/gsap-skills`
- `phuryn/pm-skills`
- `YuJunZhiXue/github-skill-forge`

### 12.3 项目内分工

- 若依项目理解和 CRUD 约束由项目规则与规格承担，不再依赖自写 `ruoyi-*` Skill。
- Figma 任务可以使用 Figma 相关 Skill 提取设计事实，但必须先写入 5 个规格文件。
- 浏览器联调和视觉验收优先使用 `playwright`、`screenshot` 等 Skill。
- 动效、时间线和滚动场景优先匹配 `greensock/gsap-skills`。
- PRD、需求澄清、优先级和发布计划优先匹配 `phuryn/pm-skills`。
- 需要将 GitHub 仓库沉淀为可复用技能时，可匹配 `github-skill-forge`。
- 当前环境没有适用 Skill 时，直接按规则和规格执行，不在项目里临时发明 Skill。

无 Figma 时：

- 只允许沿用目标项目中的同类页面。
- 必须在规格中写明参考页面路径和沿用范围。

#### Figma MCP 与 429 降级策略

首选 Figma Remote MCP Server 搭配 Figma Skills。读取 Figma 前执行以下流程：

1. 通过 `whoami` 确认当前账号、计划和席位。
2. 要求用户提供节点级 URL，避免默认读取整个文件或大型页面。
3. 优先一次获取完成规格所需的节点上下文，避免对同一节点重复调用。
4. 已提取的信息立即写入规格；后续步骤优先读取本地规格，不重复请求 Figma。
5. 多页面功能按页面分批处理，不并行轰炸读取工具。

遇到 429 时：

- 立即停止重复调用，不使用无间隔重试。
- 客户端能返回等待时间时，遵循 `Retry-After`。
- 记录已完成节点、待处理节点和恢复位置。
- 等待额度恢复后从断点继续。
- 不自动改用 Figma REST API 绕过限制，因为 REST API 也有独立速率限制。

无法等待或额度持续不足时，按顺序降级：

1. 使用已经取得的 Figma 截图和节点上下文。
2. 由用户导出目标 Frame 的 PNG/SVG 与必要标注。
3. 由用户提供页面截图、文案和交互说明。
4. 沿用目标项目现有同类页面。

降级后必须在 `screens.yaml` 中记录真实来源，例如 `figma-mcp`、`figma-export`、`screenshot` 或 `legacy-page`，不能伪装成完整 Figma 数据。

参考：

- Figma MCP 官方介绍：`https://developers.figma.com/docs/figma-mcp-server/`
- Figma MCP 额度说明：`https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/`
- Figma REST API 429 处理：`https://developers.figma.com/docs/rest-api/rate-limits/`

## 13. 功能规格协议

### 13.1 `requirements.md`

包含：

- 背景和目标。
- 用户角色。
- 功能范围。
- 非目标。
- 业务规则。
- 接口、权限、字典的已知事实。
- 未知项和待确认问题。
- 需求验收条件。

### 13.2 `design.md`

包含：

- 页面和模块边界。
- 路由、菜单和权限接入方式。
- 数据流和请求映射。
- 组件选择。
- HTWTable 评估结论及证据。
- 弹窗、消息、下载和字典复用方式。
- Vue2/Vue3 实现约束。
- 异常、空态、加载态和权限态。
- 技术风险和回退方案。

### 13.3 `screens.yaml`

建议字段：

```yaml
version: 1
feature: feature-name
source:
  type: figma-mcp
  url: ""
  nodeId: ""
  reference: ""
  status: ok
  retriedAt: ""
  fallback: ""
  notes: ""
screens:
  - id: list
    route: ""
    title: ""
    states:
      - default
      - loading
      - empty
      - error
    regions: []
    interactions: []
    assets: []
unknowns: []
```

它描述可见结构和状态，不保存全局视觉 Token。使用截图、导出图或项目内同类页面时，`source.reference` 必须记录真实来源路径。

### 13.4 `tasks.md`

任务应按依赖顺序拆分，并标记：

- 任务编号。
- 关联需求。
- 涉及文件。
- 前置条件。
- 验证命令。
- 状态。

### 13.5 `acceptance.md`

至少覆盖：

- 功能验收。
- 权限验收。
- 字典和状态显示。
- 分页字段。
- 加载、空、错误状态。
- Figma 视觉对照或同类页面对照。
- lint/test/build 结果。
- 人工 Review 记录。
- HTWTable 使用或例外说明。

## 14. 自动检查

### 14.1 运行时结构检查

- `AGENTS.md` 是否存在且未超出长度限制。
- 入口引用的文件是否存在。
- `.harness/manifest.json` 是否完整。
- Skills 目录和名称是否正确。
- 禁止将详细规则堆回 `AGENTS.md`。

### 14.2 项目事实检查

- Vue 和 UI 框架版本是否发生变化。
- 项目类型是否与当前证据一致。
- 配置命令是否仍存在。
- 若依能力路径是否失效。
- HTWTable 版本或来源是否变化。

### 14.3 规格检查

- 5 个规格文件齐全。
- `screens.yaml` 可解析且符合 Schema。
- 未知项有明确标记。
- 任务可以追踪到需求。
- 验收项包含权限、分页和页面状态。
- 官方 Figma Skill 参与的规格产物没有虚构接口或权限。

### 14.4 代码约定检查

首版只做高价值、低误报检查：

- Vue2 项目出现明确的 Vue3 专用 API。
- Vue3 项目误用已知 Vue2 专用模式。
- 若依列表分页字段偏离已识别约定。
- 权限需求存在但页面未使用项目权限能力。
- Vue3 普通列表未记录 HTWTable 评估结果。
- 规格要求复用公共能力，但实现新建了重复工具。

这些规则应先以警告为主，经过试点降低误报后再升级为错误。

### 14.5 项目命令检查

只调用 `package.json` 中已识别或 `.harness/config.json` 明确配置的命令。不得猜测或自动安装依赖。

## 15. 标准工作流

```text
项目接入
  -> 项目识别
  -> 人工确认识别结果
  -> 创建功能规格
  -> Figma 转规格或同类页面取证
  -> 补齐接口/权限/字典事实
  -> 规格校验
  -> AI 实现
  -> 自动检查
  -> 人工验收
  -> Review
  -> Commit / Merge Request
```

### 15.1 人工确认点

以下情况必须由人确认：

- 项目类型证据冲突。
- 请求封装有多个候选。
- 权限、字典或接口信息缺失。
- HTWTable 公开 API 无法确认。
- Figma 与目标项目现有交互约定冲突。
- AI 计划修改项目基础能力或共享组件。

## 16. GitLab 集成

首版提供可复制的 CI 示例，不强制修改用户流水线。

建议阶段：

1. `azi doctor --ci`
2. `azi spec validate`
3. `azi check`

输出要求：

- 标准退出码。
- 人类可读日志。
- 可选 JSON 报告。
- 报告中包含失败文件和修复建议。

首版不做 GitLab Bot、自动评论或远程服务。

## 17. 技术选型建议

### 17.1 基础技术

- 不预先强制目标项目升级到 Node.js 20。
- CLI 避免使用不必要的 Node 20 专用 API；在收集试点项目 Node 版本后，以“最低实际测试通过版本”声明 `engines.node`。
- 如果某个目标项目 Node 版本低于 CLI 实际可支持范围，`doctor` 必须明确报出，不得静默失败。
- TypeScript。
- npm workspaces，提交 `package-lock.json`。
- CLI 参数解析库选择轻量方案。
- JSON Schema + YAML 解析用于规格校验。
- Vitest 用于单元测试和端到端测试。

### 17.2 设计要求

- 核心逻辑不依赖交互式终端，便于 CI 调用。
- 文件变更先生成内存计划，再统一落盘。
- 检测器使用独立规则和证据，不把判断散落在命令中。
- 模板带版本，Schema 独立版本化。
- Windows 路径、大小写和编码必须纳入测试。

## 18. 开发阶段

### 阶段 0：协议冻结

预计投入：2 至 3 人日。

交付：

- 产品边界和非目标确认。
- 运行时目录协议。
- `project.json`、`manifest.json`、`screens.yaml` Schema 草案。
- 文件所有权和冲突策略。
- CLI 命令契约。
- 五种目标 AI 工具的兼容矩阵和验证记录。
- 试点项目 Node/npm 版本清单和 CLI 兼容基线。

退出条件：

- 两名开发对目录、命令和安全规则达成一致。
- 不再存在“工具生成文件由谁维护”的歧义。
- 不再假设所有工具会自动读取同一种入口文件。

### 阶段 1：核心框架与识别器

预计投入：5 至 7 人日。

交付：

- npm workspaces + TypeScript 工程。
- 文件扫描基础设施。
- 6 类项目识别。
- 若依能力识别。
- HTWTable 来源和版本识别。
- `azi detect`。
- 最小测试 fixtures。

退出条件：

- 所有 fixture 的类型识别正确。
- 每个结论都能通过 `--explain` 展示证据。
- `.windsurfrules` 不会被读取。

### 阶段 2：安全初始化与同步

预计投入：4 至 6 人日。

交付：

- `azi init`。
- `azi sync`。
- 运行时模板。
- 文件清单、摘要和所有权。
- 预览、冲突和原子写入。
- PowerShell 快速入口。

退出条件：

- 空项目、已有文件、部分接入、重复执行均有自动测试。
- 不使用 `--force` 时静默覆盖为 0。

### 阶段 3：规格与 Skill 来源策略

预计投入：5 至 7 人日。

交付：

- `azi spec create`。
- `azi spec validate`。
- 5 个规格模板和 Schema。
- Skill 索引、使用说明和 `.harness/skill-map.json`。
- Figma MCP 429 断点与降级流程。

退出条件：

- 能从 Figma 节点形成完整规格但不改页面代码。
- 缺失接口或权限时，校验能够保留明确未知项。
- Figma 429 时不会连续重试，并能基于已有信息或导出物继续形成规格。

### 阶段 4：检查与 CI

预计投入：4 至 6 人日。

交付：

- `azi doctor`。
- `azi check`。
- 结构、事实、规格和高价值代码约定检查。
- GitLab CI 示例。
- 文本和 JSON 报告。

退出条件：

- 检查可在本地和 GitLab CI 非交互运行。
- 误报不会阻断正常 Vue2/Vue3 项目。

### 阶段 5：真实项目试点

预计投入：5 至 8 人日。

试点顺序：

1. 一个若依 Vue3 + Element Plus 项目。
2. 一个若依 Vue2 + Element UI 项目。
3. 一个 uniapp 项目只验证识别和基础接入。

试点任务：

- 每个 Web 项目选择一个真实但范围小的 CRUD 功能。
- 完成 Figma/同类页面取证、规格、实现、检查和验收全流程。
- 记录 AI 偏差、检查误报和遗漏规则。
- 只修正通用运行时问题，不抽取视觉样式。

退出条件：

- Vue2/Vue3 没有 API 混用。
- 若依公共能力得到复用。
- HTWTable 选择有证据。
- 规格能支撑 Review。
- 重复接入和升级无文件损坏。

### 总体周期

两人协作、优先保障测试和试点时，首个可用版本建议按 4 至 6 周规划。若两人同时还承担业务开发，应按 6 至 8 周安排。

## 19. 分工建议

### 开发 A

- CLI 和文件计划。
- manifest、初始化、同步。
- PowerShell 和 GitLab CI。
- 端到端测试。

### 开发 B

- 项目识别器。
- 规格 Schema 和模板。
- Skills。
- 规则检查器。

### 共同负责

- 协议评审。
- Vue2/Vue3 fixture。
- 真实项目试点。
- 误报分级。
- 发布说明。

每个阶段至少进行一次交叉 Review，避免某一人同时定义协议和验收自己的实现。

## 20. 测试计划

### 20.1 单元测试

- 依赖版本解析。
- 项目类型评分。
- 若依能力匹配。
- HTWTable 来源识别。
- 文件摘要和所有权判断。
- Schema 校验。
- 规则检查器。

### 20.2 快照与黄金文件测试

- 不同项目类型生成的 `AGENTS.md`。
- `.harness/rules/` 裁剪结果。
- 三个 Skills 内容。
- 规格模板。
- `project.json` 输出。

### 20.3 端到端测试

- 空目录初始化。
- 非 Git 目录初始化。
- 已有 `AGENTS.md`。
- 已有 `.harness/` 但无 manifest。
- 重复执行。
- 用户修改 managed 文件。
- 用户修改 seeded 文件。
- 项目依赖升级后重新识别。
- Vue2/Vue3 冲突依赖。
- Windows 路径含空格和中文。
- CI 非交互模式。
- 已有 `AGENTS.md` 时生成建议补丁且不改原文件。
- `azi check` 对存在的 lint/test/build 各执行一次。
- Codex、Antigravity IDE、Cursor 对同一任务读取一致的项目事实。

### 20.4 安全测试

- 路径穿越。
- 符号链接越界。
- 临时写入失败。
- 非法 YAML/JSON。
- `--force` 保护。
- 扫描排除目录验证。
- 确认 `.windsurfrules` 从未进入读取列表。
- 模拟 Figma 429，确认不会立即连续重试。
- Figma 降级来源正确写入 `screens.yaml`。

## 21. 发布范围

### V1 必须有

- 6 类项目识别。
- Cursor、OpenCode、Codex、Antigravity IDE 和 Harness 的兼容矩阵及薄适配入口。
- 若依项目能力识别。
- HTWTable 来源、版本和适配规则。
- `detect/init/sync/doctor/spec/check`。
- 安全重复执行。
- 运行时目录和简短 `AGENTS.md`。
- 3 个首发 Skills。
- 规格创建与校验。
- Figma MCP + Figma Skills 接入约定和 429 降级流程。
- GitLab CI 示例。
- Vue2 和 Vue3 实际试点。

### V1.1 可考虑

- 更多 AI 工具的适配入口。
- 更准确的变更文件与规格关联检查。
- Figma 资源清单辅助导出。
- 检查结果的 SARIF 或 JUnit 格式。
- 运行时升级迁移器。

### 后续再考虑

- `figma-page-implementation`。
- `legacy-page-refactor`。
- uniapp 专用 Skill。
- GitLab Merge Request 自动评论。
- 可插拔的团队私有 Skill 包。

## 22. 风险与应对

### 风险 1：项目识别误判

应对：多证据评分、冲突报告、人工确认、允许配置覆盖。

### 风险 2：规则文件逐渐重复

应对：`AGENTS.md` 只做入口；规则、Skill、项目事实分层；增加重复内容检查。

### 风险 3：生成文件升级覆盖用户内容

应对：文件所有权、摘要、预览、冲突退出、原子写入。

### 风险 4：检查器误报过多

应对：首版先警告，基于试点数据逐步升级为错误；规则支持项目级禁用并记录原因。

### 风险 5：Figma 规格看似完整但业务事实缺失

应对：接口、权限、字典独立列为事实；未知项不能被视觉信息填充。

### 风险 6：Figma MCP 触发 429

应对：节点级读取、减少重复调用、规格作为本地中间产物、遵循等待时间、断点续作，并支持截图或人工导出降级。

### 风险 7：HTWTable API 随项目版本不同

应对：每个项目记录来源和版本；使用时重新核对公开 API；不能在 Skill 中写死单一版本 API。

### 风险 8：两人团队维护成本过高

应对：首版只保留 3 个 Skills、6 个命令、单仓库和本地文件协议，不建设服务端。

## 23. 已确认决策与剩余调查

### 23.1 已确认决策

1. npm 包名：`azi-harness`。
2. 不人为规定 Node 20；最低版本以试点和 CI 实测结果为准，不要求业务项目无意义升级。
3. azi-harness 自身和安装方式统一使用 npm。
4. 允许人工覆盖项目识别结果，但保留原始证据，覆盖必须填写原因并接受过期检查。
5. `azi check` 默认调用已识别的 lint/test/build，`--quick` 可跳过项目命令。
6. 已有 `AGENTS.md` 时生成建议补丁，不静默覆盖。
7. 首批试点覆盖若依 Vue3、若依 Vue2 和 uniapp；具体仓库在试点准备阶段指定。
8. Figma 使用 Remote MCP Server 搭配 Figma Skills，并具备 429 断点和导出物降级。
9. HTWTable 权威资料入口为 `http://192.168.30.4/chenzl2/htw-table-vue`。
10. GitLab Package Registry 和 CI Runner 环境暂未知，由阶段 0 调查，不阻塞本地核心开发。
11. V1 优先保证 Codex、Antigravity IDE、Cursor；OpenCode 和 Harness 做基础兼容。

### 23.2 剩余调查

1. 首批试点项目当前使用的 Node 和 npm 版本。
2. GitLab Package Registry 是否允许发布 `azi-harness`，以及认证方式。
3. GitLab CI Runner 的操作系统、Node 版本和内网访问能力。
4. Codex、Antigravity IDE、Cursor 的实际版本及项目规则/Skills 入口。
5. OpenCode 和 Harness 当前版本的基础入口能力。
6. Figma 账号所在计划、席位和实际 MCP 额度。
7. HTWTable 已安装版本与内网仓库 Tag/分支的对应关系。

## 24. 开工门槛

以下事项完成后再进入实现：

- 本 PRD 经过两人确认。
- 选定两个 Web 试点项目，但首轮开发不复制其代码。
- 得到 HTWTable 当前版本的公开 API 来源。
- 冻结三份 Schema 初稿。
- 收集试点项目 Node/npm 版本。
- 完成 Codex、Antigravity IDE、Cursor 入口机制核验。
- 确认 V1 不加入任何样式模板或代码生成能力。

## 25. 最终验收清单

- [ ] 能解释项目为何被识别为某一类型。
- [ ] 五种目标 AI 工具读取的是同一套项目事实和规则。
- [ ] 能通过 `npm install --save-dev azi-harness` 和 `npx azi init` 完成项目接入。
- [ ] 不支持自动 Skill 的客户端仍能通过显式入口完成相同流程。
- [ ] Vue2 和 Vue3 规则完全分离。
- [ ] 若依权限、字典、请求、路由、分页和公共能力均有记录。
- [ ] HTWTable 使用前能确认当前项目版本和公开 API。
- [ ] `AGENTS.md` 简短且只作入口。
- [ ] `.windsurfrules` 未被扫描、迁移或执行。
- [ ] 初始化和同步不静默覆盖文件。
- [ ] 重复执行不会产生无意义变更。
- [ ] 三个首发 Skills 职责清晰且互不越界。
- [ ] Figma 只能先形成规格，不能直接越过规格写页面。
- [ ] Figma 429 不会触发连续重试，并可从断点或降级输入继续。
- [ ] 功能规格包含 5 个规定文件。
- [ ] 检查命令可在 GitLab CI 中运行。
- [ ] Vue2、Vue3 和 uniapp 完成约定范围内试点。
- [ ] 未引入样式模板、Design Token 或历史视觉抽取。
