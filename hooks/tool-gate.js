'use strict';
const path = require('path');
const { findProjectRoot, getCurrentPhase, isBypassPath, readStdin, parseHookInput } = require('./hook-utils');
const fs = require('fs');

// ── Harness lifecycle MCP suffixes (L1 only) ──
const HARNESS_LIFECYCLE = new Set([
  'harness_start', 'harness_next', 'harness_approve',
  'harness_status', 'harness_back', 'harness_reset',
]);

// ── Layer detection ──
// hookInput is set in main() before checkL1/L2/L3 calls
var hookInput = null;

function detectLayer() {
  const env = (process.env.HARNESS_LAYER || '').toLowerCase();
  if (env === 'worker') return 'worker';
  if (env === 'coordinator') return 'coordinator';
  if (!hookInput || !hookInput.agent_id) return 'orchestrator';
  // カスタムエージェント名で判別
  var agentId = hookInput.agent_id || '';
  if (agentId.startsWith('worker')) return 'worker';
  return 'coordinator';
}

// ── L1 Orchestrator rules (phase-independent) ──
const L1_ALLOWED = new Set(['Skill', 'AskUserQuestion', 'ToolSearch', 'TeamCreate', 'SendMessage', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop', 'TaskOutput']);

function checkL1(toolName, toolInput) {
  if (toolName.startsWith('mcp__harness__')) {
    const suffix = toolName.replace('mcp__harness__', '');
    if (HARNESS_LIFECYCLE.has(suffix)) return null;
    return 'L1 can only use lifecycle MCP.';
  }
  if (toolName === 'Agent') {
    var st = ((toolInput && toolInput.subagent_type) || '').toLowerCase();
    if (st === 'coordinator' || st === 'worker' || st === 'hearing-worker') return null;
    return 'L1 Agent() restricted. subagent_type must be coordinator|worker|hearing-worker. Got: "' + (toolInput && toolInput.subagent_type || '') + '"';
  }
  if (L1_ALLOWED.has(toolName)) return null;
  return 'L1 (Orchestrator) cannot use "' + toolName + '". Delegate via Agent(coordinator/worker).';
}

// ── L2 Coordinator rules (phase-independent) ──
const L2_BLOCKED = new Set([]);

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
const L3_ALWAYS_ALLOWED = new Set(['Read', 'Glob', 'Grep']);
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
    var fp = toolInput.file_path || toolInput.path || '';
    if (isBypassPath(fp)) return null;
    if (!phase) return 'Write/Edit not allowed: no active phase.';
    return checkWriteEdit(toolInput.file_path || toolInput.path || '', phase, layer);
  }

  return null;
}

// ── Debug env logging ──
function logEnvDebug(projectRoot, raw) {
  if (!process.env.HARNESS_DEBUG) return;
  var logPath = (projectRoot || process.cwd()) + '/.harness-debug.log';
  var allEnv = Object.assign({}, process.env);
  if (allEnv.HARNESS_SESSION_TOKEN) allEnv.HARNESS_SESSION_TOKEN = '[SET]';
  var entry = {
    ts: new Date().toISOString(),
    env: allEnv,
    stdin: raw !== undefined ? raw : null,
  };
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

// ── Main ──
async function main() {
  var raw = await readStdin();
  var inp = parseHookInput(raw);
  hookInput = inp;
  if (!inp) process.exit(0);

  var toolName = inp.tool_name || inp.tool || '';
  if (!toolName) process.exit(0);

  var toolInput = inp.tool_input || inp.input || {};
  var projectRoot = findProjectRoot();
  var layer = detectLayer();
  var phase = getCurrentPhase(projectRoot);
  logEnvDebug(projectRoot);
  var reason = null;

  if (layer === 'orchestrator') {
    reason = checkL1(toolName, toolInput);
  } else if (layer === 'coordinator') {
    // L2 coordinator: Agent(subagent_type="coordinator")で起動。
    // Bash is unrestricted for coordinator layer.
    // Write/Edit are phase-dependent (extension check).
    reason = checkL2(toolName);
    if (!reason && (toolName === 'Write' || toolName === 'Edit')) {
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
