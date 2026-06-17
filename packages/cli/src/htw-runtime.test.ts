import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  inspectHtwTable,
  writeHtwInspectionDocument
} from "./htw-runtime.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  const allowedPrefix = path.join(tmpdir(), "azi-harness-htw-");
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(allowedPrefix)) {
      throw new Error(`Refusing to remove unexpected test path: ${root}`);
    }
    await rm(root, { recursive: true, force: true });
  }
});

describe("HTWTable inspection", () => {
  it("extracts public signals from the installed package", async () => {
    const root = await createHtwFixture();

    const report = await inspectHtwTable(root);

    expect(report.packageName).toBe("htw-table");
    expect(report.packageInstalled).toBe(true);
    expect(report.packageVersion).toBe("1.2.0");
    expect(report.entryFiles.some((entry) => entry.path === "dist/index.d.ts" && entry.exists)).toBe(true);
    expect(report.publicSignals.exports).toContain("HtwTable");
    expect(report.publicSignals.props).toContain("HtwTableProps");
    expect(report.publicSignals.events).toContain("selection-change");
  });

  it("writes a reviewable HTW inspection document", async () => {
    const root = await createHtwFixture();
    const report = await inspectHtwTable(root);

    const written = await writeHtwInspectionDocument(root, report);

    expect(written).toBe(".harness/docs/htw-table-api.md");
    const document = await readFile(path.join(root, ".harness/docs/htw-table-api.md"), "utf8");
    expect(document).toContain("# HTWTable API 检查");
    expect(document).toContain("HtwTableProps");
    expect(document).toContain("selection-change");
  });

  it("warns when HTWTable is declared but not installed", async () => {
    const root = await createTemporaryRoot();
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: {
          vue: "^3.5.0",
          "element-plus": "^2.9.0",
          "htw-table": "git+http://example.local/htw-table.git#v1.2.0"
        }
      }, null, 2)
    );

    const report = await inspectHtwTable(root);

    expect(report.packageInstalled).toBe(false);
    expect(report.warnings.some((warning) => warning.includes("node_modules"))).toBe(true);
  });
});

async function createHtwFixture(): Promise<string> {
  const root = await createTemporaryRoot();
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: {
        vue: "^3.5.0",
        "element-plus": "^2.9.0",
        "htw-table": "git+http://example.local/htw-table.git#v1.2.0"
      }
    }, null, 2)
  );

  const packageRoot = path.join(root, "node_modules", "htw-table");
  await mkdir(path.join(packageRoot, "dist"), { recursive: true });
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      name: "htw-table",
      version: "1.2.0",
      types: "./dist/index.d.ts",
      main: "./dist/index.js",
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts"
        }
      }
    }, null, 2)
  );
  await writeFile(
    path.join(packageRoot, "dist", "index.d.ts"),
    [
      "export interface HtwTableProps {",
      "  data: unknown[];",
      "}",
      "export declare const HtwTable: unknown;",
      "export { HtwTable as default };",
      "declare const emit: (event: 'selection-change') => void;",
      ""
    ].join("\n")
  );

  return root;
}

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "azi-harness-htw-"));
  temporaryRoots.push(root);
  return root;
}
