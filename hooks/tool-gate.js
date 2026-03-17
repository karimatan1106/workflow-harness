'use strict';
const path = require('path');
const { findProjectRoot, getCurrentPhase, isBypassPath, readStdin, parseHookInput } = require('./hook-utils');

// ── Harness lifecycle MCP suffixes (L1 only) ──
const HARNESS_LIFECYCLE = new Set([
  'harness_start', 'harness_next', 'harness_approve',
  'harness_status', 'harness_back', 'harness_reset',
  'harness_delegate_coordinator',
]);

// ── Layer detection ──
function detectLayer() {
  const env = (process.env.HARNESS_LAYER || '').toLowerCase();
  if (!env) return 'orchestrator';
  if (env === 'coordinator') return 'coordinator';
  if (env === 'worker') return 'worker';
  return 'unknown';
}

// ── L1 Orchestrator rules (phase-independent) ──
const L1_ALLOWED = new Set(['Skill', 'AskUserQuestion', 'ToolSearch']);

function checkL1(toolName) {
  if (toolName.startsWith('mcp__harness__')) {
    const suffix = toolName.replace('mcp__harness__', '');
    if (HARNESS_LIFECYCLE.has(suffix)) return null;
    return 'L1 can only use lifecycle MCP.';
  }
  if (L1_ALLOWED.has(toolName)) return null;
  return 'L1 (Orchestrator) cannot use "' + toolName + '". Delegate via harness_delegate_coordinator.';
}

// ── L2 Coordinator rules (phase-independent) ──
const L2_BLOCKED = new Set(['Skill']);

function checkL2(toolName) {
  if (toolName.startsWith('mcp__harness__')) {
    const suffix = toolName.replace('mcp__harness__', '');
    if (HARNESS_LIFECYCLE.has(suffix)) return 'L2 cannot use lifecycle MCP.';
    return null;
  }
  if (L2_BLOCKED.has(toolName)) return 'L2 (Coordinator) cannot use "' + toolName + '".';
  return null;
}

// ── L3 Worker rules (phase-dependent) ──
const L3_ALWAYS_ALLOWED = new Set(['Read', 'Glob', 'Grep', 'SendMessage', 'ToolSearch']);
const L3_ALWAYS_BLOCKED = new Set([
  'Skill', 'Agent', 'TeamCreate', 'TeamDelete',
  'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
]);

// Bash: phase -> allowed command prefixes
const BASH_COMMANDS = {
  lsp: ['python serena-query.py', 'indexer/.venv/Scripts/python.exe'],
  testing: [
    'npm test', 'npm run test', 'npx vitest', 'npx jest',
    'npx playwright', 'pytest',
  ],
  git: ['git add', 'git commit', 'git push', 'git tag'],
  security: [
    'npm audit', 'npx audit-ci', 'detect-secrets', 'semgrep',
    'npx snyk', 'trivy', 'gitleaks',
  ],
};

const PHASE_BASH = {
  scope_definition: ['lsp'], research: ['lsp'], impact_analysis: ['lsp'],
  requirements: ['lsp'], threat_modeling: ['lsp'], planning: ['lsp'],
  state_machine: ['lsp'], flowchart: ['lsp'], ui_design: ['lsp'],
  design_review: ['lsp'], test_design: ['lsp'], test_selection: ['lsp'],
  code_review: ['lsp'], manual_test: ['lsp'], acceptance_verification: ['lsp'],
  docs_update: ['lsp'], ci_verification: ['lsp'], deploy: ['lsp'],
  health_observation: ['lsp'],
  test_impl: ['lsp', 'testing'], implementation: ['lsp', 'testing'],
  refactoring: ['lsp', 'testing'], build_check: ['lsp', 'testing'],
  testing: ['lsp', 'testing'], regression_test: ['lsp', 'testing'],
  performance_test: ['lsp', 'testing'], e2e_test: ['lsp', 'testing'],
  security_scan: ['lsp', 'testing', 'security'],
  commit: ['git'], push: ['git'],
};

