import { describe, expect, it } from "vitest";

import { matchSkills, parseSkillMap } from "./skill-match.js";

const skillMap = {
  schemaVersion: "1",
  projectType: "ruoyi-vue3-element-plus",
  sources: [
    {
      id: "obra/superpowers",
      category: "workflow",
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
        "screenshot"
      ],
      matchWhenAny: [
        "Figma 节点转规格",
        "页面还原",
        "设计事实提取",
        "视觉验收"
      ],
      avoidWhenAny: [
        "纯前端修 bug"
      ]
    },
    {
      id: "greensock/gsap-skills",
      category: "animation",
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
  projectSpecific: {}
};

describe("skill matching", () => {
  it.each([
    {
      task: "根据 Figma 节点还原页面，并完成截图视觉验收",
      expectedSource: "figma-family",
      expectedSkill: "figma-use"
    },
    {
      task: "给首页增加 ScrollTrigger 时间线动画和滚动联动",
      expectedSource: "greensock/gsap-skills",
      expectedSkill: "greensock/gsap-skills"
    },
    {
      task: "帮我写 PRD，做需求澄清和优先级排序",
      expectedSource: "phuryn/pm-skills",
      expectedSkill: "phuryn/pm-skills"
    },
    {
      task: "把 GitHub 仓库沉淀为团队可复用的 Skill 上下文包",
      expectedSource: "YuJunZhiXue/github-skill-forge",
      expectedSkill: "YuJunZhiXue/github-skill-forge"
    },
    {
      task: "复杂功能开发，需要计划、评审、提交闭环",
      expectedSource: "obra/superpowers",
      expectedSkill: "obra/superpowers"
    }
  ])("recommends $expectedSource for $task", ({ task, expectedSource, expectedSkill }) => {
    const result = matchSkills(task, skillMap);

    expect(result.matches[0]?.sourceId).toBe(expectedSource);
    expect(result.matches[0]?.recommendedSkills).toContain(expectedSkill);
    expect(result.fallback.useProjectRules).toBe(false);
  });

  it("reports avoid matches without recommending the source", () => {
    const result = matchSkills("普通后台 CRUD 页面，只做纯样式微调", skillMap, {
      includeAvoided: true
    });

    expect(result.matches.some((match) => match.sourceId === "greensock/gsap-skills")).toBe(false);
    expect(result.avoided.some((match) => match.sourceId === "greensock/gsap-skills")).toBe(true);
  });

  it("returns a project-rule fallback when no source matches", () => {
    const result = matchSkills("修正 README 错别字", skillMap);

    expect(result.matches).toEqual([]);
    expect(result.fallback).toEqual({
      useProjectRules: true,
      message: "No skill source matched the task. Use .harness/rules and specs directly; do not invent a project-local Skill."
    });
  });

  it("applies the match limit and emits a warning", () => {
    const result = matchSkills("需求澄清 PRD Figma 页面还原 视觉验收 ScrollTrigger 时间线动画", skillMap, {
      limit: 1
    });

    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toContain("Only the top 1 skill matches are returned.");
  });

  it("validates the skill-map shape before matching", () => {
    expect(() => parseSkillMap({ schemaVersion: "1" })).toThrow(
      "skill-map.sources must be an array"
    );
  });
});
