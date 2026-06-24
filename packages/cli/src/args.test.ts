import { describe, expect, it } from "vitest";

import {
  parseCheckArguments,
  parseContextArguments,
  parseDoctorArguments,
  parseFigmaFallbackArguments,
  parseFigmaImportArguments,
  parseFigmaSpecArguments,
  parseFigmaTargetArguments,
  parseHtwInspectArguments,
  parseReviewArguments,
  parseSddArguments,
  parseSetupArguments,
  parseSkillDoctorArguments,
  parseSkillInstallGuideArguments,
  parseSkillListArguments,
  parseSkillMatchArguments,
  parseSkillSearchArguments,
  parseSkillSourcesArguments,
  parseSpecCreateArguments,
  parseSpecValidateArguments,
  parseTaskArguments,
  parseWorkflowAdvanceArguments,
  parseWorkflowLogArguments,
  parseWorkflowStartArguments,
  parseWorkflowStatusArguments
} from "./args.js";

describe("CLI argument parsing", () => {
  it("parses spec create with feature name and explicit root", () => {
    expect(parseSpecCreateArguments(["audit-log", "E:/repo", "--dry-run"])).toEqual({
      featureName: "audit-log",
      root: "E:/repo",
      dryRun: true,
      yes: false
    });
  });

  it("parses spec validate with target and --root", () => {
    expect(parseSpecValidateArguments([
      "specs/001-audit-log",
      "--root",
      "E:/repo",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-audit-log",
      json: true
    });
  });

  it("rejects more than one positional target for spec validate", () => {
    expect(() => parseSpecValidateArguments(["specs", "extra"])).toThrow(
      "spec validate accepts one optional target plus --root <path>"
    );
  });

  it("parses check arguments with --quick and --json", () => {
    expect(parseCheckArguments(["E:/repo", "--quick", "--json", "--write-proposals"])).toEqual({
      root: "E:/repo",
      json: true,
      quick: true,
      writeProposals: true
    });
  });

  it("parses context arguments", () => {
    expect(parseContextArguments([
      "实现用户管理页面",
      "--root",
      "E:/repo",
      "--json",
      "--include-avoided"
    ])).toEqual({
      root: "E:/repo",
      task: "实现用户管理页面",
      json: true,
      includeAvoided: true
    });
  });

  it("parses natural-language task arguments", () => {
    expect(parseTaskArguments([
      "请依照这个 Figma 页面开发：https://www.figma.com/design/fileKey/User?node-id=1-2",
      "--root",
      "E:/repo",
      "--apply",
      "--json",
      "--include-avoided"
    ])).toEqual({
      root: "E:/repo",
      task: "请依照这个 Figma 页面开发：https://www.figma.com/design/fileKey/User?node-id=1-2",
      json: true,
      apply: true,
      includeAvoided: true
    });
  });

  it("parses setup arguments with --yes", () => {
    expect(parseSetupArguments(["E:/repo", "--yes"])).toEqual({
      root: "E:/repo",
      yes: true,
      dryRun: false
    });
  });

  it("parses doctor arguments with proposal output", () => {
    expect(parseDoctorArguments(["E:/repo", "--json", "--write-proposals"])).toEqual({
      root: "E:/repo",
      json: true,
      writeProposals: true
    });
  });

  it("parses HTW inspect arguments", () => {
    expect(parseHtwInspectArguments(["E:/repo", "--json", "--write-doc"])).toEqual({
      root: "E:/repo",
      json: true,
      writeDoc: true
    });
  });

  it("parses skill match arguments", () => {
    expect(parseSkillMatchArguments([
      "根据 Figma 节点还原页面",
      "--root",
      "E:/repo",
      "--limit",
      "2",
      "--json",
      "--include-avoided"
    ])).toEqual({
      root: "E:/repo",
      task: "根据 Figma 节点还原页面",
      json: true,
      limit: 2,
      includeAvoided: true
    });
  });

  it("rejects invalid skill match limits", () => {
    expect(() => parseSkillMatchArguments(["修复登录 bug", "--limit", "0"])).toThrow(
      "--limit must be a positive integer"
    );
  });

  it("parses Skill Hub list and search arguments", () => {
    expect(parseSkillListArguments([
      "--root",
      "E:/repo",
      "--category",
      "design",
      "--enabled-only",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      category: "design",
      enabledOnly: true,
      json: true
    });
    expect(parseSkillSearchArguments(["figma", "E:/repo", "--json"])).toEqual({
      root: "E:/repo",
      keyword: "figma",
      json: true
    });
  });

  it("parses Skill Hub doctor, sources, and install guide arguments", () => {
    expect(parseSkillDoctorArguments(["E:/repo", "--json"])).toEqual({
      root: "E:/repo",
      json: true
    });
    expect(parseSkillSourcesArguments(["--root", "E:/repo", "--json"])).toEqual({
      root: "E:/repo",
      json: true
    });
    expect(parseSkillInstallGuideArguments([
      "obra/superpowers",
      "--root",
      "E:/repo"
    ])).toEqual({
      root: "E:/repo",
      sourceId: "obra/superpowers",
      json: false
    });
  });

  it("parses workflow start arguments", () => {
    expect(parseWorkflowStartArguments([
      "用户管理列表改造",
      "--slug",
      "user-management-list",
      "--task",
      "根据 Figma 节点完成用户管理列表改造",
      "--root",
      "E:/repo",
      "--dry-run",
      "--yes",
      "--json",
      "--include-avoided"
    ])).toEqual({
      root: "E:/repo",
      featureName: "用户管理列表改造",
      task: "根据 Figma 节点完成用户管理列表改造",
      slug: "user-management-list",
      json: true,
      dryRun: true,
      yes: true,
      includeAvoided: true
    });
  });

  it("parses workflow status arguments", () => {
    expect(parseWorkflowStatusArguments(["E:/repo", "--json"])).toEqual({
      root: "E:/repo",
      json: true
    });
  });

  it("parses workflow advance arguments", () => {
    expect(parseWorkflowAdvanceArguments([
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--to",
      "coding",
      "--force",
      "--reason",
      "人工确认跳过前置阶段",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      to: "coding",
      force: true,
      reason: "人工确认跳过前置阶段",
      json: true
    });
  });

  it("parses workflow log arguments", () => {
    expect(parseWorkflowLogArguments([
      "--root",
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      json: true
    });
  });

  it("parses review arguments", () => {
    expect(parseReviewArguments([
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--write",
      "--json",
      "--full",
      "--diff",
      "--evidence",
      "--suggest-patch"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      json: true,
      write: true,
      quick: false,
      diff: true,
      evidence: true,
      suggestPatch: true
    });
    expect(parseReviewArguments(["E:/repo"])).toEqual({
      root: "E:/repo",
      json: false,
      write: false,
      quick: true,
      diff: false,
      evidence: false,
      suggestPatch: false
    });
  });

  it("parses SDD arguments and requires a target", () => {
    expect(parseSddArguments([
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--write",
      "--json"
    ], "clarify")).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      json: true,
      write: true
    });
    expect(() => parseSddArguments(["E:/repo"], "status")).toThrow(
      "Usage: azi sdd status"
    );
  });

  it("parses Figma source commands", () => {
    expect(parseFigmaImportArguments([
      "https://www.figma.com/design/fileKey/User?node-id=1-2",
      "E:/repo",
      "--feature",
      "用户管理列表",
      "--slug",
      "user-management-list",
      "--yes",
      "--apply",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      url: "https://www.figma.com/design/fileKey/User?node-id=1-2",
      featureName: "用户管理列表",
      slug: "user-management-list",
      yes: true,
      apply: true,
      json: true,
      includeAvoided: false
    });
    expect(parseFigmaSpecArguments([
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--url",
      "https://www.figma.com/design/fileKey/name?node-id=1-2",
      "--write",
      "--json"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      url: "https://www.figma.com/design/fileKey/name?node-id=1-2",
      write: true,
      json: true
    });
    expect(parseFigmaTargetArguments([
      "--root",
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--json"
    ], "status")).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      json: true
    });
    expect(parseFigmaFallbackArguments([
      "--root",
      "E:/repo",
      "--target",
      "specs/001-user-management",
      "--source",
      "screenshot",
      "--reference",
      "specs/001-user-management/evidence/screen.png",
      "--retried-at",
      "2026-06-23T10:00:00.000Z",
      "--notes",
      "Figma MCP 429"
    ])).toEqual({
      root: "E:/repo",
      target: "specs/001-user-management",
      source: "screenshot",
      reference: "specs/001-user-management/evidence/screen.png",
      retriedAt: "2026-06-23T10:00:00.000Z",
      notes: "Figma MCP 429",
      write: false,
      json: false
    });
  });
});