// Write/Edit: phase -> allowed extensions
const PHASE_EXT = {
  scope_definition:        ['.toon'],
  research:                ['.toon'],
  impact_analysis:         ['.toon'],
  requirements:            ['.toon'],
  threat_modeling:         ['.toon'],
  planning:                ['.toon'],
  design_review:           ['.toon'],
  test_design:             ['.toon'],
  test_selection:          ['.toon'],
  code_review:             ['.toon'],
  manual_test:             ['.toon'],
  acceptance_verification: ['.toon'],
  docs_update:             ['.toon'],
  ci_verification:         ['.toon'],
  deploy:                  ['.toon'],
  health_observation:      ['.toon'],
  security_scan:           ['.toon'],
  performance_test:        ['.toon'],
  state_machine:           ['.toon', '.mmd'],
  flowchart:               ['.toon', '.mmd'],
  ui_design:               ['.toon', '.mmd'],
  testing:                 ['.toon', '.ts', '.tsx', '.js'],
  regression_test:         ['.toon', '.ts', '.tsx', '.js'],
  test_impl:               ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.toon'],
  implementation:          ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.html', '.toon', '.py', '.go', '.rs', '.java', '.yml', '.yaml', '.toml', '.env', '.sh'],
  refactoring:             ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.test.ts', '.spec.ts', '.py', '.go', '.rs', '.java', '.toon'],
  e2e_test:                ['.toon', '.test.ts', '.spec.ts'],
  build_check:             null,
  commit:                  null,
  push:                    null,
  completed:               null,
};

function getEffectiveExtension(filePath) {
  const base = path.basename(filePath);
  const doubles = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js'];
  for (const ext of doubles) {
    if (base.endsWith(ext)) return ext;
  }
  return path.extname(base);
}

function checkBashCommand(command, phase) {
  const cats = PHASE_BASH[phase];
  if (!cats) return 'Bash is not allowed in phase "' + phase + '".';
  const prefixes = [];
  for (const c of cats) (BASH_COMMANDS[c] || []).forEach(function(p) { prefixes.push(p); });
  const t = command.trim();
  var ok = prefixes.some(function(p) { return t === p || t.startsWith(p + ' ') || t.startsWith(p + '\n'); });
  if (!ok) return 'Command not allowed in phase "' + phase + '". Allowed: ' + prefixes.join(', ');
  return null;
}

function checkWriteEdit(filePath, phase, layer) {
  if (isBypassPath(filePath)) return null;
  if (layer !== 'worker' && filePath.replace(/\\/g, '/').includes('docs/workflows/')) {
    return 'Direct editing of phase artifacts is forbidden. Delegate to workers.';
  }
  if (!phase) return null;
  var allowed = PHASE_EXT[phase];
  if (allowed === null || allowed === undefined) return null;
  var ext = getEffectiveExtension(filePath);
  if (!allowed.includes(ext)) {
    return 'Extension "' + ext + '" not allowed in phase "' + phase + '". Allowed: ' + allowed.join(', ');
  }
  return null;
}

function checkL3(toolName, toolInput, phase, layer) {
  if (L3_ALWAYS_ALLOWED.has(toolName)) return null;
  if (L3_ALWAYS_BLOCKED.has(toolName)) return 'L3 (Worker) cannot use "' + toolName + '".';
  if (toolName.startsWith('mcp__harness__')) return 'L3 cannot use harness MCP tools.';

  if (toolName === 'Bash') {
    if (!phase) return 'Bash not allowed: no active phase.';
    return checkBashCommand(toolInput.command || '', phase);
  }

  if (toolName === 'Write' || toolName === 'Edit') {
    if (!phase) return 'Write/Edit not allowed: no active phase.';
    return checkWriteEdit(toolInput.file_path || toolInput.path || '', phase, layer);
  }

  return null;
}

// ── Main ──
async function main() {
  var raw = await readStdin();
  var inp = parseHookInput(raw);
  if (!inp) process.exit(0);

  var toolName = inp.tool_name || inp.tool || '';
  if (!toolName) process.exit(0);

  var toolInput = inp.tool_input || inp.input || {};
  var layer = detectLayer();
  var phase = getCurrentPhase(findProjectRoot());
  var reason = null;

  if (layer === 'orchestrator') {
    reason = checkL1(toolName);
  } else if (layer === 'coordinator') {
    // Both L2 and L3 have HARNESS_LAYER=coordinator.
    // L2 is additionally restricted by --allowedTools/--disallowedTools (CLI flags).
    // Hook enforces: L2 blocked tools (Skill) + L3 phase-dependent checks (Write/Edit/Bash).
    reason = checkL2(toolName);
    if (!reason && (toolName === 'Write' || toolName === 'Edit' || toolName === 'Bash')) {
      reason = checkL3(toolName, toolInput, phase, layer);
    }
  } else if (layer === 'worker') {
    reason = checkL3(toolName, toolInput, phase, layer);
  }

  if (reason) {
    process.stderr.write(JSON.stringify({ decision: 'block', reason: reason }) + '\n');
    process.exit(2);
  }
  process.exit(0);
}

main();
