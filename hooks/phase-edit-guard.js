'use strict';
const path = require('path');
const { findProjectRoot, getCurrentPhase, isBypassPath } = require('./hook-utils');

const PHASE_EXTENSIONS = {
  scope_definition:          ['.md'],
  research:                  ['.md'],
  impact_analysis:           ['.md'],
  requirements:              ['.md'],
  threat_modeling:           ['.md'],
  planning:                  ['.md'],
  design_review:             ['.md'],
  test_design:               ['.md'],
  test_selection:            ['.md'],
  code_review:               ['.md'],
  testing:                   ['.md', '.ts', '.tsx', '.js'],
  regression_test:           ['.md', '.ts', '.tsx', '.js'],
  manual_test:               ['.md'],
  security_scan:             ['.md'],
  performance_test:          ['.md'],
  acceptance_verification:   ['.md'],
  docs_update:               ['.md'],
  ci_verification:           ['.md'],
  deploy:                    ['.md'],
  health_observation:        ['.md'],
  state_machine:           ['.md', '.mmd'],
  flowchart:               ['.md', '.mmd'],
  ui_design:               ['.md', '.mmd'],
  test_impl:               ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.md'],
  implementation:          ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.html', '.md', '.py', '.go', '.rs', '.java', '.yml', '.yaml', '.toml', '.env', '.sh'],
  refactoring:             ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.test.ts', '.spec.ts', '.py', '.go', '.rs', '.java', '.md'],
  build_check:             null,
  e2e_test:                ['.md', '.test.ts', '.spec.ts'],
  commit:                  null,
  push:                    null,
  completed:               null
};

function getEffectiveExtension(filePath) {
  const base = path.basename(filePath);
  const doubles = ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js'];
  for (const ext of doubles) {
    if (base.endsWith(ext)) return ext;
  }
  return path.extname(base);
}

function runHook(raw) {
  let inp;
  try { inp = JSON.parse(raw); } catch (_) { process.exit(0); }

  const tn = inp.tool_name || inp.tool || '';
  if (tn !== 'Edit' && tn !== 'Write') process.exit(0);

  const ti = inp.tool_input || inp.input || {};
  const filePath = ti.file_path || ti.path || '';
  if (!filePath) process.exit(0);

  if (isBypassPath(filePath)) process.exit(0);

  // Block Orchestrator from directly editing phase artifacts
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (normalizedPath.includes('docs/workflows/')) {
    const msg = `Orchestrator must not edit phase artifacts directly. Use Agent tool to delegate to subagents.`;
    process.stderr.write(JSON.stringify({ decision: 'block', reason: msg, path: filePath }) + '\n');
    process.exit(2);
  }

  const phase = getCurrentPhase(findProjectRoot());
  if (!phase) process.exit(0);

  const allowedExt = PHASE_EXTENSIONS[phase];
  if (allowedExt === null || allowedExt === undefined) process.exit(0);

  const ext = getEffectiveExtension(filePath);
  // .toon files are TOON checkpoint outputs — allowed in all phases that allow .md
  if (ext === '.toon' && allowedExt.includes('.md')) process.exit(0);
  if (!allowedExt.includes(ext)) {
    const msg = 'File extension "' + ext + '" not allowed in phase "' + phase + '".\n'
            + 'Allowed extensions: ' + allowedExt.join(', ') + '\n'
            + 'File: ' + filePath + '\n'
            + 'Ensure you are in the correct workflow phase.';
    process.stderr.write(JSON.stringify({ decision: 'block', reason: msg }) + '\n');
    process.exit(2);
  }

  process.exit(0);
}

let _raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { _raw += c; });
process.stdin.on('error', () => { process.exit(0); });
process.stdin.on('end', () => { runHook(_raw); });
