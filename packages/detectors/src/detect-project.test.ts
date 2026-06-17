import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectProject } from "./detect-project.js";

const fixturesRoot = path.resolve(process.cwd(), "fixtures");

describe.each([
  ["ruoyi-vue2-element-ui", "ruoyi-vue2-element-ui"],
  ["ruoyi-vue3-element-plus", "ruoyi-vue3-element-plus"],
  ["vue2-element-ui", "vue2-element-ui"],
  ["vue3-element-plus", "vue3-element-plus"],
  ["uniapp", "uniapp"],
  ["unknown", "unknown"]
] as const)("detectProject(%s)", (fixture, expectedType) => {
  it(`detects ${expectedType}`, async () => {
    const profile = await detectProject(path.join(fixturesRoot, fixture));

    expect(profile.detected.projectType.value).toBe(expectedType);
    expect(profile.effective.projectType.value).toBe(expectedType);
    expect(profile.overridesApplied).toEqual([]);
    expect(profile.detected.packageManager.value).toBe("npm");
  });
});

describe("RuoYi capability detection", () => {
  it("records Vue 2 conventions without HTWTable", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "ruoyi-vue2-element-ui"));

    expect(profile.detected.framework.vueMajor.value).toBe(2);
    expect(profile.detected.ruoyi.value).toBe(true);
    expect(profile.detected.capabilities.permission.value).toContain("v-hasPermi");
    expect(profile.detected.capabilities.pagination.value).toEqual([
      "pageNum",
      "pageSize",
      "rows",
      "total"
    ]);
    expect(profile.detected.htwTable.installed).toBe(false);
  });

  it("records Vue 3 HTWTable source and public documentation", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "ruoyi-vue3-element-plus"));

    expect(profile.detected.framework.vueMajor.value).toBe(3);
    expect(profile.detected.capabilities.dict.value).toEqual(["useDict", "DictTag"]);
    expect(profile.detected.htwTable).toMatchObject({
      installed: true,
      packageName: "htw-table",
      source: "git",
      compatibleVueMajor: 3,
      documentationUrl: "http://192.168.30.4/chenzl2/htw-table-vue"
    });
    expect(profile.detected.commands).toMatchObject({
      dev: ["dev"],
      build: ["build"],
      test: ["test"],
      lint: ["lint"],
      other: {
        "test:watch": "vitest",
        "lint:fix": "eslint src --fix"
      }
    });
  });
});

describe("scan boundaries", () => {
  it("never treats .windsurfrules as project evidence", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "unknown"));
    const serialized = JSON.stringify(profile.detected);

    expect(profile.detected.projectType.value).toBe("unknown");
    expect(profile.detected.ruoyi.value).toBe(false);
    expect(profile.detected.htwTable.installed).toBe(false);
    expect(serialized).not.toContain(".windsurfrules");
    expect(serialized).not.toContain("fixtures/fake");
  });
});
