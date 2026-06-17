#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const cliBin = path.join(root, "packages", "cli", "dist", "bin.js");

if (!existsSync(cliBin)) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const build = spawnSync(npmCommand, ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: false
  });

  if ((build.status ?? 1) !== 0) {
    process.exit(build.status ?? 1);
  }
}

await import(pathToFileURL(cliBin).href);
