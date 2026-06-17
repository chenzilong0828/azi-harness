import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packagesRoot = path.join(root, "packages");
const internalPrefix = "@azi-harness/";
const errors = [];
const warnings = [];

const rootPackage = await readPackage(path.join(root, "package.json"));
const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packagesRoot, entry.name))
  .sort((left, right) => left.localeCompare(right));
const packages = new Map();

for (const directory of packageDirectories) {
  const manifest = await readPackage(path.join(directory, "package.json"));
  if (typeof manifest.name === "string") {
    packages.set(manifest.name, { directory, manifest });
  }
}

for (const { directory, manifest } of packages.values()) {
  validatePackage(directory, manifest);
}

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`error: ${error}`);
  }
  process.exitCode = 2;
} else {
  console.log(`pack:check ok (${packages.size} packages)`);
}

async function validatePackage(directory, manifest) {
  const label = manifest.name ?? path.relative(root, directory);
  const version = manifest.version;

  if (manifest.private === true) {
    errors.push(`${label} is private and cannot be published.`);
  }
  if (typeof version !== "string" || version.length === 0) {
    errors.push(`${label} is missing a version.`);
  }
  if (rootPackage.version !== version) {
    errors.push(`${label} version ${version} does not match root version ${rootPackage.version}.`);
  }

  await requireFile(directory, "package.json", label);
  await validateEntrypoints(directory, manifest, label);
  validateFiles(manifest, label);
  validateInternalDependencies(manifest, label, version);
}

async function validateEntrypoints(directory, manifest, label) {
  if (typeof manifest.main === "string") {
    await requireFile(directory, manifest.main, label);
  }
  if (typeof manifest.types === "string") {
    await requireFile(directory, manifest.types, label);
  }
  if (isRecord(manifest.bin)) {
    for (const [binName, binPath] of Object.entries(manifest.bin)) {
      if (typeof binPath !== "string") {
        errors.push(`${label} bin ${binName} must be a string.`);
        continue;
      }
      await requireFile(directory, binPath, label);
      const content = await readTextIfExists(path.join(directory, binPath));
      if (content !== null && !content.startsWith("#!/usr/bin/env node")) {
        errors.push(`${label} bin ${binName} is missing a node shebang.`);
      }
    }
  }
}

function validateFiles(manifest, label) {
  if (!Array.isArray(manifest.files)) {
    errors.push(`${label} must declare package files.`);
    return;
  }
  if (!manifest.files.includes("dist")) {
    errors.push(`${label} package files must include dist.`);
  }
  if (label === "@azi-harness/spec-kit" && !manifest.files.includes("schemas")) {
    errors.push(`${label} package files must include schemas.`);
  }
}

function validateInternalDependencies(manifest, label, version) {
  const dependencies = isRecord(manifest.dependencies) ? manifest.dependencies : {};
  for (const [name, range] of Object.entries(dependencies)) {
    if (!name.startsWith(internalPrefix)) {
      continue;
    }
    if (!packages.has(name)) {
      errors.push(`${label} depends on unknown internal package ${name}.`);
    }
    if (range !== version) {
      errors.push(`${label} depends on ${name}@${range}; expected ${version}.`);
    }
  }
}

async function requireFile(directory, relativePath, label) {
  const target = path.resolve(directory, relativePath);
  const relative = path.relative(directory, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    errors.push(`${label} has an entry outside the package: ${relativePath}.`);
    return;
  }

  try {
    const targetStat = await stat(target);
    if (!targetStat.isFile()) {
      errors.push(`${label} entry is not a file: ${relativePath}.`);
    }
  } catch {
    errors.push(`${label} is missing ${relativePath}. Run npm run build first.`);
  }
}

async function readPackage(file) {
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw);
}

async function readTextIfExists(file) {
  try {
    await access(file);
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
