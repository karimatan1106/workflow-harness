/**
 * TaskState TOON parser — converts .toon text to TaskState.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, PhaseName, AcceptanceCriterion, RTMEntry, ProofEntry, SubPhaseStatus, RiskScore } from './types.js';
import type { Invariant, InvariantStatus } from './types-invariant.js';
import type { ProofTier, ControlLevel } from './types-core.js';
import { fromSemiList, parseTableBlock, unesc } from './toon-helpers.js';

function toBool(s: string): boolean { return s === 'true'; }
function toNum(s: string): number { return Number(s) || 0; }
function orUndef(s: string): string | undefined { return s === '' ? undefined : s; }

export function parseState(content: string): TaskState {
  const lines = content.split('\n');
  const kv: Record<string, string> = {};
  const tables: Record<string, { cols: string[]; rows: string[][] }> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.startsWith('  ')) continue;
    // Table header
    if (line.match(/^\S+\[\d+\]\{[^}]+\}:\s*$/)) {
      const name = line.match(/^(\S+)\[/)![1];
      const { cols, rows, consumed } = parseTableBlock(lines, i);
      tables[name] = { cols, rows };
      i += consumed - 1;
      continue;
    }
    // KV pair
    const colonIdx = line.indexOf(': ');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = unesc(line.slice(colonIdx + 2));
      kv[key] = val;
    }
  }

  const risk: RiskScore = {
    total: toNum(kv['riskScore.total']),
    factors: {
      fileCount: toNum(kv['riskScore.fileCount']),
      hasTests: toBool(kv['riskScore.hasTests'] ?? 'false'),
      hasConfig: toBool(kv['riskScore.hasConfig'] ?? 'false'),
      hasInfra: toBool(kv['riskScore.hasInfra'] ?? 'false'),
      hasSecurity: toBool(kv['riskScore.hasSecurity'] ?? 'false'),
      hasDatabase: toBool(kv['riskScore.hasDatabase'] ?? 'false'),
      codeLineEstimate: toNum(kv['riskScore.codeLineEstimate']),
    },
  };

  const parseAcRows = (rows: string[][]): AcceptanceCriterion[] =>
    rows.map(r => ({ id: r[0], description: r[1], status: r[2] as 'open' | 'met' | 'not_met', testCaseId: orUndef(r[3]), proofTier: orUndef(r[4]) as ProofTier | undefined }));
  const parseRtmRows = (rows: string[][]): RTMEntry[] =>
    rows.map(r => ({ id: r[0], requirement: r[1], designRef: r[2], codeRef: r[3], testRef: r[4], status: r[5] as RTMEntry['status'] }));

  const state: TaskState = {
    taskId: kv['taskId'], taskName: kv['taskName'], version: 4,
    phase: kv['phase'] as PhaseName,
    completedPhases: fromSemiList(kv['completedPhases']) as PhaseName[],
    skippedPhases: fromSemiList(kv['skippedPhases']) as PhaseName[],
    size: kv['size'] as TaskState['size'],
    riskScore: risk,
    userIntent: kv['userIntent'],
    openQuestions: fromSemiList(kv['openQuestions']),
    notInScope: fromSemiList(kv['notInScope']),
    scopeFiles: fromSemiList(kv['scopeFiles']),
    scopeDirs: fromSemiList(kv['scopeDirs']),
    plannedFiles: fromSemiList(kv['plannedFiles']),
    acceptanceCriteria: tables['acceptanceCriteria'] ? parseAcRows(tables['acceptanceCriteria'].rows) : [],
    rtmEntries: tables['rtmEntries'] ? parseRtmRows(tables['rtmEntries'].rows) : [],
    proofLog: tables['proofLog']
      ? tables['proofLog'].rows.map(r => ({
          phase: r[0] as PhaseName, check: r[1], level: r[2] as ControlLevel,
          result: r[3] === 'true', evidence: r[4], timestamp: r[5],
        }))
      : [],
    invariants: tables['invariants']
      ? tables['invariants'].rows.map(r => ({
          id: r[0], description: r[1], status: r[2] as InvariantStatus,
          proofTier: orUndef(r[3]) as ProofTier | undefined,
          verifiedAt: orUndef(r[4]), evidence: orUndef(r[5]),
        }))
      : [],
    checkpoint: {
      taskId: kv['checkpoint.taskId'], phase: kv['checkpoint.phase'] as PhaseName,
      completedPhases: fromSemiList(kv['checkpoint.completedPhases']) as PhaseName[],
      timestamp: kv['checkpoint.timestamp'], sha256: kv['checkpoint.sha256'],
      userIntent: kv['checkpoint.userIntent'],
      refinedIntent: orUndef(kv['checkpoint.refinedIntent'] ?? ''),
      scopeFiles: fromSemiList(kv['checkpoint.scopeFiles']),
      scopeDirs: fromSemiList(kv['checkpoint.scopeDirs']),
      acceptanceCriteria: tables['checkpoint.acceptanceCriteria'] ? parseAcRows(tables['checkpoint.acceptanceCriteria'].rows) : [],
      rtmEntries: tables['checkpoint.rtmEntries'] ? parseRtmRows(tables['checkpoint.rtmEntries'].rows) : [],
    },
    docsDir: kv['docsDir'], workflowDir: kv['workflowDir'],
    sessionToken: kv['sessionToken'], stateIntegrity: kv['stateIntegrity'],
    createdAt: kv['createdAt'], updatedAt: kv['updatedAt'],
  };

  // Optional fields
  if (kv['refinedIntent']) state.refinedIntent = kv['refinedIntent'];
  if (kv['scopeGlob']) state.scopeGlob = kv['scopeGlob'];
  if (kv['parentTaskId']) state.parentTaskId = kv['parentTaskId'];
  if (kv['requirementCount']) state.requirementCount = toNum(kv['requirementCount']);

  if (kv['integrityWarning'] === 'true') state.integrityWarning = true;
  if (kv['testFiles']) state.testFiles = fromSemiList(kv['testFiles']);
  if (kv['docPaths']) (state as any).docPaths = fromSemiList(kv['docPaths']);
  if (kv['childTaskIds']) state.childTaskIds = fromSemiList(kv['childTaskIds']);
  if (kv['parallelPhaseBackupLog']) state.parallelPhaseBackupLog = fromSemiList(kv['parallelPhaseBackupLog']);

  // Table-based optional fields
  if (tables['subPhaseStatus']) {
    state.subPhaseStatus = {};
    for (const r of tables['subPhaseStatus'].rows) {
      state.subPhaseStatus[r[0]] = { name: r[0], status: r[1] as SubPhaseStatus['status'], completedAt: orUndef(r[2]) };
    }
  }
  if (tables['retryCount']) {
    state.retryCount = {};
    for (const r of tables['retryCount'].rows) state.retryCount[r[0]] = toNum(r[1]);
  }
  if (tables['approvals']) {
    state.approvals = {};
    for (const r of tables['approvals'].rows) state.approvals[r[0]] = { approvedAt: r[1] };
  }
  if (kv['baseline.capturedAt']) {
    state.baseline = {
      capturedAt: kv['baseline.capturedAt'], totalTests: toNum(kv['baseline.totalTests']),
      passedTests: toNum(kv['baseline.passedTests']), failedTests: fromSemiList(kv['baseline.failedTests']),
    };
  }
  if (tables['feedbackLog']) {
    state.feedbackLog = tables['feedbackLog'].rows.map(r => ({ feedback: r[0], recordedAt: r[1] }));
  }
  if (tables['testResults']) {
    state.testResults = tables['testResults'].rows.map(r => {
      const ft = r[5] ? fromSemiList(r[5]) : [];
      return {
        recordedAt: r[0], phase: r[1] as PhaseName, exitCode: toNum(r[2]),
        output: r[3], summary: orUndef(r[4]),
        ...(ft.length > 0 ? { failedTests: ft } : {}),
      };
    });
  }
  if (tables['resetHistory']) {
    state.resetHistory = tables['resetHistory'].rows.map(r => ({ reason: r[0], resetAt: r[1], targetPhase: r[2] }));
  }
  if (tables['knownBugs']) {
    state.knownBugs = tables['knownBugs'].rows.map(r => ({
      testName: r[0], description: r[1], severity: r[2] as 'low' | 'medium' | 'high' | 'critical',
      targetPhase: orUndef(r[3]), issueUrl: orUndef(r[4]), recordedAt: r[5],
    }));
  }
  if (tables['artifactTimestamps']) {
    state.artifactTimestamps = {};
    for (const r of tables['artifactTimestamps'].rows) state.artifactTimestamps[r[0]] = toNum(r[1]);
  }
  if (tables['artifactHashes']) {
    state.artifactHashes = {};
    for (const r of tables['artifactHashes'].rows) state.artifactHashes[r[0]] = r[1];
  }
  if (kv['projectTraits.hasUI']) {
    state.projectTraits = {
      hasUI: toBool(kv['projectTraits.hasUI']), hasAPI: toBool(kv['projectTraits.hasAPI']),
      hasDB: toBool(kv['projectTraits.hasDB']), hasEvents: toBool(kv['projectTraits.hasEvents']),
      hasI18n: toBool(kv['projectTraits.hasI18n']), hasDesignSystem: toBool(kv['projectTraits.hasDesignSystem']),
    };
  }

  return state;
}
