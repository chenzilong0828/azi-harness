import {
  cp,
  mkdtemp,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyPreparedInitialization,
  prepareRuntimeInitialization
} from "./init-runtime.js";
import {
  runSkillDoctor,
  runSkillInstallGuide,
  runSkillList,
  runSkillMatch,
  runSkillSearch,
  runSkillSources
} from "./skill-runtime.js";

const temporaryRoots: string[] = [];
const fixtureRoot = path.resolve(process.cwd(), "fixtures/ruoyi-vue3-element-plus");

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-skill-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("skill runtime", () => {
  it("matches against the generated skill-map", async () => {
    const root = await initializedFixture();

    const report = await runSkillMatch({
      root,
      task: "根据 Figma 节点还原页面，并完成视觉验收",
      limit: 3
    });

    expect(report.root).toBe(root);
    expect(report.skillMapPath).toBe(path.join(root, ".harness", "skill-map.json"));
    expect(report.skillCatalogPath).toBe(path.join(root, ".harness", "skill-catalog.json"));
    expect(report.matches[0]?.sourceId).toBe("figma-family");
    expect(report.matches[0]?.recommendedSkills).toContain("figma-use");
    expect(report.matches[0]?.constraints).toContain("先生成缓存、规格建议、实现上下文和候选补丁");
    expect(report.sourceDetails[0]?.sourceUrl).toContain("figma.com");
  });

  it("uses the fallback when no generated source matches", async () => {
    const root = await initializedFixture();

    const report = await runSkillMatch({
      root,
      task: "修正 README 错别字"
    });

    expect(report.matches).toEqual([]);
    expect(report.fallback.useProjectRules).toBe(true);
  });

  it("does not recommend animation, product, or meta skills for ordinary CRUD", async () => {
    const root = await initializedFixture();
    const report = await runSkillMatch({
      root,
      task: "普通后台 CRUD 页面开发，只调整表格字段",
      includeAvoided: true
    });
    const forbidden = new Set([
      "greensock/gsap-skills",
      "phuryn/pm-skills",
      "YuJunZhiXue/github-skill-forge"
    ]);
    expect(report.matches.every((match) => !forbidden.has(match.sourceId))).toBe(true);
  });

  it("prioritizes Superpowers for a long development workflow", async () => {
    const root = await initializedFixture();
    const report = await runSkillMatch({
      root,
      task: "复杂功能开发，需要从需求澄清、计划、实现到评审和提交闭环"
    });
    expect(report.matches[0]?.sourceId).toBe("obra/superpowers");
  });

  it("lists, searches, validates, and explains catalog sources", async () => {
    const root = await initializedFixture();
    const list = await runSkillList({ root, category: "design", enabledOnly: true });
    expect(list.sources.map((source) => source.id)).toEqual(["figma-family"]);
    expect(list.sources[0]?.recommendedScenarios).toContain("Figma 节点转规格");
    expect(list.sources[0]?.avoidScenarios).toContain("沿用项目同类页面");
    expect(list.sources[0]?.tools.codex.status).toBe("not-verified");

    const search = await runSkillSearch(root, "figma");
    expect(search.matches[0]?.source.id).toBe("figma-family");

    const doctor = await runSkillDoctor(root);
    expect(doctor.valid).toBe(true);
    expect(doctor.errors).toEqual([]);

    const sources = await runSkillSources(root);
    expect(sources.sources.some((source) => source.id === "obra/superpowers")).toBe(true);

    const guide = await runSkillInstallGuide(root, "obra/superpowers");
    expect(guide.source.tools.codex.status).toBe("not-verified");
    expect(guide.source.installation.projectCopiesSkillBody).toBe(false);
  });
});

async function initializedFixture(): Promise<string> {
  const root = await copyFixture();
  const prepared = await prepareRuntimeInitialization(root);
  await applyPreparedInitialization(prepared);
  return root;
}

async function copyFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-skill-"));
  temporaryRoots.push(root);
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}
