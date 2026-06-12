import path from 'node:path';
import { basename } from 'node:path';
import { CORE_SKILLS, REQUIRED_FILES, STAGES, VERSION } from './constants.js';
import { pathExists, readJson, writeJson, writeManagedFile } from './files.js';
import { projectTemplates } from './templates.js';

function help() {
  return `AZI Harness v${VERSION}

Usage:
  azi-harness init [directory] [--force]
  azi-harness setup [directory] [--force]
  azi-harness doctor [directory]
  azi-harness status [directory]
  azi-harness advance <stage> [directory] [--force]
  azi-harness skills [directory]

Stages:
  ${STAGES.join(' -> ')}
`;
}

function parseArgs(args) {
  return {
    positional: args.filter(arg => !arg.startsWith('-')),
    force: args.includes('--force'),
  };
}

function resolveRoot(directory = '.') {
  return path.resolve(process.cwd(), directory);
}

async function install(root, force, io) {
  const projectName = basename(root);
  const templates = projectTemplates(projectName);
  const results = [];

  for (const [relativePath, content] of Object.entries(templates)) {
    results.push(await writeManagedFile(root, relativePath, content, force));
  }

  const configPath = path.join(root, '.harness', 'config.json');
  if (!(await pathExists(configPath)) || force) {
    await writeJson(configPath, {
      schemaVersion: 1,
      projectName,
      profile: 'core',
      adapters: [],
      managedFiles: Object.keys(templates),
    });
    results.push({ relativePath: '.harness/config.json', status: 'created' });
  } else {
    results.push({ relativePath: '.harness/config.json', status: 'kept' });
  }

  const statePath = path.join(root, '.harness', 'state.json');
  if (!(await pathExists(statePath))) {
    await writeJson(statePath, {
      schemaVersion: 1,
      stage: STAGES[0],
      history: [{ stage: STAGES[0], at: new Date().toISOString(), reason: 'initialized' }],
    });
    results.push({ relativePath: '.harness/state.json', status: 'created' });
  } else {
    results.push({ relativePath: '.harness/state.json', status: 'kept' });
  }

  const counts = Object.groupBy(results, result => result.status);
  io.log(`Harness installed in ${root}`);
  io.log(
    `created=${counts.created?.length ?? 0} updated=${counts.updated?.length ?? 0} kept=${counts.kept?.length ?? 0}`
  );
}

async function doctor(root, io) {
  const missing = [];
  for (const relativePath of REQUIRED_FILES) {
    if (!(await pathExists(path.join(root, relativePath)))) {
      missing.push(relativePath);
    }
  }

  if (missing.length > 0) {
    io.error('Harness is incomplete. Missing files:');
    for (const file of missing) {
      io.error(`- ${file}`);
    }
    return 1;
  }

  const state = await readJson(path.join(root, '.harness', 'state.json'));
  if (!STAGES.includes(state.stage)) {
    io.error(`Invalid workflow stage: ${state.stage}`);
    return 1;
  }

  io.log(`Harness OK. Current stage: ${state.stage}`);
  return 0;
}

async function status(root, io) {
  const statePath = path.join(root, '.harness', 'state.json');
  if (!(await pathExists(statePath))) {
    io.error('Harness is not initialized. Run: azi-harness init');
    return 1;
  }

  const state = await readJson(statePath);
  const currentIndex = STAGES.indexOf(state.stage);
  io.log(`Project: ${basename(root)}`);
  io.log(`Stage: ${state.stage}`);
  io.log(`Next: ${STAGES[currentIndex + 1] ?? 'complete'}`);
  io.log(`Transitions: ${state.history?.length ?? 0}`);
  return 0;
}

async function advance(root, targetStage, force, io) {
  if (!STAGES.includes(targetStage)) {
    io.error(`Unknown stage "${targetStage}".`);
    io.error(STAGES.join(', '));
    return 1;
  }

  const statePath = path.join(root, '.harness', 'state.json');
  if (!(await pathExists(statePath))) {
    io.error('Harness is not initialized. Run: azi-harness init');
    return 1;
  }

  const state = await readJson(statePath);
  const currentIndex = STAGES.indexOf(state.stage);
  const targetIndex = STAGES.indexOf(targetStage);
  if (!force && targetIndex !== currentIndex + 1) {
    io.error(`Invalid transition: ${state.stage} -> ${targetStage}`);
    io.error(`Expected next stage: ${STAGES[currentIndex + 1] ?? 'complete'}`);
    return 1;
  }

  state.stage = targetStage;
  state.history ??= [];
  state.history.push({
    stage: targetStage,
    at: new Date().toISOString(),
    reason: force ? 'forced' : 'advanced',
  });
  await writeJson(statePath, state);
  io.log(`Workflow advanced to: ${targetStage}`);
  return 0;
}

async function skills(root, io) {
  for (const skill of CORE_SKILLS) {
    const installed = await pathExists(path.join(root, 'skills', skill, 'SKILL.md'));
    io.log(`${installed ? '[x]' : '[ ]'} ${skill}`);
  }
  return 0;
}

export async function run(args, io = console) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    io.log(help());
    return 0;
  }
  if (args.includes('--version') || args.includes('-v')) {
    io.log(VERSION);
    return 0;
  }

  const command = args[0];
  const parsed = parseArgs(args.slice(1));

  try {
    switch (command) {
      case 'init':
      case 'setup': {
        const root = resolveRoot(parsed.positional[0]);
        await install(root, parsed.force, io);
        return 0;
      }
      case 'doctor':
        return doctor(resolveRoot(parsed.positional[0]), io);
      case 'status':
        return status(resolveRoot(parsed.positional[0]), io);
      case 'advance': {
        const [targetStage, directory] = parsed.positional;
        if (!targetStage) {
          io.error('Usage: azi-harness advance <stage> [directory] [--force]');
          return 1;
        }
        return advance(resolveRoot(directory), targetStage, parsed.force, io);
      }
      case 'skills':
        return skills(resolveRoot(parsed.positional[0]), io);
      default:
        io.error(`Unknown command: ${command}`);
        io.log(help());
        return 1;
    }
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
