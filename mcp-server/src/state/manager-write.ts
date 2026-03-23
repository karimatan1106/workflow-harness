/**
 * State manager — write operations (persist, update, create)
 * @spec docs/spec/features/workflow-harness.md
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import type { TaskState, PhaseName, TaskSize, Checkpoint, AcceptanceCriterion, RTMEntry, ProofEntry, RiskScore } from './types.js';
import { signState, generateSessionToken, generateTaskId } from '../utils/hmac.js';
import { writeProgressJSON } from './progress-json.js';
import { getActivePhases, SIZE_SKIP_MAP } from '../phases/registry.js';

const DEFAULT_FACTORS = {
  fileCount: 0, hasTests: false, hasConfig: false,
  hasInfra: false, hasSecurity: false, hasDatabase: false,
  codeLineEstimate: 0,
};
const RISK_SCORE_MAP: Record<TaskSize, RiskScore> = {
  large: { total: 8, factors: { ...DEFAULT_FACTORS } },
};
import { getStatePath, getDocsPath, buildTaskIndex } from './manager-read.js';
import { resolveProjectPath } from '../utils/project-root.js';
import { serializeState } from './state-toon-io.js';
import { serializeTaskIndex } from './index-toon-io.js';

function getStateDir(): string { return process.env.STATE_DIR || '.claude/state'; }

export function computeCheckpointHash(checkpoint: Checkpoint): string {
  const { sha256, ...rest } = checkpoint;
  return createHash('sha256').update(JSON.stringify(rest, Object.keys(rest).sort(), 2)).digest('hex');
}

export function persistState(state: TaskState): void {
  const jsonPath = getStatePath(state.taskId, state.taskName);
  const toonPath = jsonPath.replace(/\.json$/, '.toon');
  const dir = dirname(toonPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(toonPath, serializeState(state));
}

export function ensureStateDirs(state: TaskState): void {
  if (!existsSync(resolveProjectPath(state.docsDir))) mkdirSync(resolveProjectPath(state.docsDir), { recursive: true });
  if (!existsSync(resolveProjectPath(state.workflowDir))) mkdirSync(resolveProjectPath(state.workflowDir), { recursive: true });
}

export function writeTaskIndex(): void {
  const sd = getStateDir();
  const tasks = buildTaskIndex(sd);
  const indexPath = join(sd, 'task-index.toon');
  const indexDir = dirname(indexPath);
  if (!existsSync(indexDir)) mkdirSync(indexDir, { recursive: true });
  writeFileSync(indexPath, serializeTaskIndex({ tasks, updatedAt: new Date().toISOString() }));
}

export function createTaskState(taskName: string, userIntent: string, hmacKey: string, files: string[] = [], dirs: string[] = [], size: TaskSize = 'large'): TaskState {
  const taskId = generateTaskId();
  const riskScore = RISK_SCORE_MAP[size];
  const firstPhase = getActivePhases(size)[0];
  const sessionToken = generateSessionToken();
  const docsDir = getDocsPath(taskName);
  const workflowDir = join(getStateDir(), 'workflows', `${taskId}_${taskName}`);
  const now = new Date().toISOString();
  const state: TaskState = {
    taskId, taskName, version: 4, phase: firstPhase, completedPhases: [], skippedPhases: SIZE_SKIP_MAP[size],
    size, riskScore, userIntent, openQuestions: [], notInScope: [], scopeFiles: files, scopeDirs: dirs, plannedFiles: [],
    acceptanceCriteria: [], rtmEntries: [], proofLog: [], invariants: [],
    checkpoint: { taskId, phase: firstPhase, completedPhases: [], timestamp: now, sha256: '', userIntent, scopeFiles: files, scopeDirs: dirs, acceptanceCriteria: [], rtmEntries: [] },
    docsDir, workflowDir, sessionToken, stateIntegrity: '', createdAt: now, updatedAt: now,
  };
  state.checkpoint.sha256 = computeCheckpointHash(state.checkpoint);
  state.stateIntegrity = signState(state as unknown as Record<string, unknown>, hmacKey);
  return state;
}

/**
 * Normalize optional table-like fields so that the in-memory state matches
 * what the TOON serializer produces.  The serializer omits empty tables
 * (retryCount, subPhaseStatus, approvals, etc.) entirely, so after a
 * serialize→parse roundtrip these keys are absent.  We delete them before
 * signing to ensure HMAC consistency.
 */
function normalizeForSigning(state: TaskState): void {
  const emptyObj = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v as object).length === 0;
  if (emptyObj(state.retryCount)) delete state.retryCount;
  if (emptyObj(state.subPhaseStatus)) delete state.subPhaseStatus;
  if (emptyObj(state.approvals)) delete state.approvals;
  if (emptyObj(state.artifactTimestamps)) delete state.artifactTimestamps;
  if (emptyObj(state.artifactHashes)) delete state.artifactHashes;

}

export function signAndPersist(state: TaskState, hmacKey: string): void {
  normalizeForSigning(state);
  state.stateIntegrity = signState(state as unknown as Record<string, unknown>, hmacKey);
  persistState(state);
}

export function updateCheckpoint(state: TaskState, targetPhase: PhaseName): void {
  state.checkpoint.phase = targetPhase;
  state.checkpoint.completedPhases = [...state.completedPhases];
  state.checkpoint.scopeFiles = [...(state.scopeFiles ?? [])];
  state.checkpoint.scopeDirs = [...(state.scopeDirs ?? [])];
  state.checkpoint.timestamp = state.updatedAt;
  state.checkpoint.sha256 = computeCheckpointHash(state.checkpoint);
}

export function refreshCheckpointTraceability(state: TaskState): void {
  state.checkpoint.acceptanceCriteria = [...state.acceptanceCriteria];
  state.checkpoint.rtmEntries = [...state.rtmEntries];
  state.checkpoint.scopeFiles = [...(state.scopeFiles ?? [])];
  state.checkpoint.scopeDirs = [...(state.scopeDirs ?? [])];
  if (state.refinedIntent) state.checkpoint.refinedIntent = state.refinedIntent;
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


/** N-25: Sanitize task name to prevent path traversal, XSS, and injection */
export function sanitizeTaskName(name: string): string {
  if (name.length > 10000) throw new Error('Task name exceeds maximum length');
  let result = name.replace(/\.\./g, '').replace(/[/\\:*?<>|'";-]+/g, ' ').replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
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
