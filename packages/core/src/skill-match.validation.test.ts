import { describe, expect, it } from "vitest";

import { validateSkillMap } from "./skill-match.js";

describe("skill-map validation", () => {
  it("accepts a well-formed skill-map", () => {
    const report = validateSkillMap({
      schemaVersion: "1",
      projectType: "ruoyi-vue3-element-plus",
      sources: [
        {
          id: "figma-family",
          category: "design",
          preferredSkills: ["figma", "figma-use"],
          matchWhenAny: ["Figma 节点转规格"],
          avoidWhenAny: ["纯前端修 bug"],
          constraints: ["先写 specs，再写页面"],
          install: {
            codex: "install via marketplace"
          }
        }
      ],
      projectSpecific: {}
    });

    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("flags duplicate ids and missing schema version", () => {
    const report = validateSkillMap({
      schemaVersion: "2",
      sources: [
        { id: "dup", matchWhenAny: ["需求澄清"] },
        { id: "dup", matchWhenAny: [] }
      ]
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContain("`.harness/skill-map.json` must declare `schemaVersion: \"1\"`.");
    expect(report.errors).toContain("Duplicate skill source id: dup");
    expect(report.warnings).toContain("Skill source dup has an empty matchWhenAny list.");
  });

  it("flags malformed nested fields", () => {
    const report = validateSkillMap({
      schemaVersion: "1",
      sources: [
        {
          id: "bad",
          enabled: false,
          matchWhenAny: ["Figma"],
          preferredSkills: ["figma"],
          avoidWhenAny: "nope",
          constraints: [123]
        }
      ]
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContain("`.harness/skill-map.json.sources[0].avoidWhenAny` must be an array of strings.");
    expect(report.errors).toContain("`.harness/skill-map.json.sources[0].constraints` must be an array of strings.");
    expect(report.warnings).toContain("Disabled skill source bad is missing a reason.");
  });

  it("warns when a source has no matching entries", () => {
    const report = validateSkillMap({
      schemaVersion: "1",
      sources: [
        {
          id: "empty"
        }
      ]
    });

    expect(report.valid).toBe(true);
    expect(report.warnings).toContain(
      "Skill source empty has no matchWhenAny or preferredSkills entries."
    );
  });
});
