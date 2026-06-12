export const VERSION = '0.1.0';

export const STAGES = [
  'discovery',
  'planning',
  'prd',
  'issues',
  'coding',
  'testing',
  'quality-review',
  'review',
  'commit-pr',
];

export const CORE_SKILLS = [
  'to-plan',
  'to-prd',
  'to-issues',
  'to-coding',
  'to-test',
  'to-quality-review',
  'to-review',
  'to-commit',
  'to-locate',
];

export const REQUIRED_FILES = [
  'AGENTS.md',
  '.harness/config.json',
  '.harness/state.json',
  'docs/agent/instruction.md',
  'docs/agent/workflow.md',
  'docs/agent/permission.md',
  'docs/agent/review.md',
  'docs/agent/evolution.md',
  'rules/coding.md',
  ...CORE_SKILLS.map(name => `skills/${name}/SKILL.md`),
];
