'use strict';
const fs = require('fs');
const path = require('path');
const { findProjectRoot, isBypassPath, readStdin, parseHookInput } = require('./hook-utils');

const STATE_FILENAME = 'loop-detector-state.json';
const MAX_EDITS_IN_WINDOW = 5;
const WINDOW_MS = 5 * 60 * 1000;

function loadState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch (_) { return {}; }
}

function saveState(statePath, state) {
  try { fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); } catch (_) {}
}

function runHook(raw) {
  const inp = parseHookInput(raw);
  if (!inp) process.exit(0);

  const tn = inp.tool_name || inp.tool || '';
  if (tn !== 'Edit' && tn !== 'Write') process.exit(0);

  const ti = inp.tool_input || inp.input || {};
  const filePath = ti.file_path || ti.path || '';
  if (!filePath) process.exit(0);
  if (isBypassPath(filePath)) process.exit(0);

  const root = findProjectRoot();
  const stateDir = path.join(root, '.claude', 'state');
  const statePath = path.join(stateDir, STATE_FILENAME);
  const state = loadState(statePath);
  if (!state.edits) state.edits = {};

  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const now = Date.now();

  if (!state.edits[normalizedPath]) state.edits[normalizedPath] = [];
  const timestamps = state.edits[normalizedPath].filter(ts => now - ts < WINDOW_MS);
  timestamps.push(now);
  state.edits[normalizedPath] = timestamps;
  saveState(statePath, state);

  if (timestamps.length > MAX_EDITS_IN_WINDOW) {
    const oldest = Math.min(...timestamps);
    const remaining = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
    const msg = 'Loop detected: file edited ' + timestamps.length + ' times in 5 minutes.\n'
            + 'File: ' + filePath + '\n'
            + 'Stop and analyze the root cause before continuing.\n'
            + 'Cooldown: ' + remaining + ' seconds remaining.';
    process.stderr.write(JSON.stringify({ decision: 'block', reason: msg }) + '\n');
    process.exit(2);
  }

  process.exit(0);
}

readStdin().then(raw => { runHook(raw); });
