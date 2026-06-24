import { describe, expect, it } from "vitest";

import {
  parseSkillCatalog,
  searchSkillCatalog,
  validateSkillCatalog,
  type SkillCatalog
} from "./skill-catalog.js";

const catalog: SkillCatalog = {
  schemaVersion: "1",
  projectType: "ruoyi-vue3-element-plus",
  installationStatusPolicy: "not-verified-by-project-runtime",
  tools: ["codex", "cursor", "antigravity", "opencode", "harness"],
  sources: [
    {
      id: "figma-family",
      displayName: "Figma 官方 Skill 与 MCP 组合",
      sourceUrl: "https://developers.figma.com/docs/figma-mcp-server/",
      category: "design",
      description: "提取设计事实并进入规格。",
      enabled: true,
      preferredSkills: ["figma-use"],
      recommendedScenarios: ["Figma 节点转规格", "视觉验收"],
      avoidScenarios: ["纯后端任务"],
      constraints: ["先写 specs，再写页面"],
      tools: createTools(),
      installation: {
        mode: "built-in-or-plugin",
        manualInstallRequired: false,
        globallyReusable: true,
        indexOnly: true,
        projectCopiesSkillBody: false
      }
    }
  ]
};

describe("skill catalog", () => {
  it("validates and parses a complete catalog", () => {
    expect(validateSkillCatalog(catalog).valid).toBe(true);
    expect(parseSkillCatalog(catalog).sources[0]?.id).toBe("figma-family");
  });

  it("searches names, scenarios, and supported tools", () => {
    expect(searchSkillCatalog(catalog, "figma")[0]?.source.id).toBe("figma-family");
    expect(searchSkillCatalog(catalog, "视觉验收")[0]?.matchedFields).toContain("推荐场景");
    expect(searchSkillCatalog(catalog, "codex")[0]?.matchedFields).toContain("适配工具");
  });

  it("rejects catalogs that do not cover all declared tools", () => {
    const invalid = structuredClone(catalog) as unknown as Record<string, unknown>;
    invalid.tools = ["codex"];
    const report = validateSkillCatalog(invalid);
    expect(report.valid).toBe(false);
    expect(report.errors).toContain("`.harness/skill-catalog.json.tools` must include `cursor`.");
  });
});

function createTools(): SkillCatalog["sources"][number]["tools"] {
  return {
    codex: { supported: true, status: "not-verified", installHint: "使用插件" },
    cursor: { supported: true, status: "not-verified", installHint: "配置 MCP" },
    antigravity: { supported: true, status: "not-verified", installHint: "配置 MCP" },
    opencode: { supported: true, status: "not-verified", installHint: "配置 MCP" },
    harness: { supported: true, status: "not-verified", installHint: "使用环境配置" }
  };
}
