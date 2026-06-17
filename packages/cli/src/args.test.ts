import { describe, expect, it } from "vitest";

import {
  parseCheckArguments,
  parseDoctorArguments,
  parseHtwInspectArguments,
  parseSetupArguments,
  parseSpecCreateArguments,
  parseSpecValidateArguments
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
});
