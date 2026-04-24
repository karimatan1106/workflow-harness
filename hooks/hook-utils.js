'use strict';
const fs = require('fs');
const path = require('path');

// Max bytes to inspect when extracting a `phase:` line from TOON content.
// 4KB is enough for the header of real workflow-state.toon files and keeps
// hook latency bounded on pathological inputs (see ADR-029, AC-2 / TC-AC2-04).
const TOON_HEAD_BYTES = 4 * 1024;
const TOON_LARGE_FILE_THRESHOLD = 64 * 1024;

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

function readTaskIndexToon(projectRoot) {
  const p = path.join(projectRoot, '.claude', 'state', 'task-index.toon');
  if (!fs.existsSync(p)) return null;
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (_) { return null; }
  const headerMatch = text.match(/^tasks\[(\d+)\]\{([^}]+)\}:\s*$/m);
  if (!headerMatch) return null;
  const cols = headerMatch[2].split(',').map(s => s.trim());
  const phaseIdx = cols.indexOf('phase');
  const statusIdx = cols.indexOf('status');
  if (phaseIdx < 0 || statusIdx < 0) return null;
  const headerEnd = headerMatch.index + headerMatch[0].length;
  const body = text.slice(headerEnd);
  const lines = body.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[a-zA-Z_]+[:[]/.test(line)) break;
    const parts = parseCsvLine(line);
    if (parts.length !== cols.length) continue;
    const status = parts[statusIdx];
    const phase = parts[phaseIdx];
    if (status !== 'completed' && status !== 'idle') {
      return phase || null;
    }
  }
  return null;
}

function parseCsvLine(line) {
  const parts = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ',' && !inQuote) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  return parts;
}

// Extract the `phase:` value from TOON-ish content.
// Accepts either a string, a Buffer, or a filesystem path.
// - Non-existent paths -> undefined
// - Files > 64KB -> only the head (4KB) is read via fs.readSync
// - Malformed / binary input -> undefined (never throws)
// - No `phase:` line -> undefined
function readToonPhase(input) {
  try {
    let text;
    if (input === null || input === undefined) return undefined;
    if (Buffer.isBuffer(input)) {
      text = input.toString('utf8', 0, Math.min(input.length, TOON_HEAD_BYTES));
    } else if (typeof input === 'string') {
      // Heuristic: a short string with no path separators and a newline is content.
      const looksLikeContent = input.includes('\n') || input.length > 260;
      if (!looksLikeContent && fs.existsSync(input)) {
        text = readToonHeadFromFile(input);
        if (text === undefined) return undefined;
      } else {
        text = input.length > TOON_HEAD_BYTES ? input.slice(0, TOON_HEAD_BYTES) : input;
      }
    } else {
      return undefined;
    }
    const m = text.match(/^[ \t]*phase[ \t]*:[ \t]*([^\r\n]+?)[ \t]*$/m);
    if (!m) return undefined;
    const value = m[1].trim();
    return value.length ? value : undefined;
  } catch (_) {
    return undefined;
  }
}

function readToonHeadFromFile(filePath) {
  let fd;
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const stat = fs.statSync(filePath);
    if (stat.size <= TOON_LARGE_FILE_THRESHOLD) {
      return fs.readFileSync(filePath, 'utf8');
    }
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(TOON_HEAD_BYTES);
    const bytes = fs.readSync(fd, buf, 0, TOON_HEAD_BYTES, 0);
    return buf.toString('utf8', 0, bytes);
  } catch (_) {
    return undefined;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

function getActivePhaseFromWorkflowState(projectRoot) {
  const sd = path.join(projectRoot, '.claude', 'state', 'workflows');
  if (!fs.existsSync(sd)) return null;
  try {
    for (const e of fs.readdirSync(sd)) {
      const dir = path.join(sd, e);
      const jsonPath = path.join(dir, 'workflow-state.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const d = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          if (d.phase && d.phase !== 'completed') return d.phase;
          continue;
        } catch (_) { /* fall through to toon */ }
      }
      const toonPath = path.join(dir, 'workflow-state.toon');
      if (fs.existsSync(toonPath)) {
        const phase = readToonPhase(toonPath);
        if (phase && phase !== 'completed') return phase;
      }
    }
  } catch (_) {}
  return null;
}

function getCurrentPhase(projectRoot) {
  return readTaskIndexToon(projectRoot)
      || getActivePhaseFromWorkflowState(projectRoot);
}

function isBypassPath(filePath) {
  if (!filePath) return false;
  const n = filePath.replace(/\\/g, '/');
  if (n.includes('workflow-harness/')) return true;
  if (n.includes('.claude/projects/') && n.includes('/memory/')) return true;
  if (/\.claude\/settings/.test(n)) return true;
  if (n.includes('.claude/state/')) return true;
  if (n.includes('.agent/')) return true;
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
  readTaskIndexToon,
  getActivePhaseFromWorkflowState,
  getCurrentPhase,
  isBypassPath,
  parseHookInput,
  readStdin,
  readToonPhase,
};
