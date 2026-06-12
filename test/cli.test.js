import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { run } from '../src/cli.js';

function capture() {
  const lines = [];
  return {
    lines,
    io: {
      log: message => lines.push(String(message)),
      error: message => lines.push(String(message)),
    },
  };
}

test('init creates the core harness and doctor passes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azi-harness-'));
  const output = capture();

  assert.equal(await run(['init', root], output.io), 0);
  assert.equal(await run(['doctor', root], output.io), 0);

  const state = JSON.parse(await readFile(path.join(root, '.harness', 'state.json'), 'utf8'));
  assert.equal(state.stage, 'discovery');
  assert.match(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), /Agent Collaboration Guide/);
});

test('advance enforces ordered workflow stages', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azi-harness-'));
  const output = capture();

  await run(['init', root], output.io);
  assert.equal(await run(['advance', 'coding', root], output.io), 1);
  assert.equal(await run(['advance', 'planning', root], output.io), 0);
  assert.equal(await run(['status', root], output.io), 0);
  assert.ok(output.lines.some(line => line.includes('Stage: planning')));
});

test('setup keeps existing managed files unless force is used', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azi-harness-'));
  const output = capture();

  await run(['init', root], output.io);
  const agentsPath = path.join(root, 'AGENTS.md');
  const original = await readFile(agentsPath, 'utf8');

  await run(['setup', root], output.io);
  assert.equal(await readFile(agentsPath, 'utf8'), original);
  assert.ok(output.lines.some(line => line.includes('kept=')));
});
