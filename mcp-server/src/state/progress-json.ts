/**
 * Progress TOON — structured progress recording for session recovery.
 * Writes claude-progress.toon (TOON-only, no JSON fallback).
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { TaskState } from './types.js';
import { esc, splitRow, parseKV, parseTableHeader } from './toon-io.js';

export interface ProgressTransition {
  from: string;
  to: string;
  timestamp: string;
}

export interface ProgressData {
  taskId: string;
  taskName: string;
  currentPhase: string;
  completedPhases: string[];
  completedCount: number;
  updatedAt: string;
  transitions: ProgressTransition[];
}

const TOON_FILE = 'claude-progress.toon';

function serializeProgress(data: ProgressData): string {
  const L: string[] = [];
  L.push(`taskId: ${data.taskId}`);
  L.push(`taskName: ${esc(data.taskName)}`);
  L.push(`currentPhase: ${data.currentPhase}`);
  L.push(`completedCount: ${data.completedCount}`);
  L.push(`updatedAt: ${data.updatedAt}`);
  L.push('');
  L.push(`completedPhases: ${data.completedPhases.join(';')}`);
  L.push('');
  const tc = data.transitions.length;
  L.push(`transitions[${tc}]{from,to,timestamp}:`);
  for (const t of data.transitions) {
    L.push(`  ${esc(t.from)}, ${esc(t.to)}, ${t.timestamp}`);
  }
  L.push('');
  return L.join('\n');
}

function parseProgress(content: string): ProgressData {
  const data: ProgressData = {
    taskId: '', taskName: '', currentPhase: '',
    completedPhases: [], completedCount: 0, updatedAt: '',
    transitions: [],
  };
  const lines = content.split('\n');
  let inTransitions = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') { inTransitions = false; continue; }
    if (line.startsWith('transitions[')) {
      inTransitions = true;
      continue;
    }
    if (inTransitions && line.startsWith('  ')) {
      const cells = splitRow(line.trim());
      if (cells.length >= 3) {
        data.transitions.push({ from: cells[0], to: cells[1], timestamp: cells[2] });
      }
      continue;
    }
    const kv = parseKV(line);
    if (!kv) continue;
    const [k, v] = kv;
    if (k === 'taskId') data.taskId = v;
    else if (k === 'taskName') data.taskName = v;
    else if (k === 'currentPhase') data.currentPhase = v;
    else if (k === 'completedCount') data.completedCount = Number(v);
    else if (k === 'updatedAt') data.updatedAt = v;
    else if (k === 'completedPhases') {
      data.completedPhases = v ? v.split(';').filter(Boolean) : [];
    }
  }
  return data;
}

export function writeProgressJSON(state: TaskState, completedPhase: string, nextPhase: string): void {
  try {
    if (!existsSync(state.docsDir)) return;
    const filePath = join(state.docsDir, TOON_FILE);

    let existing: ProgressData | undefined;
    try {
      if (existsSync(filePath)) {
        existing = parseProgress(readFileSync(filePath, 'utf-8'));
      }
    } catch { /* corrupted — overwrite */ }

    const transition: ProgressTransition = {
      from: completedPhase,
      to: nextPhase,
      timestamp: new Date().toISOString(),
    };

    const data: ProgressData = {
      taskId: state.taskId,
      taskName: state.taskName,
      currentPhase: state.phase,
      completedPhases: [...state.completedPhases],
      completedCount: state.completedPhases.length,
      updatedAt: new Date().toISOString(),
      transitions: [...(existing?.transitions ?? []), transition],
    };

    writeFileSync(filePath, serializeProgress(data), 'utf-8');
  } catch { /* non-blocking */ }
}

export function readProgressJSON(docsDir: string): ProgressData | undefined {
  try {
    const toonPath = join(docsDir, TOON_FILE);
    if (existsSync(toonPath)) {
      return parseProgress(readFileSync(toonPath, 'utf-8'));
    }
    return undefined;
  } catch { return undefined; }
}
