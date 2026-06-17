import path from "node:path";

import { describe, expect, it } from "vitest";

import { detectProject } from "@azi-harness/detectors";

import { applyProjectConfig } from "./project-config.js";

const fixturesRoot = path.resolve(process.cwd(), "fixtures");

describe("applyProjectConfig", () => {
  it("applies supported overrides into the effective profile", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "ruoyi-vue3-element-plus"));

    const result = applyProjectConfig(profile, {
      overrides: [
        {
          path: "htwTable.documentationUrl",
          value: "http://intranet.local/docs/htw-table",
          reason: "Use the team mirror",
          owner: "tester"
        }
      ]
    });

    expect(result.issues).toEqual([]);
    expect(result.profile.detected.htwTable.documentationUrl).toBe(
      "http://192.168.30.4/chenzl2/htw-table-vue"
    );
    expect(result.profile.effective.htwTable.documentationUrl).toBe(
      "http://intranet.local/docs/htw-table"
    );
    expect(result.profile.overridesApplied).toEqual([
      {
        path: "htwTable.documentationUrl",
        value: "http://intranet.local/docs/htw-table",
        reason: "Use the team mirror",
        owner: "tester"
      }
    ]);
  });

  it("rejects blocked override paths for objective framework facts", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "ruoyi-vue3-element-plus"));

    const result = applyProjectConfig(profile, {
      overrides: [
        {
          path: "framework.vueMajor",
          value: 2,
          reason: "Force legacy handling",
          owner: null
        }
      ]
    });

    expect(result.profile.effective.framework.vueMajor.value).toBe(3);
    expect(result.profile.overridesApplied).toEqual([]);
    expect(result.issues).toContainEqual({
      severity: "error",
      message: "Override `framework.vueMajor` is not allowed: framework facts come from installed project dependencies and cannot be overridden."
    });
  });

  it("warns when an override matches the detected value", async () => {
    const profile = await detectProject(path.join(fixturesRoot, "ruoyi-vue3-element-plus"));

    const result = applyProjectConfig(profile, {
      overrides: [
        {
          path: "htwTable.documentationUrl",
          value: "http://192.168.30.4/chenzl2/htw-table-vue",
          reason: "No-op example",
          owner: null
        }
      ]
    });

    expect(result.issues).toContainEqual({
      severity: "warning",
      message: "Override `htwTable.documentationUrl` matches the detected value and can be removed."
    });
    expect(result.profile.overridesApplied).toHaveLength(1);
  });
});
