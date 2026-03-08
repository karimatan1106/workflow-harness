'use strict';
const { findProjectRoot, getCurrentPhase, isBypassPath } = require('./hook-utils');

const BASH_CATEGORIES = {
  readonly: [
    'ls', 'pwd', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
    'python serena-query.py', 'indexer/.venv/Scripts/python.exe',
    'git status', 'git log', 'git diff', 'git show',
    'npm list', 'node --version', 'npm --version'
  ],
  testing: [
    'npm test', 'npm run test', 'npx vitest', 'npx jest',
    'npx playwright', 'pytest'
  ],
  implementation: [
    'npm install', 'pnpm add', 'npm run build',
    'mkdir', 'rm', 'git add', 'git commit'
  ],
  git: [
    'git add', 'git commit', 'git push', 'git tag'
  ],
  security: [
    'npm audit', 'npx audit-ci', 'detect-secrets', 'semgrep',
    'npx snyk', 'trivy', 'gitleaks'
  ]
};

const PHASE_BASH_MAP = {
  scope_definition:        ['readonly'],
  research:                ['readonly'],
  impact_analysis:         ['readonly'],
  requirements:            ['readonly'],
  threat_modeling:         ['readonly'],
  planning:                ['readonly'],
  state_machine:           ['readonly'],
  flowchart:               ['readonly'],
  ui_design:               ['readonly'],
  design_review:           ['readonly'],
  test_design:             ['readonly'],
  test_selection:          ['readonly'],
  code_review:             ['readonly'],
  manual_test:             ['readonly'],
  acceptance_verification: ['readonly'],
  docs_update:             ['readonly'],
  ci_verification:         ['readonly'],
  deploy:                  ['readonly'],
  health_observation:      ['readonly'],
  test_impl:               ['readonly', 'testing'],
  implementation:          ['readonly', 'testing', 'implementation'],
  refactoring:             ['readonly', 'testing', 'implementation'],
  build_check:             ['readonly', 'testing', 'implementation'],
  testing:                 ['readonly', 'testing'],
  regression_test:         ['readonly', 'testing'],
  security_scan:           ['readonly', 'testing', 'security'],
  performance_test:        ['readonly', 'testing'],
  e2e_test:                ['readonly', 'testing'],
  commit:                  ['readonly', 'git'],
  push:                    ['readonly', 'git'],
  completed:               []
};

function isBashAllowed(command, phase) {
  if (!phase) return { allowed: true, reason: '' };
  const cats = PHASE_BASH_MAP[phase];
  if (!cats) return { allowed: true, reason: '' };
  const pfx = [];
  for (const c of cats) (BASH_CATEGORIES[c] || []).forEach(x => pfx.push(x));
  const t = command.trim();
  const isAllowed = pfx.some(p => t === p || t.startsWith(p + ' ') || t.startsWith(p + '\n'));
  if (!isAllowed) {
    const listed = pfx.length > 0 ? pfx.join(', ') : '(none)';
    return { allowed: false, reason: 'Command not allowed in phase "' + phase + '".\nAllowed: ' + listed + '\nUse Read/Write/Edit/Glob/Grep tools instead.' };
  }
  return { allowed: true, reason: '' };
}

function runHook(raw) {
  let inp;
  try { inp = JSON.parse(raw); } catch (_) { process.exit(0); }
  const tn = inp.tool_name || inp.tool || '';
  const ti = inp.tool_input || inp.input || {};
  const phase = getCurrentPhase(findProjectRoot());

  if (tn === 'Bash') {
    const { allowed, reason } = isBashAllowed(ti.command || '', phase);
    if (!allowed) {
      process.stderr.write(JSON.stringify({ decision: 'block', reason }) + '\n');
      process.exit(2);
    }
    process.exit(0);
  }

  process.exit(0);
}

let _raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { _raw += c; });
process.stdin.on('error', () => { process.exit(0); });
process.stdin.on('end', () => { runHook(_raw); });
