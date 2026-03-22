/**
 * TaskState TOON serialization/parsing.
 * Converts TaskState to/from .toon format.
 * @spec docs/spec/features/workflow-harness.md
 */

import type { TaskState, AcceptanceCriterion, RTMEntry, ProofEntry, SubPhaseStatus } from './types.js';
import type { Invariant } from './types-invariant.js';
import { esc, toSemiList, fromSemiList, tableHeader, tableRows, parseTableBlock, parseCsvRow, unesc } from './toon-helpers.js';

function kv(key: string, val: unknown): string {
  if (val === undefined || val === null) return '';
  return `${key}: ${esc(val)}`;
}

function kvLines(pairs: [string, unknown][]): string {
  return pairs.map(([k, v]) => kv(k, v)).filter(Boolean).join('\n');
}

export function serializeState(state: TaskState): string {
  const lines: string[] = [];
  const p = (s: string) => { if (s) lines.push(s); };

  // Scalar KV pairs
  p(kvLines([
    ['taskId', state.taskId], ['taskName', state.taskName], ['version', state.version],
    ['phase', state.phase], ['size', state.size],
    ['riskScore.total', state.riskScore.total],
    ['riskScore.fileCount', state.riskScore.factors.fileCount],
    ['riskScore.hasTests', state.riskScore.factors.hasTests],
    ['riskScore.hasConfig', state.riskScore.factors.hasConfig],
    ['riskScore.hasInfra', state.riskScore.factors.hasInfra],
    ['riskScore.hasSecurity', state.riskScore.factors.hasSecurity],
    ['riskScore.hasDatabase', state.riskScore.factors.hasDatabase],
    ['riskScore.codeLineEstimate', state.riskScore.factors.codeLineEstimate],
    ['userIntent', state.userIntent],
    ['refinedIntent', state.refinedIntent],
    ['docsDir', state.docsDir], ['workflowDir', state.workflowDir],
    ['sessionToken', state.sessionToken], ['stateIntegrity', state.stateIntegrity],
    ['createdAt', state.createdAt], ['updatedAt', state.updatedAt],
    ['parentTaskId', state.parentTaskId],
    ['requirementCount', state.requirementCount],
    ['integrityWarning', state.integrityWarning],
    ['scopeGlob', state.scopeGlob],
    ['forceTransitionCount', state.forceTransitionCount],
  ]));

  // Array-as-semicolon fields
  p('');
  p(kv('completedPhases', toSemiList(state.completedPhases)));
  p(kv('skippedPhases', toSemiList(state.skippedPhases)));
  p(kv('scopeFiles', toSemiList(state.scopeFiles)));
  p(kv('scopeDirs', toSemiList(state.scopeDirs)));
  p(kv('plannedFiles', toSemiList(state.plannedFiles)));
  p(kv('openQuestions', toSemiList(state.openQuestions)));
  p(kv('notInScope', toSemiList(state.notInScope)));
  if (state.testFiles) p(kv('testFiles', toSemiList(state.testFiles)));
  if ((state as any).docPaths) p(kv('docPaths', toSemiList((state as any).docPaths)));
  if (state.childTaskIds) p(kv('childTaskIds', toSemiList(state.childTaskIds)));
  if (state.parallelPhaseBackupLog) p(kv('parallelPhaseBackupLog', toSemiList(state.parallelPhaseBackupLog)));

  // Table arrays
  p('');
  if (state.acceptanceCriteria.length > 0) {
    p(tableHeader('acceptanceCriteria', state.acceptanceCriteria.length, ['id', 'description', 'status', 'testCaseId', 'proofTier']));
    p(tableRows(state.acceptanceCriteria.map(a => [a.id, a.description, a.status, a.testCaseId ?? '', a.proofTier ?? ''])));
  }
  if (state.rtmEntries.length > 0) {
    p(tableHeader('rtmEntries', state.rtmEntries.length, ['id', 'requirement', 'designRef', 'codeRef', 'testRef', 'status']));
    p(tableRows(state.rtmEntries.map(r => [r.id, r.requirement, r.designRef, r.codeRef, r.testRef, r.status])));
  }
  if (state.proofLog.length > 0) {
    p(tableHeader('proofLog', state.proofLog.length, ['phase', 'check', 'level', 'result', 'evidence', 'timestamp']));
    p(tableRows(state.proofLog.map(e => [e.phase, e.check, e.level, String(e.result), e.evidence, e.timestamp])));
  }
  if (state.invariants.length > 0) {
    p(tableHeader('invariants', state.invariants.length, ['id', 'description', 'status', 'proofTier', 'verifiedAt', 'evidence']));
    p(tableRows(state.invariants.map(inv => [inv.id, inv.description, inv.status, inv.proofTier ?? '', inv.verifiedAt ?? '', inv.evidence ?? ''])));
  }

  // SubPhaseStatus as table
  if (state.subPhaseStatus) {
    const entries = Object.entries(state.subPhaseStatus);
    if (entries.length > 0) {
      p(tableHeader('subPhaseStatus', entries.length, ['phase', 'status', 'completedAt']));
      p(tableRows(entries.map(([, v]) => [v.name, v.status, v.completedAt ?? ''])));
    }
  }
  // RetryCount as table
  if (state.retryCount) {
    const entries = Object.entries(state.retryCount);
    if (entries.length > 0) {
      p(tableHeader('retryCount', entries.length, ['phase', 'count']));
      p(tableRows(entries.map(([k, v]) => [k, String(v)])));
    }
  }
  // Approvals as table
  if (state.approvals) {
    const entries = Object.entries(state.approvals);
    if (entries.length > 0) {
      p(tableHeader('approvals', entries.length, ['type', 'approvedAt']));
      p(tableRows(entries.map(([k, v]) => [k, v.approvedAt])));
    }
  }

  // Checkpoint as KV block
  p('');
  const cp = state.checkpoint;
  p(kvLines([
    ['checkpoint.taskId', cp.taskId], ['checkpoint.phase', cp.phase],
    ['checkpoint.timestamp', cp.timestamp], ['checkpoint.sha256', cp.sha256],
    ['checkpoint.userIntent', cp.userIntent], ['checkpoint.refinedIntent', cp.refinedIntent],
  ]));
  p(kv('checkpoint.completedPhases', toSemiList(cp.completedPhases)));
  p(kv('checkpoint.scopeFiles', toSemiList(cp.scopeFiles)));
  p(kv('checkpoint.scopeDirs', toSemiList(cp.scopeDirs ?? [])));
  if (cp.acceptanceCriteria.length > 0) {
    p(tableHeader('checkpoint.acceptanceCriteria', cp.acceptanceCriteria.length, ['id', 'description', 'status', 'testCaseId', 'proofTier']));
    p(tableRows(cp.acceptanceCriteria.map(a => [a.id, a.description, a.status, a.testCaseId ?? '', a.proofTier ?? ''])));
  }
  if (cp.rtmEntries.length > 0) {
    p(tableHeader('checkpoint.rtmEntries', cp.rtmEntries.length, ['id', 'requirement', 'designRef', 'codeRef', 'testRef', 'status']));
    p(tableRows(cp.rtmEntries.map(r => [r.id, r.requirement, r.designRef, r.codeRef, r.testRef, r.status])));
  }

  // Extended state
  if (state.baseline) {
    p('');
    p(kvLines([
      ['baseline.capturedAt', state.baseline.capturedAt],
      ['baseline.totalTests', state.baseline.totalTests],
      ['baseline.passedTests', state.baseline.passedTests],
    ]));
    p(kv('baseline.failedTests', toSemiList(state.baseline.failedTests)));
  }
  if (state.feedbackLog && state.feedbackLog.length > 0) {
    p(tableHeader('feedbackLog', state.feedbackLog.length, ['feedback', 'recordedAt']));
    p(tableRows(state.feedbackLog.map(f => [f.feedback, f.recordedAt])));
  }
  if (state.testResults && state.testResults.length > 0) {
    p(tableHeader('testResults', state.testResults.length, ['recordedAt', 'phase', 'exitCode', 'output', 'summary', 'failedTests']));
    p(tableRows(state.testResults.map(t => [t.recordedAt, t.phase, String(t.exitCode), t.output, t.summary ?? '', toSemiList(t.failedTests ?? [])])));
  }
  if (state.resetHistory && state.resetHistory.length > 0) {
    p(tableHeader('resetHistory', state.resetHistory.length, ['reason', 'resetAt', 'targetPhase']));
    p(tableRows(state.resetHistory.map(r => [r.reason, r.resetAt, r.targetPhase])));
  }
  if (state.knownBugs && state.knownBugs.length > 0) {
    p(tableHeader('knownBugs', state.knownBugs.length, ['testName', 'description', 'severity', 'targetPhase', 'issueUrl', 'recordedAt']));
    p(tableRows(state.knownBugs.map(b => [b.testName, b.description, b.severity, b.targetPhase ?? '', b.issueUrl ?? '', b.recordedAt])));
  }
  if (state.artifactTimestamps) {
    const entries = Object.entries(state.artifactTimestamps);
    if (entries.length > 0) {
      p(tableHeader('artifactTimestamps', entries.length, ['path', 'mtime']));
      p(tableRows(entries.map(([k, v]) => [k, String(v)])));
    }
  }
  if (state.artifactHashes) {
    const entries = Object.entries(state.artifactHashes);
    if (entries.length > 0) {
      p(tableHeader('artifactHashes', entries.length, ['path', 'hash']));
      p(tableRows(entries.map(([k, v]) => [k, v])));
    }
  }
  if (state.projectTraits) {
    const t = state.projectTraits;
    p(kvLines([
      ['projectTraits.hasUI', t.hasUI], ['projectTraits.hasAPI', t.hasAPI],
      ['projectTraits.hasDB', t.hasDB], ['projectTraits.hasEvents', t.hasEvents],
      ['projectTraits.hasI18n', t.hasI18n], ['projectTraits.hasDesignSystem', t.hasDesignSystem],
    ]));
  }

  return lines.join('\n') + '\n';
}

export { parseState } from './state-toon-parse.js';
