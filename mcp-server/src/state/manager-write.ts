/**
 * State manager — write operations (persist, update, create)
 * @spec docs/spec/features/workflow-harness.md
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import type { TaskState, PhaseName, Checkpoint, AcceptanceCriterion, RTMEntry, ProofEntry } from './types.js';
import { signState, generateSessionToken, generateTaskId } from '../utils/hmac.js';
import { writeProgressJSON } from './progress-json.js';
import { calculateRiskScore, classifySize, analyzeScope } from '../phases/risk-classifier.js';
import { getActivePhases } from '../phases/registry.js';
import { getStatePath, getDocsPath, buildTaskIndex } from './manager-read.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';

export function computeCheckpointHash(checkpoint: Checkpoint): string {
  const { sha256, ...rest } = checkpoint;
  return createHash('sha256').update(JSON.stringify(rest, Object.keys(rest).sort(), 2)).digest('hex');
}

export function persistState(state: TaskState): void {
  const statePath = getStatePath(state.taskId, state.taskName);
  const dir = dirname(statePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function ensureStateDirs(state: TaskState): void {
  if (!existsSync(state.docsDir)) mkdirSync(state.docsDir, { recursive: true });
  if (!existsSync(state.workflowDir)) mkdirSync(state.workflowDir, { recursive: true });
}

export function writeTaskIndex(): void {
  const tasks = buildTaskIndex(STATE_DIR);
  const indexPath = join(STATE_DIR, 'task-index.json');
  const indexDir = dirname(indexPath);
  if (!existsSync(indexDir)) mkdirSync(indexDir, { recursive: true });
  writeFileSync(indexPath, JSON.stringify({ tasks, updatedAt: new Date().toISOString() }, null, 2));
}

export function createTaskState(taskName: string, userIntent: string, hmacKey: string, files: string[] = [], dirs: string[] = []): TaskState {
  const taskId = generateTaskId();
  const riskScore = calculateRiskScore(analyzeScope(files, dirs));
  const size = classifySize(riskScore);
  const firstPhase = getActivePhases(size)[0];
  const sessionToken = generateSessionToken();
  const docsDir = getDocsPath(taskName);
  const workflowDir = join(STATE_DIR, 'workflows', `${taskId}_${taskName}`);
  const now = new Date().toISOString();
  const state: TaskState = {
    taskId, taskName, version: 4, phase: firstPhase, completedPhases: [], skippedPhases: [],
    size, riskScore, userIntent, openQuestions: [], notInScope: [], scopeFiles: files, scopeDirs: dirs, plannedFiles: [],
    acceptanceCriteria: [], rtmEntries: [], proofLog: [], invariants: [],
    checkpoint: { taskId, phase: firstPhase, completedPhases: [], timestamp: now, sha256: '', userIntent, scopeFiles: files, acceptanceCriteria: [], rtmEntries: [] },
    docsDir, workflowDir, sessionToken, stateIntegrity: '', createdAt: now, updatedAt: now,
  };
  state.checkpoint.sha256 = computeCheckpointHash(state.checkpoint);
  state.stateIntegrity = signState(state as unknown as Record<string, unknown>, hmacKey);
  return state;
}

export function signAndPersist(state: TaskState, hmacKey: string): void {
  state.stateIntegrity = signState(state as unknown as Record<string, unknown>, hmacKey);
  persistState(state);
}

export function updateCheckpoint(state: TaskState, targetPhase: PhaseName): void {
  state.checkpoint.phase = targetPhase;
  state.checkpoint.completedPhases = [...state.completedPhases];
  state.checkpoint.timestamp = state.updatedAt;
  state.checkpoint.sha256 = computeCheckpointHash(state.checkpoint);
}

export function refreshCheckpointTraceability(state: TaskState): void {
  state.checkpoint.acceptanceCriteria = [...state.acceptanceCriteria];
  state.checkpoint.rtmEntries = [...state.rtmEntries];
  state.checkpoint.timestamp = state.updatedAt;
  state.checkpoint.sha256 = computeCheckpointHash(state.checkpoint);
}

export function applyAddAC(state: TaskState, criterion: AcceptanceCriterion): void {
  state.acceptanceCriteria.push(criterion);
  state.requirementCount = state.acceptanceCriteria.length;
  state.updatedAt = new Date().toISOString();
  refreshCheckpointTraceability(state);
}

export function applyAddRTM(state: TaskState, entry: RTMEntry): void {
  state.rtmEntries.push(entry);
  state.updatedAt = new Date().toISOString();
  refreshCheckpointTraceability(state);
}

export function applyUpdateACStatus(state: TaskState, acId: string, status: 'open' | 'met' | 'not_met', testCaseId?: string): boolean {
  const ac = state.acceptanceCriteria.find(a => a.id === acId);
  if (!ac) return false;
  ac.status = status; if (testCaseId !== undefined) ac.testCaseId = testCaseId;
  state.updatedAt = new Date().toISOString(); refreshCheckpointTraceability(state); return true;
}

// ANT-4: Write phase progress to {docsDir}/claude-progress.txt for session recovery
export function appendProgressLog(state: TaskState, completedPhase: string, nextPhase: string): void {
  try {
    const logPath = join(state.docsDir, 'claude-progress.txt');
    if (!existsSync(state.docsDir)) return;
    const completedCount = state.completedPhases.length;
    const line = `[${state.updatedAt}] COMPLETED: ${completedPhase} → NEXT: ${nextPhase} | Task: ${state.taskName} | Done: ${completedCount} phases\n`;
    appendFileSync(logPath, line, 'utf8');
  } catch { /* non-blocking */ }
}

/** N-25: Sanitize task name to prevent path traversal, XSS, and injection */
export function sanitizeTaskName(name: string): string {
  if (name.length > 10000) throw new Error('Task name exceeds maximum length');
  let result = name.replace(/\.\./g, '').replace(/[/\\:*?<>|'";\-]+/g, ' ').replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  if (result.length === 0) throw new Error('Task name is empty after sanitization');
  return result;
}

export function applyUpdateRTMStatus(state: TaskState, rtmId: string, status: 'pending' | 'implemented' | 'tested' | 'verified', codeRef?: string, testRef?: string): boolean {
  const entry = state.rtmEntries.find(e => e.id === rtmId);
  if (!entry) return false;
  entry.status = status;
  if (codeRef !== undefined) entry.codeRef = codeRef;
  if (testRef !== undefined) entry.testRef = testRef;
  state.updatedAt = new Date().toISOString(); refreshCheckpointTraceability(state); return true;
}
