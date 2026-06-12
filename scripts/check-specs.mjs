import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await jsonFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(target);
    }
  }

  return files;
}

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(target)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(target);
    }
  }

  return files;
}

const schemaFiles = await jsonFiles(path.join(root, 'schemas'));
const exampleFiles = await jsonFiles(path.join(root, 'examples'));
const documentationFiles = [
  path.join(root, 'README.md'),
  ...(await markdownFiles(path.join(root, 'docs'))),
];
const ids = new Set();

for (const file of schemaFiles) {
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (value.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    throw new Error(`${path.relative(root, file)} does not use JSON Schema 2020-12`);
  }
  if (!value.$id || ids.has(value.$id)) {
    throw new Error(`${path.relative(root, file)} has a missing or duplicate $id`);
  }
  ids.add(value.$id);
}

for (const file of exampleFiles) {
  const value = JSON.parse(await readFile(file, 'utf8'));
  if (!value.$schema || value.schemaVersion !== 1) {
    throw new Error(`${path.relative(root, file)} is missing $schema or schemaVersion=1`);
  }
  await access(path.resolve(path.dirname(file), value.$schema));
}

for (const file of documentationFiles) {
  const content = await readFile(file, 'utf8');
  const links = [...content.matchAll(/\]\((\.[^)#]+)(?:#[^)]+)?\)/g)];
  for (const [, relativeTarget] of links) {
    await access(path.resolve(path.dirname(file), relativeTarget));
  }
}

const profile = JSON.parse(
  await readFile(path.join(root, 'examples', 'profiles', 'omz.profile.json'), 'utf8')
);
const adapter = JSON.parse(
  await readFile(path.join(root, 'examples', 'adapters', 'codex.adapter.json'), 'utf8')
);
const projectConfig = JSON.parse(
  await readFile(path.join(root, 'examples', 'project', 'azi.config.json'), 'utf8')
);
const skillExample = JSON.parse(
  await readFile(path.join(root, 'examples', 'skills', 'to-prd.skill.json'), 'utf8')
);
const workItem = JSON.parse(
  await readFile(path.join(root, 'examples', 'work-items', 'FEAT-2026-001.work.json'), 'utf8')
);
const expectedSkills = new Set([
  'setup-omz',
  'grill-with-docs',
  'grill-me-ui',
  'to-locate',
  'to-prd',
  'to-plan',
  'to-issues',
  'to-coding',
  'to-test',
  'to-quality-review',
  'to-review',
  'to-commit',
]);
const actualSkills = new Set(profile.skills.map(skill => skill.id));

if (
  expectedSkills.size !== actualSkills.size ||
  actualSkills.size !== profile.skills.length ||
  [...expectedSkills].some(skill => !actualSkills.has(skill))
) {
  throw new Error('The omz profile does not contain the approved 12-skill catalog');
}
if (!actualSkills.has(profile.entrySkill)) {
  throw new Error('The omz profile entrySkill is not present in its skill catalog');
}

const artifactIds = new Set(profile.artifacts.map(artifact => artifact.id));
if (artifactIds.size !== profile.artifacts.length) {
  throw new Error('The omz profile contains duplicate artifact ids');
}
for (const output of skillExample.outputs) {
  if (!artifactIds.has(output.artifactType)) {
    throw new Error(`Skill output references unknown artifact type: ${output.artifactType}`);
  }
}
for (const artifact of workItem.artifacts) {
  if (!artifactIds.has(artifact.type)) {
    throw new Error(`Work item references unknown artifact type: ${artifact.type}`);
  }
}
for (const capability of profile.adapterRequirements.requiredCapabilities) {
  if (adapter.capabilities[capability] !== true) {
    throw new Error(`Codex adapter does not satisfy required capability: ${capability}`);
  }
}
if (adapter.status !== 'experimental') {
  throw new Error('The unverified Codex adapter example must remain experimental in phase 1');
}
const validatorIds = new Set();
for (const file of exampleFiles.filter(file => file.includes(`${path.sep}validators${path.sep}`))) {
  const validator = JSON.parse(await readFile(file, 'utf8'));
  validatorIds.add(validator.id);
}
for (const validatorId of profile.validators) {
  if (!validatorIds.has(validatorId)) {
    throw new Error(`Profile references unknown validator: ${validatorId}`);
  }
}
for (const artifact of profile.artifacts.filter(artifact => artifact.validator)) {
  if (!validatorIds.has(artifact.validator)) {
    throw new Error(`Artifact references unknown validator: ${artifact.validator}`);
  }
}
const scopeIds = new Set((projectConfig.project.scopes ?? []).map(scope => scope.name));
if (workItem.scope && !scopeIds.has(workItem.scope)) {
  throw new Error(`Work item references unknown project scope: ${workItem.scope}`);
}

console.log(
  `Specification check passed: ${schemaFiles.length} schemas, ${exampleFiles.length} examples, ${documentationFiles.length} docs, ${actualSkills.size} omz skills, ${artifactIds.size} artifact types.`
);
