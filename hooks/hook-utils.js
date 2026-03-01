'use strict';
const fs = require('fs');
const path = require('path');

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.claude', 'state'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function getActivePhaseFromTaskIndex(projectRoot) {
  const p = path.join(projectRoot, '.claude', 'state', 'task-index.json');
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const tasks = Array.isArray(data.tasks) ? data.tasks
                : Array.isArray(data) ? data : [];
    const active = tasks.find(t => t.status !== 'completed' && t.status !== 'idle');
    return active ? (active.phase || null) : null;
  } catch (_) { return null; }
}

function getActivePhaseFromWorkflowState(projectRoot) {
  const sd = path.join(projectRoot, '.claude', 'state', 'workflows');
  if (!fs.existsSync(sd)) return null;
  try {
    for (const e of fs.readdirSync(sd)) {
      const sp = path.join(sd, e, 'workflow-state.json');
      if (!fs.existsSync(sp)) continue;
      try {
        const d = JSON.parse(fs.readFileSync(sp, 'utf8'));
        if (d.phase && d.phase !== 'completed') return d.phase;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

function getCurrentPhase(projectRoot) {
  return getActivePhaseFromTaskIndex(projectRoot)
      || getActivePhaseFromWorkflowState(projectRoot);
}

function isBypassPath(filePath) {
  if (!filePath) return false;
  const n = filePath.replace(/\\/g, '/');
  if (n.includes('workflow-harness/')) return true;
  if (n.includes('.claude/projects/') && n.includes('/memory/')) return true;
  if (/\.claude\/settings/.test(n)) return true;
  return false;
}

function parseHookInput(raw) {
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => { data += c; });
    process.stdin.on('error', () => resolve(''));
    process.stdin.on('end', () => resolve(data));
  });
}

module.exports = {
  findProjectRoot,
  getActivePhaseFromTaskIndex,
  getActivePhaseFromWorkflowState,
  getCurrentPhase,
  isBypassPath,
  parseHookInput,
  readStdin,
};
